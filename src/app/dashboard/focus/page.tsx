'use client'
// src/app/dashboard/focus/page.tsx
// Session focus plein écran : enchaîne les fiches dues dans l'ordre suggéré.
// Lit ?lesson=<id> (mode solo) et ?system=<id> (filtre matière).
// Sans param : queue d'aujourd'hui filtrée par le semestre courant (localStorage 'medrev-sem').
//
// Navigation : flèches gauche/droite (boutons + clavier). Re-rating possible
// quand on revient sur une fiche déjà notée (overwrite DB).
// Visuel : plante qui pousse au sommet de la card — 1 feuille colorée par fiche notée,
// fleur quand tout est terminé.

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { System, Lesson } from '@/types'
import './styles.css'

const J = [0, 1, 3, 5, 7, 15, 21, 30, 45, 60, 75, 90, 105, 120]

const SCORE_COLORS: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: '#C75050',
  2: '#E08B3C',
  3: '#D9B24A',
  4: '#7AA56B',
  5: '#1B4332',
}

// Durée jusqu'à floraison complète de la tige (la plante grandit avec le temps).
// 15 min = palier raisonnable pour une session focus PASS.
const TIME_TO_FULL_MS = 15 * 60 * 1000

// ===================== TYPES =====================
type Score = 1 | 2 | 3 | 4 | 5
type StepEntry = { score?: Score; ok?: boolean; date?: string; note?: string } | null

type DueInfo = {
  stepIndex: number
  dueDate: string
  status: 'missed' | 'today' | 'fresh'
  overdueDays: number
}

type QueueItem = {
  lesson: Lesson
  due: DueInfo
  lastScore: Score | null
  priority: number
}

type Result = {
  lessonId: string
  lessonName: string
  systemName: string
  // atMs = ms écoulées depuis le début de la session quand l'action a été prise.
  // Sert à positionner la feuille à la bonne hauteur sur la tige (qui grandit avec le temps).
  outcome:
    | { kind: 'rated'; score: Score; atMs: number }
    | { kind: 'reported'; atMs: number }
}

type Phase = 'loading' | 'session' | 'done' | 'empty'

// ===================== HELPERS =====================
function dateStrFromOffset(base: string, offset: number): string {
  const d = new Date(base + 'T12:00:00')
  d.setDate(d.getDate() + offset)
  return d.toISOString().split('T')[0]
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000
  )
}

function stepScore(s: StepEntry): Score | null {
  if (!s) return null
  if (typeof (s as { score?: number }).score === 'number') {
    const sc = (s as { score: number }).score
    if (sc >= 1 && sc <= 5) return sc as Score
  }
  if (typeof (s as { ok?: boolean }).ok === 'boolean') {
    return (s as { ok: boolean }).ok ? 5 : 1
  }
  return null
}

function stepDate(lesson: Lesson, i: number): string {
  if (!lesson.learn_date) return ''
  return dateStrFromOffset(lesson.learn_date, J[i])
}

function getLastScore(lesson: Lesson): Score | null {
  const steps = (lesson.steps as StepEntry[]) || []
  for (let i = J.length - 1; i >= 0; i--) {
    const sc = stepScore(steps[i])
    if (sc) return sc
  }
  return null
}

function getDueForToday(lesson: Lesson, today: string): DueInfo | null {
  if (!lesson.learn_date) return null
  const steps = (lesson.steps as StepEntry[]) || []
  for (let i = 0; i < J.length; i++) {
    if (stepScore(steps[i])) continue
    const dd = stepDate(lesson, i)
    if (dd <= today) {
      return {
        stepIndex: i,
        dueDate: dd,
        status: dd === today ? 'today' : 'missed',
        overdueDays: dd < today ? daysBetween(dd, today) : 0,
      }
    }
    break // steps chronologiques
  }
  return null
}

function getNextUndoneJ(lesson: Lesson): number | null {
  const steps = (lesson.steps as StepEntry[]) || []
  for (let i = 0; i < J.length; i++) {
    if (!stepScore(steps[i])) return i
  }
  return null
}

function computeTodayQueue(lessons: Lesson[], today: string): QueueItem[] {
  const out: QueueItem[] = []
  lessons.forEach(l => {
    const due = getDueForToday(l, today)
    if (!due) return
    const lastScore = getLastScore(l)
    let priority: number
    if (due.status === 'missed') {
      priority = -due.overdueDays * 100 + (lastScore ?? 3) * 10
    } else if (lastScore !== null) {
      priority = 1000 + lastScore * 100
    } else {
      priority = 6000 + due.stepIndex
    }
    out.push({ lesson: l, due, lastScore, priority })
  })
  return out.sort((a, b) => a.priority - b.priority)
}

function buildQueue(
  lessons: Lesson[],
  systems: System[],
  lessonParam: string | null,
  systemParam: string | null,
  today: string
): QueueItem[] {
  // 1) Construit la queue de base : toutes les J du jour.
  //    Filtre par matière si ?system= explicite ; sinon par le semestre courant.
  let baseQueue: QueueItem[]
  if (systemParam) {
    const sysLessons = lessons.filter(l => l.system_id === systemParam)
    baseQueue = computeTodayQueue(sysLessons, today)
  } else {
    const semRaw = typeof window !== 'undefined' ? localStorage.getItem('medrev-sem') : null
    const sem = semRaw === '1' ? 1 : 2
    const semSystemIds = new Set(systems.filter(s => s.semestre === sem).map(s => s.id))
    const semLessons = lessons.filter(l => semSystemIds.has(l.system_id))
    baseQueue = computeTodayQueue(semLessons, today)
  }

  // 2) Si une fiche précise est demandée (?lesson=), on la place en première position
  //    de la queue complète — pas de mode solo, l'utilisateur peut naviguer aux autres
  //    via les flèches.
  if (lessonParam) {
    const existingIdx = baseQueue.findIndex(q => q.lesson.id === lessonParam)
    if (existingIdx > 0) {
      // Déjà dans la queue : on la déplace en tête.
      const [item] = baseQueue.splice(existingIdx, 1)
      baseQueue.unshift(item)
    } else if (existingIdx === -1) {
      // Pas dans la queue d'aujourd'hui (ex : fiche fragile pas encore due) :
      // on la prepend avec un DueInfo synthétique sur le prochain J non noté.
      const l = lessons.find(x => x.id === lessonParam)
      if (l) {
        let due: DueInfo | null = getDueForToday(l, today)
        if (!due) {
          const idx = getNextUndoneJ(l)
          if (idx !== null) {
            if (l.learn_date) {
              const dd = stepDate(l, idx)
              due = {
                stepIndex: idx,
                dueDate: dd,
                status: dd <= today ? (dd === today ? 'today' : 'missed') : 'fresh',
                overdueDays: dd < today ? daysBetween(dd, today) : 0,
              }
            } else {
              due = { stepIndex: idx, dueDate: today, status: 'fresh', overdueDays: 0 }
            }
          }
        }
        if (due) {
          baseQueue.unshift({ lesson: l, due, lastScore: getLastScore(l), priority: -1 })
        }
      }
    }
    // existingIdx === 0 : déjà en tête, rien à faire.
  }

  return baseQueue
}

// ===================== PLANT (SVG inline) =====================
// La tige grandit avec le TEMPS (linéairement jusqu'à TIME_TO_FULL_MS).
// Chaque fiche notée dépose une feuille à la hauteur où la tige était au moment
// de la note (récupéré via outcome.atMs). Les feuilles ne bougent plus une fois
// posées : à la fin, elles racontent visuellement le rythme de la session
// (clusters bas = session rapide, étalées = session lente).

type PlantProps = {
  results: (Result | null)[]
  elapsedMs: number
  timeToFullMs: number
  /** Si true (écran bilan), tige forcée au max et fleur affichée si au moins une note. */
  forceFull?: boolean
  /** Burst de particules courant (déclenche l'anim au moment d'un rate). */
  particleBurst?: { ts: number; idx: number; score: Score } | null
  /** Niveau de combo courant (influence la vivacité du jardin). */
  comboLevel?: number
}

// Géométrie SVG (viewBox 120x130)
const POT_Y = 110
const STEM_TOP_MIN_Y = 30 // hauteur la plus haute atteignable

function FocusPlant({ results, elapsedMs, timeToFullMs, forceFull = false }: PlantProps) {
  const ratedLeaves: { idx: number; score: Score; atMs: number }[] = []
  results.forEach((r, idx) => {
    if (r && r.outcome.kind === 'rated') {
      ratedLeaves.push({ idx, score: r.outcome.score, atMs: r.outcome.atMs })
    }
  })
  const hasRated = ratedLeaves.length > 0
  const avg = hasRated
    ? ratedLeaves.reduce((s, x) => s + x.score, 0) / ratedLeaves.length
    : 0

  // Progression temporelle de la tige
  const stemProgress = forceFull
    ? 1
    : Math.max(0, Math.min(1, elapsedMs / timeToFullMs))

  // Couleur de la fleur basée sur la moyenne
  let flowerColor = SCORE_COLORS[4]
  if (avg > 0) {
    if (avg < 2) flowerColor = SCORE_COLORS[1]
    else if (avg < 3) flowerColor = SCORE_COLORS[2]
    else if (avg < 4) flowerColor = SCORE_COLORS[3]
    else if (avg < 4.5) flowerColor = SCORE_COLORS[4]
    else flowerColor = SCORE_COLORS[5]
  }

  // Position du sommet de la tige (uniquement pour la fleur)
  const stemTopY = POT_Y - stemProgress * (POT_Y - STEM_TOP_MIN_Y)

  return (
    <div className="focus-plant-wrap" aria-hidden="true">
      <svg viewBox="0 0 120 130" className="focus-plant-svg" role="img">
        <title>Progression de la session</title>

        {/* Pot */}
        <path d="M 50 110 L 70 110 L 67 125 L 53 125 Z" fill="#A37147" />
        <path d="M 50 110 L 70 110 L 68 108 L 52 108 Z" fill="#7E5630" />
        <ellipse cx="60" cy="108" rx="9" ry="1.5" fill="#5C3A21" />

        {/* Tige : on dessine la tige pleine, et on la met à l'échelle verticalement
             via transform scaleY pour avoir une transition CSS fluide. */}
        <g
          className="focus-plant-stem-group"
          style={{
            transform: `scaleY(${stemProgress})`,
            transformOrigin: `60px ${POT_Y}px`,
          }}
        >
          <line
            x1={60}
            y1={POT_Y}
            x2={60}
            y2={STEM_TOP_MIN_Y}
            stroke="#2D6A4F"
            strokeWidth={2.2}
            strokeLinecap="round"
          />
        </g>

        {/* Feuilles : positionnées à la hauteur correspondant à leur atMs.
             Position fixe une fois posée — ne suit pas la tige qui continue de pousser. */}
        {ratedLeaves.map(({ idx, score, atMs }, n) => {
          const leafProgress = Math.max(0, Math.min(1, atMs / timeToFullMs))
          const yPos = POT_Y - leafProgress * (POT_Y - STEM_TOP_MIN_Y)
          const side = n % 2 === 0 ? -1 : 1
          const cx = 60 + side * 9
          const color = SCORE_COLORS[score]
          return (
            <g key={`leaf-${idx}`} className="focus-plant-leaf">
              <ellipse
                cx={cx}
                cy={yPos}
                rx={7}
                ry={3}
                transform={`rotate(${side * 25} ${cx} ${yPos})`}
                fill={color}
              />
              <ellipse
                cx={cx}
                cy={yPos}
                rx={3}
                ry={1}
                transform={`rotate(${side * 25} ${cx} ${yPos})`}
                fill="rgba(255,255,255,0.18)"
              />
            </g>
          )
        })}

        {/* Marqueurs reportés (petites pierres au pied du pot) */}
        {results.map((r, idx) => {
          if (!r || r.outcome.kind !== 'reported') return null
          const offset = (idx * 7) % 18 - 9
          return (
            <ellipse
              key={`stone-${idx}`}
              cx={60 + offset}
              cy={127}
              rx={2.2}
              ry={1.2}
              fill="#B8B0A0"
              opacity={0.7}
            />
          )
        })}

        {/* Fleur au sommet : uniquement à l'écran bilan (forceFull) */}
        {forceFull && hasRated && (
          <g className="focus-plant-flower">
            {[0, 72, 144, 216, 288].map(angle => (
              <ellipse
                key={angle}
                cx={60}
                cy={stemTopY - 7}
                rx={4.2}
                ry={2.4}
                transform={`rotate(${angle} 60 ${stemTopY})`}
                fill={flowerColor}
                opacity={0.92}
              />
            ))}
            <circle cx={60} cy={stemTopY} r={2.6} fill="#F3D88A" />
          </g>
        )}
      </svg>
    </div>
  )
}

// ===================== PLANT HERO (arbuste avec branches) =====================
// ViewBox 320x420 (portrait élargi pour accueillir les branches).
// Tronc qui grandit avec le temps + 5 branches qui sprouting à des paliers + feuilles
// attachées aux branches. Plus organique qu'une simple tige avec feuilles alignées.

const HERO_TRUNK_X = 160
const HERO_POT_TOP_Y = 350
const HERO_TRUNK_TOP_MIN_Y = 70
const HERO_TRUNK_RANGE = HERO_POT_TOP_Y - HERO_TRUNK_TOP_MIN_Y // 280

// Définition des branches (apparaissent quand stemProgress >= threshold)
type BranchDef = {
  threshold: number
  fromY: number
  midX: number; midY: number
  tipX: number; tipY: number
}
const BRANCHES: BranchDef[] = [
  { threshold: 0.18, fromY: 295, midX: 130, midY: 290, tipX: 95,  tipY: 278 },
  { threshold: 0.34, fromY: 255, midX: 198, midY: 250, tipX: 232, tipY: 240 },
  { threshold: 0.50, fromY: 210, midX: 122, midY: 205, tipX: 88,  tipY: 192 },
  { threshold: 0.66, fromY: 160, midX: 200, midY: 156, tipX: 235, tipY: 144 },
  { threshold: 0.82, fromY: 110, midX: 130, midY: 105, tipX: 100, tipY: 92  },
]

const LEAF_SLOT_TS = [0.50, 0.78, 1.0] // 3 emplacements le long de la branche

// Calcul d'un point sur une courbe de Bézier quadratique
function bezierPoint(
  p0x: number, p0y: number,
  p1x: number, p1y: number,
  p2x: number, p2y: number,
  t: number
): { x: number; y: number } {
  const it = 1 - t
  return {
    x: it * it * p0x + 2 * it * t * p1x + t * t * p2x,
    y: it * it * p0y + 2 * it * t * p1y + t * t * p2y,
  }
}

type LeafPlacement = {
  x: number; y: number
  rot: number
  score: Score
  idx: number
}

function placeLeavesOnTree(
  rated: { idx: number; score: Score; atMs: number }[],
  timeToFullMs: number
): LeafPlacement[] {
  const placements: LeafPlacement[] = []
  const branchUsed: number[] = BRANCHES.map(() => 0)
  let trunkLeafCount = 0

  rated.forEach((leaf) => {
    const lp = Math.max(0, Math.min(1, leaf.atMs / timeToFullMs))

    // Trouve la dernière branche dont le seuil est atteint à lp
    let branchIdx = -1
    for (let i = BRANCHES.length - 1; i >= 0; i--) {
      if (lp >= BRANCHES[i].threshold) { branchIdx = i; break }
    }

    if (branchIdx === -1) {
      // Avant la première branche : feuille sur le tronc
      const y = HERO_POT_TOP_Y - lp * HERO_TRUNK_RANGE
      const side = trunkLeafCount % 2 === 0 ? -1 : 1
      trunkLeafCount++
      placements.push({
        x: HERO_TRUNK_X + side * 9,
        y,
        rot: side * 28,
        score: leaf.score,
        idx: leaf.idx,
      })
      return
    }

    // Placement sur une branche
    const branch = BRANCHES[branchIdx]
    const slotIdx = branchUsed[branchIdx] % LEAF_SLOT_TS.length
    branchUsed[branchIdx]++
    const t = LEAF_SLOT_TS[slotIdx]
    const p = bezierPoint(
      HERO_TRUNK_X, branch.fromY,
      branch.midX, branch.midY,
      branch.tipX, branch.tipY,
      t
    )
    const side = branch.tipX < HERO_TRUNK_X ? -1 : 1
    // Léger décalage perpendiculaire à la branche pour ne pas se chevaucher
    const perpOffset = (slotIdx - 1) * 6
    placements.push({
      x: p.x + perpOffset * side * 0.3,
      y: p.y + perpOffset * 0.7,
      rot: side * 22 + (slotIdx - 1) * 12,
      score: leaf.score,
      idx: leaf.idx,
    })
  })

  return placements
}

function FocusPlantHero({ results, elapsedMs, timeToFullMs, particleBurst, comboLevel = 0 }: PlantProps) {
  const ratedLeaves: { idx: number; score: Score; atMs: number }[] = []
  results.forEach((r, idx) => {
    if (r && r.outcome.kind === 'rated') {
      ratedLeaves.push({ idx, score: r.outcome.score, atMs: r.outcome.atMs })
    }
  })

  const stemProgress = Math.max(0, Math.min(1, elapsedMs / timeToFullMs))

  // Soleil monte de y=170 (horizon) à y=50 (zenith) avec la progression
  const sunY = 170 - stemProgress * 120
  const sunX = 252

  // Brins d'herbe répartis sur tout le sol
  const grassBlades = [12, 30, 50, 72, 96, 122, 198, 218, 238, 258, 278, 298]

  // Placements des feuilles sur l'arbre
  const leafPlacements = placeLeavesOnTree(ratedLeaves, timeToFullMs)

  return (
    <svg
      viewBox="0 0 320 420"
      className="focus-garden-svg"
      role="img"
      preserveAspectRatio="xMidYMax meet"
    >
      <title>Ton jardin de session</title>

      {/* Soleil avec halo */}
      <circle cx={sunX} cy={sunY} r={42} fill="#F3D88A" opacity={0.16} className="focus-sun-halo" />
      <circle cx={sunX} cy={sunY} r={26} fill="#F8E5A0" opacity={0.95} className="focus-sun" />
      <circle cx={sunX} cy={sunY} r={18} fill="#F3D88A" opacity={1} />

      {/* Nuages décoratifs */}
      <ellipse cx={70} cy={70} rx={28} ry={6} fill="white" opacity={0.55} />
      <ellipse cx={85} cy={66} rx={18} ry={5} fill="white" opacity={0.55} />
      <ellipse cx={195} cy={45} rx={22} ry={5} fill="white" opacity={0.45} />

      {/* Lucioles : petits points lumineux qui flottent. Plus actives quand combo monte. */}
      {[
        { x: 50,  y: 180, dx: 22, dy: -14, dur: 7.2 },
        { x: 250, y: 220, dx: -18, dy: -22, dur: 8.5 },
        { x: 90,  y: 280, dx: 28, dy: -10, dur: 6.8 },
        { x: 220, y: 130, dx: -14, dy: 18, dur: 9.1 },
        { x: 160, y: 180, dx: 16, dy: 14, dur: 7.7 },
      ].map((f, i) => {
        const speedMul = comboLevel >= 3 ? 0.55 : comboLevel >= 1 ? 0.78 : 1
        return (
          <circle
            key={`firefly-${i}`}
            cx={f.x}
            cy={f.y}
            r={1.6}
            fill="#F8E5A0"
            className="focus-firefly"
            style={{
              animationDuration: `${f.dur * speedMul}s, ${(f.dur * speedMul) / 1.7}s`,
              animationDelay: `${i * 0.6}s, ${i * 0.4}s`,
              ['--ff-dx' as string]: `${f.dx}px`,
              ['--ff-dy' as string]: `${f.dy}px`,
            } as React.CSSProperties}
          />
        )
      })}

      {/* Collines distantes (deux couches) */}
      <path
        d="M 0 360 Q 80 326 160 348 Q 240 366 320 338 L 320 400 L 0 400 Z"
        fill="#C9D8B5" opacity={0.55}
      />
      <path
        d="M 0 380 Q 100 368 200 380 Q 270 388 320 376 L 320 400 L 0 400 Z"
        fill="#A8C088" opacity={0.85}
      />

      {/* Sol */}
      <rect x={0} y={388} width={320} height={32} fill="#9DB87E" />

      {/* Brins d'herbe */}
      {grassBlades.map((x, i) => (
        <g key={`grass-${i}`}>
          <path d={`M ${x} 392 L ${x + 1.6} 384 L ${x + 3.2} 392`}
                stroke="#6E8A58" strokeWidth={0.9} fill="none" />
          <path d={`M ${x + 5} 394 L ${x + 6.6} 386 L ${x + 8.2} 394`}
                stroke="#6E8A58" strokeWidth={0.9} fill="none" opacity={0.75} />
        </g>
      ))}

      {/* Petite plante d'arrière-plan à droite */}
      <g opacity={0.6}>
        <line x1={278} y1={388} x2={278} y2={368} stroke="#5A8550" strokeWidth={1.2} strokeLinecap="round" />
        <ellipse cx={272} cy={373} rx={5} ry={2} fill="#7AA56B" transform="rotate(-25 272 373)" />
        <ellipse cx={284} cy={371} rx={5} ry={2} fill="#7AA56B" transform="rotate(28 284 371)" />
        <ellipse cx={278} cy={365} rx={4} ry={1.8} fill="#9BC086" />
      </g>

      {/* Petit caillou décoratif */}
      <ellipse cx={50} cy={394} rx={8} ry={3.5} fill="#C9C3B5" opacity={0.7} />
      <ellipse cx={52} cy={392.5} rx={3} ry={1.5} fill="rgba(255,255,255,0.4)" />

      {/* Pot */}
      <path d="M 130 350 L 190 350 L 182 388 L 138 388 Z" fill="#A37147" />
      <path d="M 130 350 L 190 350 L 188 346 L 132 346 Z" fill="#7E5630" />
      <ellipse cx={160} cy={346} rx={28} ry={3.4} fill="#5C3A21" />
      <path d="M 138 354 L 144 380" stroke="rgba(255,255,255,0.16)" strokeWidth={2} strokeLinecap="round" />

      {/* Pierres pour les fiches reportées */}
      {results.map((r, idx) => {
        if (!r || r.outcome.kind !== 'reported') return null
        const offset = (idx * 13) % 56 - 28
        const yJitter = (idx % 3) * 1.5
        return (
          <ellipse
            key={`stone-${idx}`}
            cx={160 + offset}
            cy={392 + yJitter}
            rx={4}
            ry={2.3}
            fill="#B8B0A0"
            opacity={0.78}
          />
        )
      })}

      {/* Groupe plante : tronc + branches + feuilles, avec balancement */}
      <g className="focus-plant-sway-group">

        {/* Tronc : path scaleY pour grandir avec le temps */}
        <g
          className="focus-plant-stem-group"
          style={{
            transform: `scaleY(${stemProgress})`,
            transformOrigin: `${HERO_TRUNK_X}px ${HERO_POT_TOP_Y}px`,
          }}
        >
          <path
            d={`M ${HERO_TRUNK_X} ${HERO_POT_TOP_Y} Q ${HERO_TRUNK_X - 3} ${(HERO_POT_TOP_Y + HERO_TRUNK_TOP_MIN_Y) / 2} ${HERO_TRUNK_X} ${HERO_TRUNK_TOP_MIN_Y}`}
            stroke="#5A4438"
            strokeWidth={4.5}
            fill="none"
            strokeLinecap="round"
          />
          {/* Highlight tronc */}
          <path
            d={`M ${HERO_TRUNK_X - 1.5} ${HERO_POT_TOP_Y - 5} Q ${HERO_TRUNK_X - 4.5} ${(HERO_POT_TOP_Y + HERO_TRUNK_TOP_MIN_Y) / 2} ${HERO_TRUNK_X - 1.5} ${HERO_TRUNK_TOP_MIN_Y + 5}`}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={1.2}
            fill="none"
            strokeLinecap="round"
          />
        </g>

        {/* Branches : visibles uniquement quand le tronc les a atteintes */}
        {BRANCHES.map((b, i) => {
          if (stemProgress < b.threshold) return null
          // Fade-in/grow progress sur 8% supplémentaires après le seuil
          const growT = Math.max(0, Math.min(1, (stemProgress - b.threshold) / 0.08))
          const path = `M ${HERO_TRUNK_X} ${b.fromY} Q ${b.midX} ${b.midY} ${b.tipX} ${b.tipY}`
          return (
            <g key={`branch-${i}`} className="focus-plant-branch" style={{ opacity: growT }}>
              <path d={path} stroke="#6E5A4A" strokeWidth={2.2} fill="none" strokeLinecap="round" />
            </g>
          )
        })}

        {/* Feuilles placées sur les branches (ou sur le tronc en début de session) */}
        {leafPlacements.map((p) => {
          const color = SCORE_COLORS[p.score]
          // Forme de feuille : ovale étiré
          return (
            <g key={`leaf-${p.idx}`} className="focus-plant-leaf"
               transform={`rotate(${p.rot} ${p.x} ${p.y})`}>
              <ellipse cx={p.x} cy={p.y} rx={9} ry={4} fill={color} />
              <line
                x1={p.x - 8} y1={p.y}
                x2={p.x + 8} y2={p.y}
                stroke="rgba(0,0,0,0.18)" strokeWidth={0.6}
              />
              <ellipse cx={p.x - 1} cy={p.y - 1.2} rx={5} ry={1.3} fill="rgba(255,255,255,0.28)" />
            </g>
          )
        })}

        {/* Burst de particules à la position de la feuille fraîchement notée.
            La key={ts} force React à remonter le groupe et à re-déclencher l'anim. */}
        {particleBurst && (() => {
          const target = leafPlacements.find(p => p.idx === particleBurst.idx)
          if (!target) return null
          const color = SCORE_COLORS[particleBurst.score]
          const angles = [0, 45, 90, 135, 180, 225, 270, 315]
          return (
            <g key={`burst-${particleBurst.ts}`} className="focus-particle-burst">
              {angles.map((a, i) => {
                const rad = (a * Math.PI) / 180
                const dx = Math.cos(rad) * 22
                const dy = Math.sin(rad) * 22
                return (
                  <circle
                    key={i}
                    cx={target.x}
                    cy={target.y}
                    r={2.2}
                    fill={color}
                    className="focus-particle"
                    style={{
                      animationDelay: `${i * 25}ms`,
                      ['--px-dx' as string]: `${dx}px`,
                      ['--px-dy' as string]: `${dy}px`,
                    } as React.CSSProperties}
                  />
                )
              })}
            </g>
          )
        })()}
      </g>
    </svg>
  )
}

// ===================== EXPORT (Suspense wrapper requis pour useSearchParams en Next.js 14) =====================
export default function FocusPage() {
  return (
    <Suspense fallback={
      <div className="focus-root">
        <div className="focus-loading">Chargement…</div>
      </div>
    }>
      <FocusPageBody />
    </Suspense>
  )
}

// ===================== BODY =====================
function FocusPageBody() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const lessonParam = searchParams.get('lesson')
  const systemParam = searchParams.get('system')

  const [userId, setUserId] = useState<string | null>(null)
  const [systems, setSystems] = useState<System[]>([])
  const [phase, setPhase] = useState<Phase>('loading')
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [results, setResults] = useState<(Result | null)[]>([])
  const [loading, setLoading] = useState(false)
  const [startedAt, setStartedAt] = useState<number>(0)
  const [now, setNow] = useState<number>(0)

  // Combo : compteur de scores 4-5 consécutifs (sur les premières notations).
  // Score 1-2 reset, score 3 maintient. maxCombo garde le record de la session.
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)

  // Burst de particules : ts incrémenté à chaque rate pour re-déclencher l'anim CSS.
  const [particleBurst, setParticleBurst] = useState<{ ts: number; idx: number; score: Score } | null>(null)

  const today = new Date().toISOString().split('T')[0]

  // Reset scroll au montage
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo(0, 0)
    const main = document.querySelector('main')
    if (main) main.scrollTop = 0
  }, [])

  // Chargement initial : auth + data + queue
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      if (cancelled) return
      setUserId(user.id)
      const [{ data: sys }, { data: les }] = await Promise.all([
        supabase.from('systems').select('*').eq('user_id', user.id),
        supabase.from('lessons').select('*').eq('user_id', user.id),
      ])
      if (cancelled) return
      const sysList = (sys as System[] | null) ?? []
      const lesList = (les as Lesson[] | null) ?? []
      setSystems(sysList)
      const q = buildQueue(lesList, sysList, lessonParam, systemParam, today)
      setQueue(q)
      setResults(new Array(q.length).fill(null))
      setPhase(q.length === 0 ? 'empty' : 'session')
      setCurrentIdx(0)
      setStartedAt(Date.now())
      setNow(Date.now())
    })()
    return () => { cancelled = true }
  }, [supabase, router, lessonParam, systemParam, today])

  // Tick chrono en mode session
  useEffect(() => {
    if (phase !== 'session') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [phase])

  const current = queue[currentIdx]
  const currentSystem = current ? systems.find(s => s.id === current.lesson.system_id) : undefined
  const currentSystemName = currentSystem?.name ?? 'Matière'
  const currentResult = results[currentIdx] ?? null

  // ============ Helpers d'avancement ============
  function findNextEmptyIdx(arr: (Result | null)[], fromIdx: number): number {
    // Cherche d'abord en avant
    for (let i = fromIdx + 1; i < arr.length; i++) if (arr[i] === null) return i
    // Sinon en arrière
    for (let i = 0; i < fromIdx; i++) if (arr[i] === null) return i
    return -1
  }

  // ============ Actions : rate ============
  const rate = useCallback(async (score: Score) => {
    if (!current || loading || phase !== 'session') return
    setLoading(true)

    const wasEmpty = results[currentIdx] === null
    const atMs = Math.max(0, Date.now() - startedAt)

    const newSteps = [...((current.lesson.steps as StepEntry[]) || [])]
    while (J.length > newSteps.length) newSteps.push(null)
    newSteps[current.due.stepIndex] = { score, date: today }
    await supabase.from('lessons').update({ steps: newSteps }).eq('id', current.lesson.id)

    const newResults = [...results]
    newResults[currentIdx] = {
      lessonId: current.lesson.id,
      lessonName: current.lesson.name,
      systemName: currentSystemName,
      outcome: { kind: 'rated', score, atMs },
    }
    setResults(newResults)

    // Combo : seulement sur première notation (pas re-rating)
    if (wasEmpty) {
      let nextCombo = combo
      if (score >= 4) nextCombo = combo + 1
      else if (score <= 2) nextCombo = 0
      // score === 3 : maintien
      setCombo(nextCombo)
      if (nextCombo > maxCombo) setMaxCombo(nextCombo)
    }

    // Burst de particules à chaque rate (re-rate compris, c'est cosmétique)
    setParticleBurst({ ts: Date.now(), idx: currentIdx, score })

    // Avance seulement si la fiche n'avait jamais été actionnée dans cette session
    if (wasEmpty) {
      const next = findNextEmptyIdx(newResults, currentIdx)
      if (next === -1) setPhase('done')
      else setCurrentIdx(next)
    }
    // Si re-rating : on reste sur la fiche, l'utilisateur peut vérifier ou naviguer.

    setLoading(false)
  }, [current, loading, phase, currentIdx, results, supabase, today, currentSystemName, startedAt, combo, maxCombo])

  // ============ Actions : report ============
  const report = useCallback(async () => {
    if (!current || loading || phase !== 'session') return
    setLoading(true)

    const wasEmpty = results[currentIdx] === null
    const wasRated = results[currentIdx]?.outcome.kind === 'rated'
    const atMs = Math.max(0, Date.now() - startedAt)

    // Si on bascule rated → reported, on efface la note en DB pour rester cohérent
    if (wasRated) {
      const newSteps = [...((current.lesson.steps as StepEntry[]) || [])]
      while (J.length > newSteps.length) newSteps.push(null)
      newSteps[current.due.stepIndex] = null
      await supabase.from('lessons').update({ steps: newSteps }).eq('id', current.lesson.id)
    }

    const newResults = [...results]
    newResults[currentIdx] = {
      lessonId: current.lesson.id,
      lessonName: current.lesson.name,
      systemName: currentSystemName,
      outcome: { kind: 'reported', atMs },
    }
    setResults(newResults)

    if (wasEmpty) {
      const next = findNextEmptyIdx(newResults, currentIdx)
      if (next === -1) setPhase('done')
      else setCurrentIdx(next)
    }

    setLoading(false)
  }, [current, loading, phase, currentIdx, results, supabase, currentSystemName, startedAt])

  // ============ Navigation ============
  const goPrev = useCallback(() => {
    if (phase !== 'session') return
    setCurrentIdx(i => Math.max(0, i - 1))
  }, [phase])

  const goNext = useCallback(() => {
    if (phase !== 'session') return
    setCurrentIdx(i => Math.min(queue.length - 1, i + 1))
  }, [phase, queue.length])

  // ============ Raccourcis clavier ============
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { router.push('/dashboard'); return }
      if (phase !== 'session') return
      if (e.key === 'ArrowLeft') { goPrev(); return }
      if (e.key === 'ArrowRight') { goNext(); return }
      if (e.key === 'r' || e.key === 'R') { report(); return }
      const n = parseInt(e.key, 10)
      if (n >= 1 && n <= 5) rate(n as Score)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rate, report, router, phase, goPrev, goNext])

  // ===================== RENDERS =====================
  if (!userId || phase === 'loading') {
    return (
      <div className="focus-root">
        <div className="focus-loading">Chargement…</div>
      </div>
    )
  }

  if (phase === 'empty') {
    return (
      <div className="focus-root">
        <div className="focus-topbar">
          <div className="focus-brand">MedRev <span className="focus-brand-mode">focus</span></div>
          <Link href="/dashboard" className="focus-quit" aria-label="Quitter">{'×'}</Link>
        </div>
        <div className="focus-stage">
          <div className="focus-card focus-empty-card">
            <div className="focus-empty-mark" aria-hidden="true">{'✓'}</div>
            <h2 className="focus-empty-title">Rien à réviser</h2>
            <p className="focus-empty-sub">
              {lessonParam
                ? "Cette fiche n’est pas disponible pour la révision."
                : systemParam
                  ? "Aucune fiche de cette matière n’est due aujourd’hui."
                  : "Tu es à jour. Profite de ta journée."}
            </p>
            <Link href="/dashboard" className="focus-empty-cta">Retour au tableau de bord</Link>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'done') {
    const elapsedSec = Math.max(0, Math.round((now - startedAt) / 1000))
    const min = Math.floor(elapsedSec / 60)
    const sec = elapsedSec % 60
    const filled = results.filter((r): r is Result => r !== null)
    const rated = filled.filter(r => r.outcome.kind === 'rated')
    const reported = filled.length - rated.length
    const avg = rated.length === 0
      ? null
      : rated.reduce((s, r) => s + (r.outcome as { score: Score }).score, 0) / rated.length

    return (
      <div className="focus-root">
        <div className="focus-topbar">
          <div className="focus-brand">MedRev <span className="focus-brand-mode">focus</span></div>
          <Link href="/dashboard" className="focus-quit" aria-label="Quitter">{'×'}</Link>
        </div>
        <div className="focus-stage">
          <div className="focus-card focus-done-card">

            {/* Plante en pleine floraison (tige forcée au max + fleur) */}
            <div className="focus-done-plant">
              <FocusPlant
                results={results}
                elapsedMs={Math.max(0, now - startedAt)}
                timeToFullMs={TIME_TO_FULL_MS}
                forceFull
              />
            </div>

            <div className="focus-done-kicker">Session terminée</div>
            <h2 className="focus-done-title">
              {rated.length} fiche{rated.length > 1 ? 's' : ''} notée{rated.length > 1 ? 's' : ''}
              {reported > 0 && (
                <> <span className="focus-done-sep">{'·'}</span> <span className="focus-done-reported">{reported} reportée{reported > 1 ? 's' : ''}</span></>
              )}
            </h2>
            <div className="focus-done-meta">
              en {min} min {sec.toString().padStart(2, '0')} s
              {avg !== null && <> {'·'} moyenne <strong>{avg.toFixed(1)}/5</strong></>}
            </div>

            <div className="focus-done-list">
              {filled.map((r, i) => (
                <div key={`${r.lessonId}-${i}`} className="focus-done-row">
                  <div className="focus-done-row-num">{i + 1}</div>
                  <div className="focus-done-row-main">
                    <div className="focus-done-row-name">{r.lessonName}</div>
                    <div className="focus-done-row-sys">{r.systemName}</div>
                  </div>
                  {r.outcome.kind === 'rated'
                    ? <div className={`focus-done-chip s${r.outcome.score}`}>{r.outcome.score}/5</div>
                    : <div className="focus-done-chip reported">Reportée</div>}
                </div>
              ))}
            </div>

            <Link href="/dashboard" className="focus-done-cta">Retour au tableau de bord</Link>
          </div>
        </div>
      </div>
    )
  }

  // ============ phase === 'session' ============
  if (!current) return null
  const elapsedSec = Math.max(0, Math.round((now - startedAt) / 1000))
  const min = Math.floor(elapsedSec / 60)
  const sec = elapsedSec % 60
  const total = queue.length
  const completedCount = results.filter(r => r !== null).length
  const progressPct = Math.round((completedCount / total) * 100)
  const sysColor = (currentSystem as { color?: string } | undefined)?.color || '#2D6A4F'
  const allFilled = completedCount === total

  let statusLabel = ''
  let statusCls: 'missed' | 'today' | 'fresh' = 'today'
  if (current.due.status === 'missed') {
    statusLabel = `J+${J[current.due.stepIndex]} manqué depuis ${current.due.overdueDays} j`
    statusCls = 'missed'
  } else if (current.due.status === 'fresh') {
    statusLabel = `J+${J[current.due.stepIndex]} · planification libre`
    statusCls = 'fresh'
  } else {
    statusLabel = current.lastScore === null && current.due.stepIndex === 0
      ? `J+0 · nouvelle fiche`
      : `J+${J[current.due.stepIndex]} dû aujourd’hui`
    statusCls = 'today'
  }

  // Détection re-action : la fiche courante est déjà actionnée dans cette session
  const alreadyRated = currentResult !== null && currentResult.outcome.kind === 'rated'
  const alreadyReported = currentResult !== null && currentResult.outcome.kind === 'reported'
  let ratedScore: Score | null = null
  if (currentResult !== null && currentResult.outcome.kind === 'rated') {
    ratedScore = currentResult.outcome.score
  }

  const canPrev = currentIdx > 0
  const canNext = currentIdx + 1 !== queue.length

  return (
    <div className="focus-root">
      {/* TOP BAR */}
      <div className="focus-topbar">
        <div className="focus-brand">
          MedRev <span className="focus-brand-mode">focus</span>
        </div>
        <div className="focus-progress-wrap">
          <div className="focus-progress-bar" aria-hidden="true">
            <div className="focus-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="focus-progress-text">
            <strong>{currentIdx + 1}</strong> / {total}
            <span className="focus-progress-sep">{'·'}</span>
            <span className="focus-progress-time">{min}:{sec.toString().padStart(2, '0')}</span>
          </div>
        </div>
        {allFilled && (
          <button
            type="button"
            className="focus-bilan-cta"
            onClick={() => setPhase('done')}
          >
            Voir le bilan
          </button>
        )}
        <Link href="/dashboard" className="focus-quit" aria-label="Quitter la session">{'×'}</Link>
      </div>

      {/* STAGE : jardin (gauche) + zone card avec flèches (droite) */}
      <div className="focus-stage">

        {/* Zone JARDIN — plante hero XL avec paysage */}
        <div className="focus-garden">
          <FocusPlantHero
            results={results}
            elapsedMs={Math.max(0, now - startedAt)}
            timeToFullMs={TIME_TO_FULL_MS}
            particleBurst={particleBurst}
            comboLevel={combo}
          />
        </div>

        {/* Zone CARD avec flèches latérales */}
        <div className="focus-card-zone">

          {/* Compteur de combo : visible quand combo >= 2 */}
          {combo >= 2 && (() => {
            const tier = combo >= 10 ? 4 : combo >= 6 ? 3 : combo >= 4 ? 2 : 1
            const label = tier === 4 ? 'LÉGENDE' : tier === 3 ? 'EN FEU' : tier === 2 ? 'Bien joué' : 'Combo'
            return (
              <div
                key={`combo-${combo}`}
                className={`focus-combo focus-combo-tier${tier}`}
                aria-live="polite"
              >
                <span className="focus-combo-x">×{combo}</span>
                <span className="focus-combo-label">{label}</span>
              </div>
            )
          })()}

          <button
            type="button"
            className="focus-nav-arrow focus-nav-prev"
            onClick={goPrev}
            disabled={!canPrev}
            aria-label="Fiche précédente"
            title="Fiche précédente (←)"
          >
            {'‹'}
          </button>

          <div className="focus-card">

            <div className="focus-kicker">
            <span className="focus-kicker-dot" style={{ background: sysColor }} />
            <span className="focus-kicker-sys">{currentSystemName}</span>
            <span className="focus-kicker-sep">{'•'}</span>
            <span className={`focus-kicker-status ${statusCls}`}>{statusLabel}</span>
          </div>

          <h1 className="focus-name">{current.lesson.name}</h1>

          {current.lastScore !== null && !alreadyRated && !alreadyReported && (
            <div className="focus-last">
              Dernière note&nbsp;: <span className={`focus-last-pill s${current.lastScore}`}>{current.lastScore}/5</span>
            </div>
          )}

          {/* Badge re-action si déjà notée/reportée dans cette session */}
          {alreadyRated && ratedScore !== null && (
            <div className="focus-rated-badge">
              <span className={`focus-rated-pill s${ratedScore}`}>Notée {ratedScore}/5</span>
              <span className="focus-rated-hint">Tu peux changer si besoin, ou passer à la suivante.</span>
            </div>
          )}
          {alreadyReported && (
            <div className="focus-reported-badge">
              <span className="focus-reported-pill">Reportée à demain</span>
              <span className="focus-rated-hint">Tu peux la noter maintenant si tu changes d’avis.</span>
            </div>
          )}

          {!alreadyRated && !alreadyReported && (
            <div className="focus-ask">Quelle note&nbsp;?</div>
          )}
          <div className="focus-scores">
            {([1, 2, 3, 4, 5] as Score[]).map(n => (
              <button
                key={n}
                type="button"
                className={`focus-score s${n}${alreadyRated && ratedScore === n ? ' selected' : ''}`}
                onClick={() => rate(n)}
                disabled={loading}
                title={`Note ${n}/5 — raccourci ${n}`}
              >
                <span className="focus-score-num">{n}</span>
                <span className="focus-score-lbl">
                  {n === 1 ? 'À revoir' : n === 2 ? 'Faible' : n === 3 ? 'Moyen' : n === 4 ? 'Bien' : 'Maîtrisé'}
                </span>
                <span className="focus-score-key" aria-hidden="true">{n}</span>
              </button>
            ))}
          </div>

          <div className="focus-actions">
            <button
              type="button"
              className="focus-report"
              onClick={report}
              disabled={loading || alreadyReported}
              title={alreadyReported ? 'Déjà reportée' : 'Reporter à demain — raccourci R'}
            >
              {alreadyReported ? 'Déjà reportée' : 'Reporter à demain'}
            </button>
            {canNext && (
              <button
                type="button"
                className="focus-next-inline"
                onClick={goNext}
                title="Fiche suivante (→)"
              >
                Suivante {'›'}
              </button>
            )}
          </div>
          </div>

          <button
            type="button"
            className="focus-nav-arrow focus-nav-next"
            onClick={goNext}
            disabled={!canNext}
            aria-label="Fiche suivante"
            title="Fiche suivante (→)"
          >
            {'›'}
          </button>
        </div>
      </div>

      {/* HINT */}
      <div className="focus-hint">
        <span><kbd>1</kbd>–<kbd>5</kbd> noter</span>
        <span className="focus-hint-sep">{'·'}</span>
        <span><kbd>R</kbd> reporter</span>
        <span className="focus-hint-sep">{'·'}</span>
        <span><kbd>←</kbd><kbd>→</kbd> naviguer</span>
        <span className="focus-hint-sep">{'·'}</span>
        <span><kbd>Esc</kbd> quitter</span>
      </div>
    </div>
  )
}

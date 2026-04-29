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

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import GardenSvg, { GARDEN_TIME_MULTIPLIER, GARDEN_TICK_MS } from '@/components/GardenSvg'
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

// L'arbre pousse TRÈS doucement, sur toute l'année.
// 100h cumulées = pleine maturité (≈ 33 jours à 3h/jour). Au-delà, l'arbre reste à son max
// et continue à se peupler de feuilles via le système de récompenses.
const TIME_TO_FULL_MS = 100 * 60 * 60 * 1000

// Hauteur "réelle" de l'arbre à pleine maturité, pour le recap "L'arbre a poussé de X cm".
const MAX_TREE_CM = 300

// ============ Cycle jour/nuit ============
// Le ciel évolue selon l'heure RÉELLE (pas la durée de session).
// Pendant une session de 1-3h, le soleil/la lune se déplacent visiblement,
// la couleur du ciel change progressivement. Sensation d'être "dans le temps".

type SkyColors = { top: string; upMid: string; loMid: string; bottom: string }

const SKY_KEYFRAMES: Array<{ hour: number } & SkyColors> = [
  { hour: 0,    top: '#0E1828', upMid: '#1A2438', loMid: '#2A3450', bottom: '#1A2438' },
  { hour: 5,    top: '#1F2A4A', upMid: '#3D3A6A', loMid: '#7A4F6A', bottom: '#9A5E68' },
  { hour: 6.5,  top: '#7AA0B8', upMid: '#E8B89C', loMid: '#F0B58C', bottom: '#E5A07C' },
  { hour: 9,    top: '#7AA0B8', upMid: '#B0CCD8', loMid: '#E5D5B0', bottom: '#D8C492' },
  { hour: 13,   top: '#5E94C0', upMid: '#9DC4D8', loMid: '#D5E0C0', bottom: '#C8DCB0' },
  { hour: 17,   top: '#7AA0B8', upMid: '#E5C088', loMid: '#F0B888', bottom: '#D89070' },
  { hour: 18.5, top: '#5A5078', upMid: '#E89A4F', loMid: '#F0CC95', bottom: '#D49080' },
  { hour: 20,   top: '#3A3A60', upMid: '#5A4A7A', loMid: '#7A5A6A', bottom: '#5A4860' },
  { hour: 22,   top: '#1A2438', upMid: '#2A3450', loMid: '#3A4868', bottom: '#2A3450' },
  { hour: 24,   top: '#0E1828', upMid: '#1A2438', loMid: '#2A3450', bottom: '#1A2438' },
]

function lerpHex(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16)
  const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16)
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`
}

function skyAtHour(hour: number): SkyColors {
  const h = ((hour % 24) + 24) % 24
  for (let i = 0; i < SKY_KEYFRAMES.length - 1; i++) {
    const a = SKY_KEYFRAMES[i], b = SKY_KEYFRAMES[i + 1]
    if (h >= a.hour && h < b.hour) {
      const t = (h - a.hour) / (b.hour - a.hour)
      return {
        top: lerpHex(a.top, b.top, t),
        upMid: lerpHex(a.upMid, b.upMid, t),
        loMid: lerpHex(a.loMid, b.loMid, t),
        bottom: lerpHex(a.bottom, b.bottom, t),
      }
    }
  }
  return SKY_KEYFRAMES[0]
}

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
  elapsedMs: number
  timeToFullMs: number
  /** Si true (écran bilan), tige forcée au max et fleur affichée. */
  forceFull?: boolean
}

// Géométrie SVG compacte (viewBox 120x130)
const POT_Y = 110
const STEM_TOP_MIN_Y = 30

// Composant compact utilisé sur l'écran bilan : petite plante générique en pot
// qui grandit avec le temps. La fleur s'ouvre quand forceFull. Pas de feuilles
// liées aux notes — le score n'est plus encodé visuellement.
function FocusPlant({ elapsedMs, timeToFullMs, forceFull = false }: PlantProps) {
  const stemProgress = forceFull
    ? 1
    : Math.max(0, Math.min(1, elapsedMs / timeToFullMs))
  const stemTopY = POT_Y - stemProgress * (POT_Y - STEM_TOP_MIN_Y)

  return (
    <div className="focus-plant-wrap" aria-hidden="true">
      <svg viewBox="0 0 120 130" className="focus-plant-svg" role="img">
        <title>Progression de la session</title>

        {/* Pot */}
        <path d="M 50 110 L 70 110 L 67 125 L 53 125 Z" fill="#A37147" />
        <path d="M 50 110 L 70 110 L 68 108 L 52 108 Z" fill="#7E5630" />
        <ellipse cx="60" cy="108" rx="9" ry="1.5" fill="#5C3A21" />

        {/* Tige */}
        <g
          className="focus-plant-stem-group"
          style={{
            transform: `scaleY(${stemProgress})`,
            transformOrigin: `60px ${POT_Y}px`,
          }}
        >
          <line x1={60} y1={POT_Y} x2={60} y2={STEM_TOP_MIN_Y}
                stroke="#2D6A4F" strokeWidth={2.6} strokeLinecap="round" />
        </g>

        {/* Petites feuilles décoratives le long de la tige (apparaissent avec la croissance) */}
        {[0.35, 0.55, 0.75].map((t, i) => {
          if (stemProgress < t) return null
          const yPos = POT_Y - t * (POT_Y - STEM_TOP_MIN_Y)
          const side = i % 2 === 0 ? -1 : 1
          const cx = 60 + side * 8
          return (
            <g key={`leaf-${i}`} className="focus-plant-leaf">
              <ellipse cx={cx} cy={yPos} rx={7} ry={3} fill="#7AA56B"
                       transform={`rotate(${side * 25} ${cx} ${yPos})`} />
              <ellipse cx={cx} cy={yPos - 0.6} rx={3} ry={1}
                       fill="rgba(255,255,255,0.28)"
                       transform={`rotate(${side * 25} ${cx} ${yPos})`} />
            </g>
          )
        })}

        {/* Fleur au sommet (bilan) */}
        {forceFull && (
          <g className="focus-plant-flower">
            {[0, 72, 144, 216, 288].map(angle => (
              <ellipse key={angle} cx={60} cy={stemTopY - 7}
                       rx={4.2} ry={2.4}
                       transform={`rotate(${angle} 60 ${stemTopY})`}
                       fill="#F4B5C9" opacity={0.92} />
            ))}
            <circle cx={60} cy={stemTopY} r={2.6} fill="#F3D88A" />
          </g>
        )}
      </svg>
    </div>
  )
}

// ===================== GARDEN HERO (écosystème vivant) =====================
// L'arbre central grandit avec le TEMPS écoulé.
// Les éléments du jardin (fleurs, animaux, papillons, étang) se débloquent
// progressivement avec chaque fiche notée — peu importe le score, la complétion
// récompense seule. La séquence est déterministe (UNLOCK_SEQUENCE).

// ============ Définition de la séquence de déblocage ============
type GardenKind =
  | 'flower' | 'sunflower' | 'tulip' | 'mushroom'
  | 'butterfly' | 'rabbit' | 'squirrel' | 'owl' | 'deer' | 'fox'
  | 'pond' | 'sapling' | 'log'

type GardenElement = {
  kind: GardenKind
  x: number
  y: number
  variant?: string
}

// ============ POOLS de positions (système quotidien) ============
// Chaque fiche notée déclenche un tirage aléatoire selon des probabilités.
// Les éléments s'accumulent dans le jardin du jour (persistance localStorage).
// Le jardin se RESET chaque nouveau jour (clé date-suffixée).
//
// Probabilités par fiche notée :
//   60% : fleur (multiples positions/couleurs)
//   25% : insecte (papillons multi-positions)
//   12% : animal (rabbit/squirrel/bird, plusieurs positions chacun)
//    3% : événement rare (pond/deer/owl/fox/big_bloom — cap 1 par jour chacun)

const FLOWER_POOL: GardenElement[] = [
  // Marguerites/wildflowers en foreground (y ~920-945)
  { kind: 'flower', x: 160,  y: 938, variant: 'red' },
  { kind: 'flower', x: 240,  y: 945, variant: 'pink' },
  { kind: 'flower', x: 320,  y: 925, variant: 'white' },
  { kind: 'flower', x: 410,  y: 935, variant: 'yellow' },
  { kind: 'flower', x: 540,  y: 940, variant: 'red' },
  { kind: 'flower', x: 620,  y: 925, variant: 'pink' },
  { kind: 'flower', x: 720,  y: 940, variant: 'orange' },
  { kind: 'flower', x: 820,  y: 925, variant: 'purple' },
  { kind: 'flower', x: 920,  y: 935, variant: 'white' },
  { kind: 'flower', x: 1010, y: 925, variant: 'yellow' },
  { kind: 'flower', x: 1100, y: 940, variant: 'pink' },
  { kind: 'flower', x: 1200, y: 925, variant: 'white' },
  { kind: 'flower', x: 1290, y: 945, variant: 'red' },
  { kind: 'flower', x: 1370, y: 925, variant: 'orange' },
  { kind: 'flower', x: 1450, y: 940, variant: 'purple' },
  { kind: 'flower', x: 1540, y: 935, variant: 'pink' },
  // Cherry-blossoms / fleurs hautes près du grass top (y ~870-885)
  { kind: 'flower', x: 200,  y: 870, variant: 'pink' },
  { kind: 'flower', x: 350,  y: 880, variant: 'white' },
  { kind: 'flower', x: 950,  y: 880, variant: 'pink' },
  { kind: 'flower', x: 1140, y: 875, variant: 'red' },
  // Tulipes (taller stems)
  { kind: 'tulip',  x: 220,  y: 800, variant: 'red' },
  { kind: 'tulip',  x: 540,  y: 825, variant: 'yellow' },
  { kind: 'tulip',  x: 1140, y: 800, variant: 'purple' },
  { kind: 'tulip',  x: 480,  y: 945, variant: 'red' },
  // Tournesols
  { kind: 'sunflower', x: 580,  y: 920 },
  { kind: 'sunflower', x: 1280, y: 935 },
]

const INSECT_POOL: GardenElement[] = [
  { kind: 'butterfly', x: 640,  y: 400, variant: 'amber' },
  { kind: 'butterfly', x: 820,  y: 520, variant: 'blue' },
  { kind: 'butterfly', x: 1000, y: 300, variant: 'purple' },
  { kind: 'butterfly', x: 380,  y: 600, variant: 'amber' },
  { kind: 'butterfly', x: 1100, y: 600, variant: 'amber' },
  { kind: 'butterfly', x: 550,  y: 350, variant: 'blue' },
  { kind: 'butterfly', x: 720,  y: 480, variant: 'purple' },
  { kind: 'butterfly', x: 900,  y: 380, variant: 'amber' },
  { kind: 'butterfly', x: 280,  y: 480, variant: 'blue' },
  { kind: 'butterfly', x: 1180, y: 460, variant: 'purple' },
]

// Animaux : plusieurs positions de la MÊME espèce sont autorisées (lapins multiples OK)
const ANIMAL_POOL: GardenElement[] = [
  { kind: 'rabbit',   x: 200,  y: 870 },
  { kind: 'rabbit',   x: 1280, y: 870 },
  { kind: 'rabbit',   x: 450,  y: 880 },
  { kind: 'rabbit',   x: 1500, y: 875 },
  { kind: 'mushroom', x: 140,  y: 905, variant: 'red' },
  { kind: 'mushroom', x: 1380, y: 920, variant: 'orange' },
  { kind: 'mushroom', x: 250,  y: 950, variant: 'red' },
  { kind: 'mushroom', x: 1480, y: 870, variant: 'red' },
  { kind: 'mushroom', x: 980,  y: 945, variant: 'orange' },
  { kind: 'sapling',  x: 720,  y: 700 },
  { kind: 'sapling',  x: 1340, y: 720 },
  { kind: 'sapling',  x: 280,  y: 710 },
]

// Événements rares : positions multiples pour certaines espèces (deer, owl, fox, squirrel
// peuvent apparaître plusieurs fois sur l'année). Pond et log restent uniques (1 seul logique).
const RARE_POOL: GardenElement[] = [
  { kind: 'pond',     x: 1180, y: 820 },        // unique (1 étang dans le jardin)
  { kind: 'log',      x: 880,  y: 700 },        // unique (1 tronc tombé)
  // Daims : 3 spots possibles dans la prairie/colline
  { kind: 'deer',     x: 880,  y: 712 },
  { kind: 'deer',     x: 1120, y: 700 },
  { kind: 'deer',     x: 760,  y: 720 },
  // Hiboux : 2 spots sur les branches hautes
  { kind: 'owl',      x: 660,  y: 542 },
  { kind: 'owl',      x: 540,  y: 460 },
  // Renards : 2 spots dans les bords
  { kind: 'fox',      x: 100,  y: 850 },
  { kind: 'fox',      x: 1500, y: 870 },
  // Écureuils : 3 spots dans/sur l'arbre central
  { kind: 'squirrel', x: 620,  y: 542 },
  { kind: 'squirrel', x: 360,  y: 600 },
  { kind: 'squirrel', x: 720,  y: 480 },
]
const RARE_KIND_SET = new Set(RARE_POOL.map(p => p.kind))

// ============ Tirage d'un seul élément (jardin annuel : doit rester clairsemé) ============
// Chaque fiche notée a une probabilité de faire apparaître UN nouvel élément.
// Sur l'année (~2000 fiches), on veut un jardin riche mais pas saturé.
//
// Probabilités par fiche notée :
//    50% : RIEN (juste l'arbre qui pousse un peu)
//    30% : une fleur
//    12% : un insecte
//     6% : un animal courant
//     2% : un événement rare (cap par positions disponibles)

function pickFromPool(pool: GardenElement[], existing: GardenElement[]): GardenElement | null {
  const taken = new Set(existing.map(e => `${e.kind}:${e.x},${e.y}`))
  const available = pool.filter(p => !taken.has(`${p.kind}:${p.x},${p.y}`))
  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)]
  }
  // Pool plein : on jitter une position aléatoire pour densifier sans collision parfaite
  const p = pool[Math.floor(Math.random() * pool.length)]
  return {
    ...p,
    x: p.x + (Math.random() - 0.5) * 24,
    y: p.y + (Math.random() - 0.5) * 10,
  }
}

function pickElement(existing: GardenElement[]): GardenElement | null {
  const r = Math.random()
  // 50% : RIEN — la fiche n'apporte que la croissance silencieuse de l'arbre
  if (r < 0.50) return null
  // 30% : fleur
  if (r < 0.80) {
    return pickFromPool(FLOWER_POOL, existing)
  }
  // 12% : insecte
  if (r < 0.92) {
    return pickFromPool(INSECT_POOL, existing)
  }
  // 6% : animal courant
  if (r < 0.98) {
    return pickFromPool(ANIMAL_POOL, existing)
  }
  // 2% : événement rare (positions multiples par espèce, on filtre ce qui est pris)
  const taken = new Set(existing.map(e => `${e.kind}:${e.x},${e.y}`))
  const availRares = RARE_POOL.filter(p => !taken.has(`${p.kind}:${p.x},${p.y}`))
  if (availRares.length > 0) {
    return availRares[Math.floor(Math.random() * availRares.length)]
  }
  // Toutes les positions rares prises : fallback fleur
  return pickFromPool(FLOWER_POOL, existing)
}

// ============ Persistance ANNUELLE (jardin cultivé sur toute l'année) ============
// Single key 'medrev-garden' — jamais reset. Le jardin grandit avec le temps.
type DayGardenState = {
  startedDate?: string       // date de la première session (info)
  elapsedMs: number          // temps cumulé total (sur l'année)
  fichesCount: number        // nombre total de fiches notées (sur l'année)
  elements: GardenElement[]  // tous les éléments accumulés
}

const GARDEN_KEY_BASE = 'medrev-garden'
const LEGACY_KEY_PREFIX = 'medrev-garden-' // ancien format date-suffixé

// Clé localStorage suffixée par userId pour ISOLER les jardins par compte.
// Sans userId (avant auth) on retourne null pour ne rien écrire/lire.
function gardenKey(userId: string | null): string | null {
  if (!userId) return null
  return GARDEN_KEY_BASE + '-' + userId
}

function loadDayGarden(today: string, userId: string | null): DayGardenState {
  const empty: DayGardenState = { startedDate: today, elapsedMs: 0, fichesCount: 0, elements: [] }
  if (typeof window === 'undefined') return empty
  const key = gardenKey(userId)
  if (!key) return empty
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DayGardenState>
      return {
        startedDate: parsed.startedDate ?? today,
        elapsedMs: parsed.elapsedMs ?? 0,
        fichesCount: parsed.fichesCount ?? 0,
        elements: parsed.elements ?? [],
      }
    }
    // Pas de jardin pour CE user → nouveau, on commence avec un jardin vide.
    // Cleanup des anciennes clés non-userId au passage (héritage des tests).
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (k === GARDEN_KEY_BASE) {
        localStorage.removeItem(k)
      } else if (k && k.startsWith(LEGACY_KEY_PREFIX) && !k.endsWith('-' + userId)) {
        // Ancienne clé date-suffixée ou clé d'un autre user — on ne touche pas (c'est leur jardin).
        // Ici on ne supprime rien pour préserver les autres comptes.
      }
    }
    return empty
  } catch {
    return empty
  }
}

function saveDayGarden(state: DayGardenState, userId: string | null) {
  if (typeof window === 'undefined') return
  const key = gardenKey(userId)
  if (!key) return
  try {
    localStorage.setItem(key, JSON.stringify(state))
  } catch {
    // ignore quota errors
  }
}

// ============ Sync cloud (Supabase) ============
// Cible : table `gardens` (cf. migration-garden.sql) — UNE ligne par user_id.
// Stratégie :
//   - Au load : on lit en parallèle localStorage + Supabase, on merge (max
//     compteurs, union elements).
//   - Au save : on écrit toujours localStorage (instant) + on push Supabase
//     en best-effort (on ne bloque pas l'UI si réseau coupé).
// Un éventuel échec réseau ne casse jamais l'UX : la prochaine sauvegarde
// rattrape, et le user garde son jardin grâce à localStorage.

type SbClient = ReturnType<typeof createClient>

async function pullGardenFromSupabase(supabase: SbClient, userId: string): Promise<DayGardenState | null> {
  try {
    const { data, error } = await supabase
      .from('gardens')
      .select('started_date, elapsed_ms, fiches_count, elements')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return null
    return {
      startedDate: (data as any).started_date ?? undefined,
      elapsedMs: Number((data as any).elapsed_ms ?? 0),
      fichesCount: Number((data as any).fiches_count ?? 0),
      elements: ((data as any).elements as GardenElement[]) ?? [],
    }
  } catch {
    return null
  }
}

function pushGardenToSupabase(supabase: SbClient, userId: string | null, state: DayGardenState): void {
  if (!userId) return
  // Fire-and-forget : on ne bloque pas l'UI. Les erreurs réseau sont silencieuses.
  void supabase
    .from('gardens')
    .upsert(
      {
        user_id: userId,
        started_date: state.startedDate ?? null,
        elapsed_ms: state.elapsedMs,
        fiches_count: state.fichesCount,
        elements: state.elements,
      },
      { onConflict: 'user_id' }
    )
    .then(() => { /* ok */ }, () => { /* swallow */ })
}

function elementKey(e: GardenElement): string {
  return e.kind + '|' + e.x + '|' + e.y + '|' + (e.variant ?? '')
}

function mergeGardenStates(a: DayGardenState, b: DayGardenState): DayGardenState {
  // Le jardin ne décroît jamais : on garde le max des compteurs et l'union
  // des éléments (par tuple kind+x+y+variant).
  const seen = new Set<string>()
  const elements: GardenElement[] = []
  for (const e of a.elements) {
    const k = elementKey(e)
    if (seen.has(k)) continue
    seen.add(k); elements.push(e)
  }
  for (const e of b.elements) {
    const k = elementKey(e)
    if (seen.has(k)) continue
    seen.add(k); elements.push(e)
  }
  let startedDate: string | undefined
  if (a.startedDate && b.startedDate) startedDate = a.startedDate < b.startedDate ? a.startedDate : b.startedDate
  else startedDate = a.startedDate ?? b.startedDate
  return {
    startedDate,
    elapsedMs: Math.max(a.elapsedMs, b.elapsedMs),
    fichesCount: Math.max(a.fichesCount, b.fichesCount),
    elements,
  }
}

// Stats agrégées dérivées d'une slice de la séquence (ignore les null)
type GardenStats = { fleurs: number; animaux: number; papillons: number }
function statsFor(unlocked: (GardenElement | null)[]): GardenStats {
  let fleurs = 0, animaux = 0, papillons = 0
  unlocked.forEach(e => {
    if (!e) return
    if (e.kind === 'flower' || e.kind === 'sunflower' || e.kind === 'tulip') fleurs++
    else if (e.kind === 'butterfly') papillons++
    else if (e.kind === 'rabbit' || e.kind === 'squirrel' || e.kind === 'owl' || e.kind === 'deer' || e.kind === 'fox') animaux++
  })
  return { fleurs, animaux, papillons }
}

const FLOWER_COLORS: Record<string, string> = {
  red: '#C75050', yellow: '#FBD56B', pink: '#F4B5C9',
  orange: '#E89A4F', purple: '#9C68B0', white: '#FFE5DD',
}
const BUTTERFLY_COLORS: Record<string, [string, string]> = {
  amber: ['#E89A4F', '#FBD56B'],
  blue:  ['#7AA8E0', '#A8C8E8'],
  purple:['#9C68B0', '#D5B0E0'],
}

// Branches du tronc principal (apparaissent à des paliers de progression temporelle)
type HeroBranch = {
  threshold: number
  thickPath: string  // path "outer" épais
  innerPath: string  // path "inner" plus clair par-dessus
  subPaths?: string[]  // sub-branches plus fines
}

// Toutes les coordonnées sont en repère local de l'arbre (origine = base du tronc).
const HERO_BRANCHES: HeroBranch[] = [
  {
    threshold: 0.18,
    thickPath: 'M -12 -180 Q -90 -210 -180 -200 Q -235 -195 -270 -185',
    innerPath: 'M -12 -180 Q -90 -210 -180 -200 Q -235 -195 -270 -185',
    subPaths: ['M -180 -200 Q -220 -240 -260 -250', 'M -220 -195 Q -260 -180 -300 -160', 'M -180 -200 Q -180 -160 -195 -130'],
  },
  {
    threshold: 0.34,
    thickPath: 'M 14 -250 Q 90 -240 180 -210 Q 240 -185 280 -160',
    innerPath: 'M 14 -250 Q 90 -240 180 -210 Q 240 -185 280 -160',
    subPaths: ['M 180 -210 Q 235 -255 280 -290', 'M 240 -185 Q 295 -195 340 -195', 'M 250 -180 Q 260 -130 280 -90'],
  },
  {
    threshold: 0.50,
    thickPath: 'M -10 -340 Q -70 -360 -150 -345 Q -200 -335 -240 -320',
    innerPath: 'M -10 -340 Q -70 -360 -150 -345 Q -200 -335 -240 -320',
    subPaths: ['M -150 -345 Q -185 -395 -210 -440', 'M -200 -335 Q -260 -355 -300 -360'],
  },
  {
    threshold: 0.66,
    thickPath: 'M 11 -400 Q 70 -420 150 -440 Q 200 -455 240 -465',
    innerPath: 'M 11 -400 Q 70 -420 150 -440 Q 200 -455 240 -465',
    subPaths: ['M 150 -440 Q 190 -480 220 -510', 'M 210 -460 Q 260 -475 295 -490'],
  },
  {
    threshold: 0.82,
    thickPath: 'M 0 -460 Q -30 -510 -85 -540 Q -130 -565 -160 -575',
    innerPath: 'M 0 -460 Q -30 -510 -85 -540 Q -130 -565 -160 -575',
    subPaths: ['M -85 -540 Q -95 -580 -110 -610', 'M 0 -460 Q 40 -490 80 -540', 'M 80 -540 Q 120 -555 160 -560'],
  },
]

// Foliage clusters (un par branche, mêmes seuils)
type FoliageCluster = {
  threshold: number
  back: { cx: number; cy: number; rx: number; ry: number; fill: string }[]
  mid: { cx: number; cy: number; rx: number; ry: number }[]
  front: { cx: number; cy: number; rx: number; ry: number }[]
}
const HERO_FOLIAGE: FoliageCluster[] = [
  {
    threshold: 0.18,
    back: [
      { cx: -220, cy: -200, rx: 84, ry: 68, fill: '#2F4438' },
      { cx: -260, cy: -180, rx: 64, ry: 52, fill: '#3F5E4A' },
      { cx: -280, cy: -220, rx: 58, ry: 46, fill: '#3F5E4A' },
      { cx: -200, cy: -160, rx: 52, ry: 44, fill: '#4A6E55' },
      { cx: -300, cy: -160, rx: 46, ry: 40, fill: '#3F5E4A' },
    ],
    mid: [
      { cx: -205, cy: -205, rx: 70, ry: 54 },
      { cx: -245, cy: -185, rx: 52, ry: 42 },
      { cx: -265, cy: -225, rx: 46, ry: 36 },
      { cx: -185, cy: -165, rx: 42, ry: 34 },
    ],
    front: [
      { cx: -195, cy: -215, rx: 40, ry: 30 },
      { cx: -235, cy: -200, rx: 32, ry: 24 },
      { cx: -265, cy: -235, rx: 28, ry: 22 },
    ],
  },
  {
    threshold: 0.34,
    back: [
      { cx: 220, cy: -220, rx: 98, ry: 78, fill: '#2F4438' },
      { cx: 280, cy: -180, rx: 74, ry: 58, fill: '#3F5E4A' },
      { cx: 280, cy: -260, rx: 64, ry: 52, fill: '#4A6E55' },
      { cx: 340, cy: -220, rx: 56, ry: 46, fill: '#3F5E4A' },
      { cx: 200, cy: -160, rx: 54, ry: 46, fill: '#4A6E55' },
    ],
    mid: [
      { cx: 225, cy: -225, rx: 80, ry: 62 },
      { cx: 285, cy: -185, rx: 60, ry: 48 },
      { cx: 285, cy: -265, rx: 52, ry: 42 },
      { cx: 345, cy: -225, rx: 46, ry: 38 },
      { cx: 205, cy: -165, rx: 44, ry: 36 },
    ],
    front: [
      { cx: 215, cy: -235, rx: 48, ry: 36 },
      { cx: 275, cy: -200, rx: 36, ry: 28 },
      { cx: 280, cy: -275, rx: 32, ry: 24 },
      { cx: 345, cy: -235, rx: 28, ry: 22 },
    ],
  },
  {
    threshold: 0.50,
    back: [
      { cx: -200, cy: -360, rx: 92, ry: 72, fill: '#2F4438' },
      { cx: -260, cy: -340, rx: 66, ry: 56, fill: '#3F5E4A' },
      { cx: -260, cy: -400, rx: 58, ry: 48, fill: '#4A6E55' },
      { cx: -310, cy: -360, rx: 52, ry: 44, fill: '#3F5E4A' },
    ],
    mid: [
      { cx: -185, cy: -365, rx: 76, ry: 58 },
      { cx: -245, cy: -345, rx: 54, ry: 44 },
      { cx: -245, cy: -405, rx: 48, ry: 38 },
      { cx: -295, cy: -365, rx: 42, ry: 34 },
    ],
    front: [
      { cx: -175, cy: -375, rx: 44, ry: 32 },
      { cx: -235, cy: -355, rx: 32, ry: 26 },
      { cx: -245, cy: -415, rx: 28, ry: 22 },
    ],
  },
  {
    threshold: 0.66,
    back: [
      { cx: 220, cy: -460, rx: 88, ry: 72, fill: '#2F4438' },
      { cx: 280, cy: -490, rx: 62, ry: 54, fill: '#3F5E4A' },
      { cx: 270, cy: -440, rx: 58, ry: 48, fill: '#4A6E55' },
      { cx: 180, cy: -510, rx: 54, ry: 46, fill: '#3F5E4A' },
    ],
    mid: [
      { cx: 225, cy: -465, rx: 72, ry: 58 },
      { cx: 285, cy: -495, rx: 50, ry: 44 },
      { cx: 275, cy: -445, rx: 46, ry: 40 },
      { cx: 185, cy: -515, rx: 44, ry: 36 },
    ],
    front: [
      { cx: 215, cy: -475, rx: 42, ry: 32 },
      { cx: 285, cy: -505, rx: 30, ry: 24 },
      { cx: 275, cy: -455, rx: 28, ry: 22 },
    ],
  },
  {
    threshold: 0.82,
    back: [
      { cx: -130, cy: -580, rx: 74, ry: 62, fill: '#2F4438' },
      { cx: -170, cy: -610, rx: 54, ry: 46, fill: '#4A6E55' },
      { cx: -90, cy: -620, rx: 50, ry: 42, fill: '#3F5E4A' },
      { cx: 80, cy: -560, rx: 64, ry: 54, fill: '#3F5E4A' },
      { cx: 140, cy: -580, rx: 50, ry: 44, fill: '#4A6E55' },
    ],
    mid: [
      { cx: -115, cy: -585, rx: 60, ry: 50 },
      { cx: -155, cy: -615, rx: 44, ry: 38 },
      { cx: -75, cy: -625, rx: 40, ry: 34 },
      { cx: 95, cy: -565, rx: 52, ry: 44 },
      { cx: 155, cy: -585, rx: 42, ry: 36 },
    ],
    front: [
      { cx: -105, cy: -595, rx: 36, ry: 28 },
      { cx: -155, cy: -625, rx: 26, ry: 22 },
      { cx: 105, cy: -575, rx: 32, ry: 26 },
    ],
  },
]

// ============ Composant FocusGarden ============
type GardenProps = {
  elements: GardenElement[]
  elapsedMs: number
  timeToFullMs: number
  /** Timestamp courant pour calculer l'heure du jour (cycle jour/nuit). */
  nowMs?: number
  particleBurst?: { ts: number; x?: number; y?: number } | null
  forceFull?: boolean
}

// Coordonnées de l'arbre central dans le viewBox 1600x1000
const HERO_TRUNK_X = 440
const HERO_GROUND_Y = 750

// Calcul d'un point sur une courbe de Bézier quadratique
function FocusGarden({ elements, elapsedMs, timeToFullMs, nowMs, particleBurst, forceFull = false }: GardenProps) {
  // Délégué à <GardenSvg> (composant partagé) pour un rendu unifié focus + dashboard.
  // injectStyles=false : focus-styles.css fournit déjà les @keyframes (cloud-drift,
  // wing-flap, star-twinkle, particle-fly), pas besoin de les dupliquer en inline.
  return (
    <GardenSvg
      elements={elements}
      elapsedMs={elapsedMs}
      timeToFullMs={timeToFullMs}
      nowMs={nowMs}
      forceFull={forceFull}
      particleBurst={particleBurst}
      className="focus-garden-svg"
      timeMultiplier={GARDEN_TIME_MULTIPLIER}
      injectStyles={false}
    />
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

  // Burst de particules : ts incrémenté à chaque rate pour re-déclencher l'anim CSS.
  // Position optionnelle (x, y) en coords viewBox jardin.
  const [particleBurst, setParticleBurst] = useState<{ ts: number; x?: number; y?: number } | null>(null)

  const today = new Date().toISOString().split('T')[0]

  // ============ ÉTAT JARDIN PERSISTANT (annuel) ============
  // Persisté en localStorage avec clé 'medrev-garden' (sans date). Cultivé toute l'année.
  // elapsedMs cumulé sur l'ensemble de l'année. Jamais reset.
  const [dayGarden, setDayGarden] = useState<DayGardenState>({ startedDate: today, elapsedMs: 0, fichesCount: 0, elements: [] })
  const [cumElapsedAtStart, setCumElapsedAtStart] = useState(0)
  // Stocke le nombre d'éléments dans le jardin AU DÉMARRAGE de la session courante.
  // Utilisé pour le recap de fin : permet de calculer ce qui a été ajouté pendant cette session.
  const [sessionStartElementCount, setSessionStartElementCount] = useState(0)
  const dayGardenRef = useRef<DayGardenState>(dayGarden)
  useEffect(() => { dayGardenRef.current = dayGarden }, [dayGarden])

  // Reset scroll au montage
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo(0, 0)
    const main = document.querySelector('main')
    if (main) main.scrollTop = 0
  }, [])

  // Ref vers userId pour les saves dans des cleanups (besoin valeur courante)
  const userIdRef = useRef<string | null>(null)
  useEffect(() => { userIdRef.current = userId }, [userId])

  // Chargement initial : auth → puis jardin du user → puis data/queue
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // 1) Auth Supabase d'abord (pour avoir userId avant de charger le jardin)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      if (cancelled) return
      setUserId(user.id)
      userIdRef.current = user.id

      // 2) Charger le jardin persisté DE CE USER :
      //    - localStorage en premier (instant, hors-ligne friendly)
      //    - puis Supabase (cloud), et on merge si la version cloud est différente.
      //    Le merge prend le max des compteurs + l'union des éléments :
      //    le jardin grandit toujours, jamais ne décroît.
      const localGarden = loadDayGarden(today, user.id)
      if (!cancelled) {
        setDayGarden(localGarden)
        dayGardenRef.current = localGarden
        setCumElapsedAtStart(localGarden.elapsedMs)
        setSessionStartElementCount(localGarden.elements.length)
      }
      // Pull cloud (best-effort) + merge. Si pas de réseau ou pas encore de
      // ligne en DB, on reste sur le localGarden (et on pushera plus tard).
      const cloudGarden = await pullGardenFromSupabase(supabase, user.id)
      if (cancelled) return
      if (cloudGarden) {
        const merged = mergeGardenStates(localGarden, cloudGarden)
        setDayGarden(merged)
        dayGardenRef.current = merged
        setCumElapsedAtStart(merged.elapsedMs)
        setSessionStartElementCount(merged.elements.length)
        saveDayGarden(merged, user.id)
        // Si le merge diffère du cloud, on pousse pour que les autres devices voient
        // tout de suite l'état le plus récent.
        if (
          merged.elapsedMs !== cloudGarden.elapsedMs ||
          merged.fichesCount !== cloudGarden.fichesCount ||
          merged.elements.length !== cloudGarden.elements.length
        ) {
          pushGardenToSupabase(supabase, user.id, merged)
        }
      } else {
        // Aucune ligne cloud : on initialise avec le state local
        // (utile pour les comptes existants qui n'avaient que localStorage).
        if (localGarden.elapsedMs > 0 || localGarden.elements.length > 0 || localGarden.fichesCount > 0) {
          pushGardenToSupabase(supabase, user.id, localGarden)
        }
      }

      // 3) Données fiches/matières
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

  // Sauvegarde périodique de l'elapsed cumul (toutes les 30s) pour ne pas perdre
  // le temps écoulé si l'utilisateur ferme l'onglet. Push aussi Supabase.
  useEffect(() => {
    if (phase !== 'session') return
    const intv = setInterval(() => {
      const totalElapsed = cumElapsedAtStart + Math.max(0, Date.now() - startedAt)
      const next: DayGardenState = { ...dayGardenRef.current, elapsedMs: totalElapsed }
      dayGardenRef.current = next
      saveDayGarden(next, userIdRef.current)
      pushGardenToSupabase(supabase, userIdRef.current, next)
    }, 30000)
    return () => clearInterval(intv)
  }, [phase, cumElapsedAtStart, startedAt, supabase])

  // Sauvegarde finale au démontage de la page (localStorage + push cloud best-effort)
  useEffect(() => {
    return () => {
      if (startedAt === 0) return
      const totalElapsed = cumElapsedAtStart + Math.max(0, Date.now() - startedAt)
      const finalState: DayGardenState = { ...dayGardenRef.current, elapsedMs: totalElapsed }
      saveDayGarden(finalState, userIdRef.current)
      pushGardenToSupabase(supabase, userIdRef.current, finalState)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tick chrono en mode session
  useEffect(() => {
    if (phase !== 'session') return
    // Tick GARDEN_TICK_MS=100ms pour un mouvement fluide du soleil/lune en arc
    // de cercle (vs 1000ms qui rendait le déplacement saccadé avec le cycle
    // accéléré). Re-render léger : SVG sans state interne.
    const t = setInterval(() => setNow(Date.now()), GARDEN_TICK_MS)
    return () => clearInterval(t)
  }, [phase])

  const current = queue[currentIdx]
  const currentSystem = current ? systems.find(s => s.id === current.lesson.system_id) : undefined
  const currentSystemName = currentSystem?.name ?? 'Matière'
  const currentResult = results[currentIdx] ?? null

  // Stats agrégées dérivées du jardin du jour (cumulatif sur la journée)
  const dayFichesCount = dayGarden.fichesCount
  const gardenStats = statsFor(dayGarden.elements)

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

    // Burst de particules gold à chaque rate — feedback générique de complétion.
    // Position : sur le nouvel élément si on en gagne un, sinon sur l'arbre central.
    // Le score n'a pas d'incidence visuelle.
    let burstX: number | undefined
    let burstY: number | undefined

    // Sur PREMIÈRE notation : 50% de chance que rien n'apparaisse (juste l'arbre pousse),
    // sinon tirage d'UN seul élément (fleur 30% / insecte 12% / animal 6% / rare 2%).
    // Re-rating ne déclenche pas (pas de farming).
    if (wasEmpty) {
      const totalElapsed = cumElapsedAtStart + Math.max(0, Date.now() - startedAt)
      const newEl = pickElement(dayGardenRef.current.elements)
      if (newEl) {
        // Burst à la position exacte du nouvel élément.
        burstX = newEl.x
        burstY = newEl.y
      }
      const updatedGarden: DayGardenState = {
        ...dayGardenRef.current,
        elapsedMs: totalElapsed,
        fichesCount: dayGardenRef.current.fichesCount + 1,
        elements: newEl
          ? [...dayGardenRef.current.elements, newEl]
          : dayGardenRef.current.elements,
      }
      dayGardenRef.current = updatedGarden
      setDayGarden(updatedGarden)
      saveDayGarden(updatedGarden, userIdRef.current)
      // Push cloud immédiat : si l'utilisateur change d'appareil juste après,
      // il retrouve sa dernière fleur tout de suite.
      pushGardenToSupabase(supabase, userIdRef.current, updatedGarden)
    }

    // Pas d'élément généré (re-rating, tirage à vide, ou élément hors zone) →
    // burst sur l'arbre central (mi-hauteur du tronc).
    if (burstX === undefined || burstY === undefined) {
      burstX = HERO_TRUNK_X
      burstY = HERO_GROUND_Y - 200
    }
    setParticleBurst({ ts: Date.now(), x: burstX, y: burstY })

    // Avance seulement si la fiche n'avait jamais été actionnée dans cette session
    if (wasEmpty) {
      const next = findNextEmptyIdx(newResults, currentIdx)
      if (next === -1) setPhase('done')
      else setCurrentIdx(next)
    }
    // Si re-rating : on reste sur la fiche, l'utilisateur peut vérifier ou naviguer.

    setLoading(false)
  }, [current, loading, phase, currentIdx, results, supabase, today, currentSystemName, startedAt, cumElapsedAtStart])

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

    // ============ Recap session ============
    // Croissance "physique" de l'arbre cette session (en cm)
    const sessionElapsedMs = Math.max(0, now - startedAt)
    const sessionGrowthCm = (sessionElapsedMs / TIME_TO_FULL_MS) * MAX_TREE_CM
    // Éléments ajoutés au jardin pendant cette session (slice depuis le mark de début)
    const sessionGains = dayGarden.elements.slice(sessionStartElementCount)
    // Décomposition : fleurs / papillons / animaux courants / événements rares
    const sessionFlowers = sessionGains.filter(e => e.kind === 'flower' || e.kind === 'tulip' || e.kind === 'sunflower').length
    const sessionButterflies = sessionGains.filter(e => e.kind === 'butterfly').length
    const sessionRareCount = sessionGains.filter(e => RARE_KIND_SET.has(e.kind)).length
    const sessionCommonAnimals = sessionGains.length - sessionFlowers - sessionButterflies - sessionRareCount

    return (
      <div className="focus-root">
        {/* TOP BAR (overlay glass sur le ciel) */}
        <div className="focus-topbar">
          <div className="focus-brand">
            <span className="focus-brand-dot" aria-hidden="true" />
            MedRev <span className="focus-brand-mode">focus</span>
          </div>
          <div className="focus-topbar-right">
            <Link href="/dashboard" className="focus-quit" aria-label="Quitter">{'×'}</Link>
          </div>
        </div>

        <div className="focus-stage">

          {/* JARDIN visible en fond — montre le VRAI progrès cumulé du user
              (l'arbre apparaît à sa taille réelle, pas forcée en pleine maturité) */}
          <div className="focus-garden">
            <FocusGarden
              elements={dayGarden.elements}
              elapsedMs={cumElapsedAtStart + Math.max(0, now - startedAt)}
              timeToFullMs={TIME_TO_FULL_MS}
              nowMs={now}
            />
          </div>

          {/* CARD bilan à GAUCHE pour laisser le jardin visible à droite */}
          <div className="focus-card-zone focus-card-zone-bilan">
            <div className="focus-card focus-done-card">
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

              {/* Recap croissance arbre + gains du jardin pendant la session */}
              <div className="focus-done-recap">
                <div className="focus-done-recap-row">
                  <span className="focus-done-recap-icon" aria-hidden="true">{'\u{1F33F}'}</span>
                  <span className="focus-done-recap-text">
                    L&apos;arbre a poussé de <strong>{sessionGrowthCm.toFixed(1)} cm</strong>
                  </span>
                </div>
                {sessionGains.length > 0 ? (
                  <div className="focus-done-recap-gains">
                    <div className="focus-done-recap-gains-lbl">Ajouté à ton jardin</div>
                    <div className="focus-done-recap-gains-row">
                      {sessionFlowers > 0 && (
                        <span className="focus-done-recap-pill"><strong>{sessionFlowers}</strong> {sessionFlowers > 1 ? 'fleurs' : 'fleur'}</span>
                      )}
                      {sessionButterflies > 0 && (
                        <span className="focus-done-recap-pill"><strong>{sessionButterflies}</strong> {sessionButterflies > 1 ? 'papillons' : 'papillon'}</span>
                      )}
                      {sessionCommonAnimals > 0 && (
                        <span className="focus-done-recap-pill"><strong>{sessionCommonAnimals}</strong> {sessionCommonAnimals > 1 ? 'animaux' : 'animal'}</span>
                      )}
                      {sessionRareCount > 0 && (
                        <span className="focus-done-recap-pill rare"><strong>{sessionRareCount}</strong> {sessionRareCount > 1 ? 'événements rares' : 'événement rare'}</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="focus-done-recap-empty">Pas de nouvel élément cette fois — l&apos;arbre a quand même profité de la session.</div>
                )}
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

          {/* Stats du jardin annuel, gardées visibles en bas-droite */}
          <div className="focus-garden-stats focus-garden-stats-right" aria-live="polite">
            <div className="focus-garden-stats-kicker">Ton jardin (cumulé)</div>
            <div className="focus-garden-stats-row">
              <span className="focus-garden-stats-item">
                <span className="focus-garden-stats-num">{dayGarden.fichesCount}</span>
                <span className="focus-garden-stats-lbl">{dayGarden.fichesCount > 1 ? 'fiches' : 'fiche'}</span>
              </span>
              <span className="focus-garden-stats-sep">·</span>
              <span className="focus-garden-stats-item">
                <span className="focus-garden-stats-num">{gardenStats.fleurs}</span>
                <span className="focus-garden-stats-lbl">{gardenStats.fleurs > 1 ? 'fleurs' : 'fleur'}</span>
              </span>
              <span className="focus-garden-stats-item">
                <span className="focus-garden-stats-num">{gardenStats.animaux}</span>
                <span className="focus-garden-stats-lbl">{gardenStats.animaux > 1 ? 'animaux' : 'animal'}</span>
              </span>
              <span className="focus-garden-stats-item">
                <span className="focus-garden-stats-num">{gardenStats.papillons}</span>
                <span className="focus-garden-stats-lbl">{gardenStats.papillons > 1 ? 'papillons' : 'papillon'}</span>
              </span>
            </div>
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
      {/* TOP BAR (overlay glass sur le ciel) */}
      <div className="focus-topbar">
        <div className="focus-brand">
          <span className="focus-brand-dot" aria-hidden="true" />
          MedRev <span className="focus-brand-mode">focus</span>
        </div>
        <div className="focus-topbar-right">
          <div className="focus-progress-chip" aria-label={`Fiche ${currentIdx + 1} sur ${total}`}>
            <span className="focus-progress-chip-lbl">Fiche</span>
            <strong className="focus-progress-chip-num">{currentIdx + 1}</strong>
            <span className="focus-progress-chip-slash">/</span>
            <span className="focus-progress-chip-tot">{total}</span>
            <span className="focus-progress-chip-divider" aria-hidden="true" />
            <span className="focus-progress-chip-time">{min}:{sec.toString().padStart(2, '0')}</span>
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
      </div>

      {/* STAGE : jardin (gauche) + zone card avec flèches (droite) */}
      <div className="focus-stage">

        {/* Zone JARDIN — écosystème vivant qui se peuple par fiches notées */}
        <div className="focus-garden">
          <FocusGarden
            elements={dayGarden.elements}
            elapsedMs={cumElapsedAtStart + Math.max(0, now - startedAt)}
            timeToFullMs={TIME_TO_FULL_MS}
            nowMs={now}
            particleBurst={particleBurst}
          />
        </div>

        {/* Stats du jardin (bottom-left, glass) — montre l'écosystème qui se peuple */}
        <div className="focus-garden-stats" aria-live="polite">
          <div className="focus-garden-stats-kicker">Ton jardin du jour</div>
          <div className="focus-garden-stats-row">
            <span className="focus-garden-stats-item">
              <span className="focus-garden-stats-num">{dayFichesCount}</span>
              <span className="focus-garden-stats-lbl">{dayFichesCount > 1 ? 'fiches' : 'fiche'}</span>
            </span>
            <span className="focus-garden-stats-sep">·</span>
            <span className="focus-garden-stats-item">
              <span className="focus-garden-stats-num">{gardenStats.fleurs}</span>
              <span className="focus-garden-stats-lbl">{gardenStats.fleurs > 1 ? 'fleurs' : 'fleur'}</span>
            </span>
            <span className="focus-garden-stats-item">
              <span className="focus-garden-stats-num">{gardenStats.animaux}</span>
              <span className="focus-garden-stats-lbl">{gardenStats.animaux > 1 ? 'animaux' : 'animal'}</span>
            </span>
            <span className="focus-garden-stats-item">
              <span className="focus-garden-stats-num">{gardenStats.papillons}</span>
              <span className="focus-garden-stats-lbl">{gardenStats.papillons > 1 ? 'papillons' : 'papillon'}</span>
            </span>
          </div>
        </div>

        {/* Zone CARD : la card flotte en glass, navigation discrète en pied de card */}
        <div className="focus-card-zone">

          <div className="focus-card">

            <div className="focus-kicker">
            <div className="focus-kicker-line">
              <span className="focus-kicker-dot" style={{ background: sysColor }} />
              <span className="focus-kicker-sys">{currentSystemName}</span>
            </div>
            <span className={'focus-kicker-status ' + statusCls}>{statusLabel}</span>
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
            <div className="focus-nav-inline">
              <button
                type="button"
                className="focus-nav-dot"
                onClick={goPrev}
                disabled={!canPrev}
                aria-label="Fiche précédente"
                title="Fiche précédente (←)"
              >
                {'‹'}
              </button>
              <button
                type="button"
                className="focus-nav-dot focus-nav-dot-next"
                onClick={goNext}
                disabled={!canNext}
                aria-label="Fiche suivante"
                title="Fiche suivante (→)"
              >
                {'›'}
              </button>
            </div>
          </div>
          </div>
        </div>

        {/* HINT clavier — flotte sur le ciel, bas-droite, non-intrusif */}
        <div className="focus-hint">
          <span><kbd>1</kbd>–<kbd>5</kbd> noter</span>
          <span className="focus-hint-sep">{'·'}</span>
          <span><kbd>R</kbd> reporter</span>
          <span className="focus-hint-sep">{'·'}</span>
          <span><kbd>←</kbd><kbd>→</kbd> naviguer</span>
        </div>
      </div>
    </div>
  )
}

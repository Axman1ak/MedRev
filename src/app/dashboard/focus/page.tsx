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
  const treeProgress = forceFull ? 1 : Math.max(0, Math.min(1, elapsedMs / timeToFullMs))

  // ============ Heure réelle pour le cycle jour/nuit ============
  const nowDate = new Date(nowMs ?? Date.now())
  const hour = nowDate.getHours() + nowDate.getMinutes() / 60
  const sky = skyAtHour(hour)

  // Soleil visible 6h-19h (arc sinusoïdal)
  const isDaytime = hour >= 6 && hour <= 19
  const sunArcT = isDaytime ? (hour - 6) / 13 : -1
  const sunX = 200 + sunArcT * 1200
  const sunY = 440 - Math.sin(Math.max(0, sunArcT) * Math.PI) * 220

  // Lune visible 19h-6h (le matin), arc continu de 19h à 30h (= 6h next day)
  const moonHourAdj = hour < 6 ? hour + 24 : hour
  const isNight = hour >= 19 || hour < 6
  const moonArcT = isNight ? (moonHourAdj - 19) / 11 : -1
  const moonX = 200 + moonArcT * 1200
  const moonY = 440 - Math.sin(Math.max(0, moonArcT) * Math.PI) * 220

  // Étoiles : opacité fade in au crépuscule, fade out à l'aube
  let starsOpacity = 0
  if (hour < 5 || hour > 22) starsOpacity = 1
  else if (hour >= 20 && hour <= 22) starsOpacity = (hour - 20) / 2
  else if (hour >= 5 && hour < 7) starsOpacity = (7 - hour) / 2

  const unlocked = elements

  // Helper de rendu d'un élément du jardin (switch sur kind)
  function renderEl(el: GardenElement, idx: number) {
    const k = `el-${idx}`
    switch (el.kind) {
      case 'flower': {
        const c = FLOWER_COLORS[el.variant ?? 'red']
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            <line x1={0} y1={0} x2={0} y2={-22} stroke="#5E8954" strokeWidth={1.6} />
            <ellipse cx={0} cy={-22} rx={5} ry={3} fill={c} transform="rotate(-30 0 -22)" />
            <ellipse cx={0} cy={-22} rx={5} ry={3} fill={c} transform="rotate(30 0 -22)" />
            <ellipse cx={0} cy={-25} rx={4} ry={2.5} fill={c} />
            <circle cx={0} cy={-23} r={1.6} fill="#FBD56B" />
          </g>
        )
      }
      case 'sunflower': {
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            <line x1={0} y1={0} x2={-6} y2={-32} stroke="#5E8954" strokeWidth={2.2} />
            <line x1={-6} y1={-32} x2={-12} y2={-50} stroke="#5E8954" strokeWidth={1.7} />
            <line x1={-6} y1={-32} x2={0} y2={-48} stroke="#5E8954" strokeWidth={1.7} />
            <line x1={-6} y1={-32} x2={-2} y2={-58} stroke="#5E8954" strokeWidth={1.7} />
            <ellipse cx={-12} cy={-52} rx={6} ry={4} fill="#FBD56B" />
            <ellipse cx={0} cy={-50} rx={6} ry={4} fill="#FBD56B" />
            <ellipse cx={-2} cy={-60} rx={6} ry={4} fill="#FBD56B" />
            <circle cx={-12} cy={-52} r={2} fill="#A8741E" />
            <circle cx={0} cy={-50} r={2} fill="#A8741E" />
            <circle cx={-2} cy={-60} r={2} fill="#A8741E" />
          </g>
        )
      }
      case 'tulip': {
        const c = FLOWER_COLORS[el.variant ?? 'red']
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            <line x1={0} y1={0} x2={0} y2={-30} stroke="#5E8954" strokeWidth={2} />
            <line x1={0} y1={-12} x2={-7} y2={-22} stroke="#5E8954" strokeWidth={1.2} />
            <line x1={0} y1={-12} x2={7} y2={-22} stroke="#5E8954" strokeWidth={1.2} />
            <ellipse cx={0} cy={-32} rx={4.5} ry={7} fill={c} />
            <circle cx={0} cy={-30} r={1.4} fill="#FBD56B" />
          </g>
        )
      }
      case 'mushroom': {
        const isRed = el.variant !== 'orange'
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            <ellipse cx={0} cy={0} rx={14} ry={10} fill={isRed ? '#C75050' : '#C58040'} />
            <ellipse cx={0} cy={-3} rx={6} ry={2} fill="rgba(255,255,255,0.35)" />
            <ellipse cx={-5} cy={-4} rx={3} ry={2} fill="rgba(255,255,255,0.5)" />
            <rect x={-3} y={-2} width={6} height={10} rx={1.5} fill="#FFFFFF" opacity={0.85} />
          </g>
        )
      }
      case 'butterfly': {
        const [body, wing] = BUTTERFLY_COLORS[el.variant ?? 'amber']
        const flapDelay = (idx % 7) * 50
        return (
          <g key={k} transform={`translate(${el.x} ${el.y}) rotate(-15)`}>
            {/* Ailes — battent en continu via animation CSS */}
            <g className="focus-butterfly-wings" style={{ animationDelay: `${flapDelay}ms` }}>
              <ellipse cx={-7} cy={-2} rx={9} ry={6} fill={body} opacity={0.95} />
              <ellipse cx={7}  cy={-2} rx={9} ry={6} fill={body} opacity={0.95} />
              <ellipse cx={-6} cy={-3} rx={4} ry={2} fill={wing} />
              <ellipse cx={6}  cy={-3} rx={4} ry={2} fill={wing} />
            </g>
            {/* Corps */}
            <line x1={0} y1={-4} x2={0} y2={4} stroke="#3D2C20" strokeWidth={1.5} />
          </g>
        )
      }
      case 'rabbit': {
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            <ellipse cx={0} cy={14} rx={22} ry={5} fill="rgba(0,0,0,0.18)" />
            <ellipse cx={0} cy={0}  rx={18} ry={14} fill="#D8C4A8" />
            <ellipse cx={-3} cy={-2} rx={12} ry={9} fill="#E8D4B8" />
            <ellipse cx={14} cy={-3} rx={9} ry={7} fill="#D8C4A8" />
            <ellipse cx={11} cy={-4} rx={5} ry={4} fill="#E8D4B8" />
            <ellipse cx={-12} cy={-12} rx={4} ry={9} fill="#D8C4A8" />
            <ellipse cx={-6}  cy={-13} rx={4} ry={9} fill="#D8C4A8" />
            <ellipse cx={-12} cy={-14} rx={2} ry={6} fill="#F0DCC0" />
            <ellipse cx={-6}  cy={-15} rx={2} ry={6} fill="#F0DCC0" />
            <circle cx={14} cy={-5} r={1.5} fill="#1A1A0F" />
            <circle cx={14} cy={-5} r={0.5} fill="white" />
            <ellipse cx={18} cy={-1} rx={1.5} ry={1} fill="#C75050" />
            <path d="M-18 8 Q-22 6 -23 10 Q-20 12 -16 10" fill="#D8C4A8" />
          </g>
        )
      }
      case 'squirrel': {
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            <ellipse cx={0} cy={0} rx={14} ry={8} fill="#7C5A3A" />
            <ellipse cx={-3} cy={-1} rx={9} ry={6} fill="#9C7B5A" />
            <ellipse cx={-7} cy={0} rx={6} ry={6} fill="#7C5A3A" />
            <ellipse cx={-9} cy={-1} rx={2.5} ry={2.5} fill="#9C7B5A" />
            <circle cx={-9} cy={-2} r={0.8} fill="#1A1A0F" />
            <ellipse cx={-9} cy={0} rx={0.7} ry={0.5} fill="#1A1A0F" />
            <path d="M-7 -3 L-9 -7 M-5 -3 L-6 -7" stroke="#7C5A3A" strokeWidth={1.2} fill="none" />
            <path d="M12 -2 Q22 -10 26 0 Q20 0 12 1 Z" fill="#9C7B5A" />
            <path d="M14 -1 Q20 -7 24 -1" stroke="#7C5A3A" strokeWidth={0.8} fill="none" />
          </g>
        )
      }
      case 'owl': {
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            <ellipse cx={0} cy={0} rx={20} ry={10} fill="#3D2C20" />
            <ellipse cx={-3} cy={-2} rx={12} ry={8} fill="#5A4438" />
            <circle cx={-7} cy={-3} r={2} fill="white" />
            <circle cx={-7} cy={-3} r={1} fill="#1A1A0F" />
            <path d="M-12 -3 L-17 -5 L-14 -1 Z" fill="#E08B3C" />
            <path d="M5 -2 Q14 -10 22 -4 Q14 0 5 -1 Z" fill="#5A4438" />
            <path d="M-2 8 L-2 14" stroke="#3D2C20" strokeWidth={1.5} />
            <path d="M2 8 L2 14" stroke="#3D2C20" strokeWidth={1.5} />
          </g>
        )
      }
      case 'deer': {
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`} opacity={0.95}>
            <ellipse cx={0} cy={6} rx={35} ry={5} fill="rgba(0,0,0,0.22)" />
            <ellipse cx={0} cy={-6} rx={25} ry={14} fill="#A8755A" />
            <ellipse cx={-2} cy={-8} rx={20} ry={11} fill="#C49080" />
            <path d="M-22 -3 Q-30 0 -28 6 Q-22 6 -20 4" fill="#A8755A" />
            <ellipse cx={22} cy={-12} rx={11} ry={14} fill="#A8755A" />
            <ellipse cx={22} cy={-14} rx={8} ry={10} fill="#C49080" />
            <path d="M22 -25 L18 -38 M22 -25 L26 -38 M22 -25 L19 -36 M22 -25 L25 -36" stroke="#FFFFFF" strokeWidth={1.4} fill="none" strokeLinecap="round" />
            <path d="M19 -38 L17 -42 M26 -38 L28 -42" stroke="#FFFFFF" strokeWidth={1.2} fill="none" strokeLinecap="round" />
            <circle cx={20} cy={-12} r={1.2} fill="#1A1A0F" />
            <ellipse cx={28} cy={-9} rx={1.5} ry={1} fill="#1A1A0F" />
            <line x1={-20} y1={6} x2={-20} y2={14} stroke="#A8755A" strokeWidth={2.5} strokeLinecap="round" />
            <line x1={-12} y1={6} x2={-12} y2={14} stroke="#A8755A" strokeWidth={2.5} strokeLinecap="round" />
            <line x1={12} y1={2} x2={12} y2={14} stroke="#A8755A" strokeWidth={2.5} strokeLinecap="round" />
            <line x1={20} y1={2} x2={20} y2={14} stroke="#A8755A" strokeWidth={2.5} strokeLinecap="round" />
          </g>
        )
      }
      case 'fox': {
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            <ellipse cx={0} cy={6} rx={20} ry={4} fill="rgba(0,0,0,0.2)" />
            <ellipse cx={0} cy={-2} rx={16} ry={9} fill="#C75A2A" />
            <ellipse cx={-3} cy={-3} rx={11} ry={6} fill="#E07840" />
            <path d="M14 -4 L24 -10 L26 -2 L20 0 Z" fill="#C75A2A" />
            <path d="M-14 -3 L-18 -10 L-13 -10 Z" fill="#C75A2A" />
            <path d="M-10 -3 L-14 -8 L-9 -8 Z" fill="#C75A2A" />
            <ellipse cx={20} cy={-6} rx={3} ry={2} fill="#FFFFFF" />
            <circle cx={22} cy={-5} r={0.8} fill="#1A1A0F" />
            <path d="M14 4 Q26 10 32 4 Q34 -6 28 -8 Q22 -2 18 6 Z" fill="#C75A2A" />
            <path d="M28 -6 Q32 -2 30 2" stroke="#FFFFFF" strokeWidth={1} fill="none" />
          </g>
        )
      }
      case 'pond': {
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            <ellipse cx={0} cy={50} rx={220} ry={55} fill="rgba(255,255,255,0.32)" />
            <ellipse cx={0} cy={40} rx={200} ry={45} fill="url(#pondGrad)" />
            <ellipse cx={0} cy={30} rx={190} ry={38} fill="url(#pondHi)" />
            <path d="M-160 28 Q-100 20 -40 28 M40 30 Q100 22 160 30" stroke="rgba(255,255,255,0.4)" strokeWidth={1.2} fill="none" />
            <g transform="translate(-110,28)">
              <ellipse cx={0} cy={0} rx={18} ry={6} fill="#5E8954" />
              <ellipse cx={-2} cy={-1} rx={14} ry={4} fill="#7AA56B" />
              <ellipse cx={-2} cy={-2} rx={3} ry={2} fill="#F4B5C9" />
              <circle cx={-2} cy={-2} r={0.8} fill="#FBD56B" />
            </g>
            <g transform="translate(80,40)">
              <ellipse cx={0} cy={0} rx={22} ry={7} fill="#5E8954" />
              <ellipse cx={2} cy={-1} rx={18} ry={5} fill="#7AA56B" />
              <ellipse cx={3} cy={-3} rx={3.5} ry={2.5} fill="#FFE5DD" />
              <circle cx={3} cy={-3} r={1} fill="#FBD56B" />
            </g>
            <g transform="translate(140,55)">
              <ellipse cx={0} cy={0} rx={14} ry={5} fill="#5E8954" />
              <ellipse cx={-1} cy={-1} rx={11} ry={3.5} fill="#7AA56B" />
            </g>
            <g transform="translate(-180,15)">
              <line x1={0} y1={0} x2={0}  y2={-40} stroke="#5E8954" strokeWidth={2} />
              <line x1={-3} y1={-2} x2={-5} y2={-30} stroke="#5E8954" strokeWidth={2} />
              <line x1={3}  y1={-2} x2={5}  y2={-32} stroke="#5E8954" strokeWidth={2} />
              <ellipse cx={0}  cy={-42} rx={4} ry={10} fill="#9C7B3A" />
              <ellipse cx={-5} cy={-32} rx={3} ry={7}  fill="#9C7B3A" />
              <ellipse cx={5}  cy={-34} rx={3} ry={8}  fill="#9C7B3A" />
            </g>
            <g transform="translate(-50,52)">
              <ellipse cx={0} cy={0} rx={9} ry={6} fill="#5E8954" />
              <ellipse cx={-3} cy={-2} rx={3} ry={2.5} fill="#7AA56B" />
              <circle cx={-3} cy={-3} r={1.5} fill="#1A1A0F" />
              <circle cx={3}  cy={-3} r={1.5} fill="#1A1A0F" />
              <circle cx={-3} cy={-3} r={0.5} fill="white" />
              <circle cx={3}  cy={-3} r={0.5} fill="white" />
            </g>
          </g>
        )
      }
      case 'sapling': {
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`}>
            <ellipse cx={0} cy={4} rx={18} ry={4} fill="rgba(0,0,0,0.18)" />
            <line x1={0} y1={0} x2={0} y2={-30} stroke="#5A4031" strokeWidth={2.5} strokeLinecap="round" />
            <ellipse cx={0} cy={-32} rx={20} ry={14} fill="#3F5E4A" />
            <ellipse cx={-6} cy={-28} rx={12} ry={9} fill="#4A6E55" />
            <ellipse cx={6}  cy={-30} rx={11} ry={9} fill="#5E8954" />
            <ellipse cx={-2} cy={-36} rx={9} ry={7}  fill="url(#bushHi)" />
          </g>
        )
      }
      case 'log': {
        return (
          <g key={k} transform={`translate(${el.x} ${el.y})`} opacity={0.95}>
            <ellipse cx={0}  cy={0} rx={32} ry={14} fill="#7C5A3A" />
            <ellipse cx={-2} cy={-3} rx={22} ry={10} fill="#8C6A48" />
            <path d="M28 -2 Q42 -8 48 -10 L46 0 L36 4 Z" fill="#7C5A3A" />
            <ellipse cx={-30} cy={2} rx={3} ry={6} fill="#FFFFFF" />
            <line x1={-12} y1={14} x2={-13} y2={32} stroke="#7C5A3A" strokeWidth={3} strokeLinecap="round" />
            <line x1={-2}  y1={14} x2={-3}  y2={32} stroke="#7C5A3A" strokeWidth={3} strokeLinecap="round" />
            <line x1={20}  y1={12} x2={22}  y2={32} stroke="#7C5A3A" strokeWidth={3} strokeLinecap="round" />
            <line x1={10}  y1={12} x2={12}  y2={32} stroke="#7C5A3A" strokeWidth={3} strokeLinecap="round" />
          </g>
        )
      }
      default:
        return null
    }
  }

  return (
    <svg
      viewBox="0 0 1600 1000"
      className="focus-garden-svg"
      role="img"
      preserveAspectRatio="xMidYMax slice"
    >
      <title>Ton jardin de session</title>

      <defs>
        {/* Ciel — couleurs interpolées selon l'heure du jour */}
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={sky.top} />
          <stop offset="35%"  stopColor={sky.upMid} />
          <stop offset="70%"  stopColor={sky.loMid} />
          <stop offset="100%" stopColor={sky.bottom} />
        </linearGradient>
        <radialGradient id="sungod" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFEFB8" stopOpacity="0.95" />
          <stop offset="35%" stopColor="#F8D880" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#F8D880" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A8C088" />
          <stop offset="60%" stopColor="#86A56A" />
          <stop offset="100%" stopColor="#6B8A52" />
        </linearGradient>
        <linearGradient id="trunkbody" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2D1F15" />
          <stop offset="40%" stopColor="#5A4031" />
          <stop offset="55%" stopColor="#6B4C3A" />
          <stop offset="100%" stopColor="#2D1F15" />
        </linearGradient>
        <radialGradient id="foliageMid" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#7AA56B" />
          <stop offset="100%" stopColor="#5E8954" />
        </radialGradient>
        <radialGradient id="foliageFront" cx="35%" cy="30%" r="55%">
          <stop offset="0%" stopColor="#A8C088" />
          <stop offset="100%" stopColor="#7AA56B" />
        </radialGradient>
        <radialGradient id="pondGrad" cx="50%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#A8CDD8" />
          <stop offset="60%" stopColor="#6E9AAA" />
          <stop offset="100%" stopColor="#4A7585" />
        </radialGradient>
        <linearGradient id="pondHi" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="50%" stopColor="rgba(255,255,255,0.1)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <radialGradient id="bushHi" cx="35%" cy="30%" r="55%">
          <stop offset="0%" stopColor="#9DBC78" />
          <stop offset="100%" stopColor="#6F8D52" />
        </radialGradient>
        <pattern id="bark" width="10" height="20" patternUnits="userSpaceOnUse">
          <path d="M2 0 Q1 10 3 20 M7 0 Q9 10 6 20" stroke="#1F1410" strokeWidth="0.8" fill="none" opacity="0.6" />
        </pattern>
      </defs>

      {/* CIEL */}
      <rect width="1600" height="1000" fill="url(#sky)" />

      {/* SOLEIL avec halo — visible 6h-19h, arc sinusoïdal */}
      {isDaytime && (
        <g>
          <circle cx={sunX} cy={sunY} r={240} fill="url(#sungod)" />
          <circle cx={sunX} cy={sunY} r={90}  fill="#FFE5A0" opacity={0.95} />
          <circle cx={sunX} cy={sunY} r={64}  fill="#FDF4D5" />
        </g>
      )}

      {/* LUNE — visible 19h-6h, même arc */}
      {isNight && (
        <g>
          <circle cx={moonX} cy={moonY} r={140} fill="#E5E8F0" opacity={0.12} />
          <circle cx={moonX} cy={moonY} r={56}  fill="#F5F2E0" opacity={0.95} />
          <circle cx={moonX} cy={moonY} r={48}  fill="#FFFEF8" />
          {/* Cratères subtils */}
          <circle cx={moonX - 14} cy={moonY - 8}  r={5} fill="rgba(180,180,200,0.35)" />
          <circle cx={moonX + 10} cy={moonY + 6}  r={6} fill="rgba(180,180,200,0.32)" />
          <circle cx={moonX + 4}  cy={moonY - 14} r={3} fill="rgba(180,180,200,0.28)" />
        </g>
      )}

      {/* ÉTOILES — fade in au crépuscule, fade out à l'aube */}
      {starsOpacity > 0 && (
        <g opacity={starsOpacity}>
          {[
            { x: 120,  y: 80,  r: 1.4 }, { x: 280, y: 140, r: 1.6 },
            { x: 460,  y: 60,  r: 1.2 }, { x: 640, y: 180, r: 1.8 },
            { x: 820,  y: 100, r: 1.3 }, { x: 1000, y: 50, r: 1.5 },
            { x: 1180, y: 170, r: 1.4 }, { x: 1340, y: 90, r: 1.7 },
            { x: 1480, y: 200, r: 1.2 }, { x: 200, y: 220, r: 1.3 },
            { x: 380,  y: 280, r: 1.5 }, { x: 580, y: 310, r: 1.2 },
            { x: 760,  y: 240, r: 1.4 }, { x: 940, y: 290, r: 1.6 },
            { x: 1120, y: 330, r: 1.3 }, { x: 1280, y: 260, r: 1.5 },
            { x: 1440, y: 320, r: 1.4 },
          ].map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFFEF0"
                    className="focus-star" style={{ animationDelay: `${(i % 5) * 0.6}s` }} />
          ))}
        </g>
      )}

      {/* NUAGES — dérivent lentement à travers le ciel */}
      <g className="focus-cloud focus-cloud-1">
        <ellipse cx={220} cy={180} rx={58} ry={5} fill="white" opacity={0.45} />
        <ellipse cx={250} cy={170} rx={35} ry={4} fill="white" opacity={0.5} />
      </g>
      <g className="focus-cloud focus-cloud-2">
        <ellipse cx={780} cy={140} rx={50} ry={4} fill="white" opacity={0.4} />
        <ellipse cx={810} cy={148} rx={28} ry={3} fill="white" opacity={0.35} />
      </g>
      <g className="focus-cloud focus-cloud-3">
        <ellipse cx={1430} cy={160} rx={42} ry={4} fill="white" opacity={0.45} />
        <ellipse cx={1460} cy={168} rx={24} ry={3} fill="white" opacity={0.4} />
      </g>
      <g className="focus-cloud focus-cloud-4">
        <ellipse cx={520} cy={100} rx={36} ry={3} fill="white" opacity={0.35} />
      </g>

      {/* OISEAUX silhouettes lointaines */}
      <g opacity={0.7}>
        <path d="M780 200 Q790 195 800 200 L795 205 Z" fill="#3D2C20" />
        <path d="M810 230 Q820 225 830 230 L825 235 Z" fill="#3D2C20" />
        <path d="M860 220 Q870 215 880 220 L875 225 Z" fill="#3D2C20" />
        <path d="M920 210 Q930 205 940 210 L935 215 Z" fill="#3D2C20" />
      </g>

      {/* MONTAGNES & forêt lointaine */}
      <path d="M0 600 Q200 540 380 580 Q540 615 700 575 Q840 540 1000 590 Q1180 640 1380 580 Q1500 545 1600 590 L1600 700 L0 700 Z" fill="#9DB3C8" opacity={0.55} />
      <path d="M0 640 Q150 590 320 620 Q500 660 680 615 Q820 580 980 625 Q1150 670 1320 620 Q1450 590 1600 625 L1600 720 L0 720 Z" fill="#7E9890" opacity={0.7} />
      <path d="M0 690 Q120 660 260 690 Q420 720 580 685 Q740 660 900 695 Q1080 730 1260 690 Q1400 660 1600 690 L1600 750 L0 750 Z" fill="#5E8059" />

      {/* ARBRES SECONDAIRES de mid-distance (toujours présents) */}
      <g>
        <g transform="translate(80,720)">
          <ellipse cx={0}   cy={-95}  rx={40} ry={50} fill="#3F5E4A" />
          <ellipse cx={-18} cy={-80}  rx={28} ry={34} fill="#3F5E4A" />
          <ellipse cx={22}  cy={-72}  rx={30} ry={36} fill="#4A6E55" />
          <ellipse cx={-5}  cy={-100} rx={22} ry={28} fill="#5E8954" />
          <path d="M0 0 L-3 -50 L-5 -85 L0 -100 L5 -85 L3 -50 Z" fill="#2D1F15" />
        </g>
        <g transform="translate(180,725)">
          <ellipse cx={0}   cy={-72} rx={26} ry={32} fill="#3F5E4A" />
          <ellipse cx={-10} cy={-58} rx={18} ry={22} fill="#4A6E55" />
          <path d="M0 0 L-2 -35 L0 -75 L2 -35 Z" fill="#2D1F15" />
        </g>
        <g transform="translate(1280,728)">
          <ellipse cx={0}  cy={-58} rx={22} ry={28} fill="#4A6E55" />
          <path d="M0 0 L-2 -28 L0 -60 L2 -28 Z" fill="#2D1F15" />
        </g>
        <g transform="translate(1450,720)">
          <ellipse cx={0}   cy={-105} rx={44} ry={54} fill="#3F5E4A" />
          <ellipse cx={-22} cy={-85}  rx={30} ry={36} fill="#3F5E4A" />
          <ellipse cx={24}  cy={-80}  rx={32} ry={38} fill="#4A6E55" />
          <ellipse cx={-3}  cy={-115} rx={24} ry={30} fill="#5E8954" />
          <path d="M0 0 L-3 -55 L-5 -95 L0 -110 L5 -95 L3 -55 Z" fill="#2D1F15" />
        </g>
      </g>

      {/* SOL */}
      <rect x={0} y={730} width={1600} height={270} fill="url(#grass)" />

      {/* SENTIER subtil */}
      <path d="M380 990 Q500 920 700 900 Q920 880 1100 920 Q1280 950 1500 970 L1600 1000 L0 1000 L0 980 Q120 970 380 990 Z" fill="rgba(196,123,43,0.18)" opacity={0.5} />

      {/* ÉLÉMENTS DÉBLOQUÉS placés AVANT l'arbre central pour passer derrière les feuilles bas */}
      {unlocked.filter(e => e.kind === 'pond' || e.kind === 'log' || e.kind === 'sapling' || e.kind === 'deer').map(renderEl)}

      {/* ARBRE CENTRAL : tronc + branches + canopée */}
      <g transform={`translate(${HERO_TRUNK_X} ${HERO_GROUND_Y})`}>
        <ellipse cx={0} cy={-8} rx={64} ry={16} fill="rgba(0,0,0,0.22)" />

        {/* Tronc — vraie pousse au début (15%), grandit fortement avec le temps */}
        <g style={{
          transform: `scale(${0.15 + treeProgress * 0.85})`,
          transformOrigin: '0px 0px',
        }}>
          <path d="M -22 0 Q -26 -90 -18 -180 Q -12 -270 -10 -360 Q -8 -420 -6 -460 L 6 -460 Q 8 -420 10 -360 Q 12 -270 18 -180 Q 26 -90 22 0 Z" fill="url(#trunkbody)" />
          <path d="M -22 0 Q -26 -90 -18 -180 Q -12 -270 -10 -360 Q -8 -420 -6 -460 L 6 -460 Q 8 -420 10 -360 Q 12 -270 18 -180 Q 26 -90 22 0 Z" fill="url(#bark)" opacity={0.55} />
          <path d="M -14 -30 Q -18 -130 -12 -240 Q -8 -340 -7 -420" stroke="rgba(255,255,255,0.16)" strokeWidth={3} fill="none" />
          <ellipse cx={-9}  cy={-110} rx={6} ry={9} fill="#1F1410" opacity={0.65} />
          <ellipse cx={11}  cy={-220} rx={5} ry={7} fill="#1F1410" opacity={0.6} />
          <ellipse cx={-12} cy={-330} rx={4} ry={6} fill="#1F1410" opacity={0.55} />
        </g>

        {/* Branches — apparaissent à chaque seuil de croissance */}
        <g stroke="#3D2C20" strokeLinecap="round" fill="none">
          {HERO_BRANCHES.map((b, i) => {
            if (treeProgress < b.threshold) return null
            const fadeT = Math.max(0, Math.min(1, (treeProgress - b.threshold) / 0.06))
            return (
              <g key={`branch-${i}`} style={{ opacity: fadeT }}>
                <path d={b.thickPath} strokeWidth={22} />
                <path d={b.innerPath} strokeWidth={14} stroke="#5A4031" />
                {(b.subPaths ?? []).map((sp, j) => (
                  <path key={`sb-${j}`} d={sp} strokeWidth={9} />
                ))}
              </g>
            )
          })}
        </g>

        {/* Canopée 3 couches (back / mid / front) — apparaissent avec leurs branches */}
        <g>
          {HERO_FOLIAGE.map((cluster, i) => {
            if (treeProgress < cluster.threshold) return null
            const fadeT = Math.max(0, Math.min(1, (treeProgress - cluster.threshold) / 0.08))
            return (
              <g key={`fol-${i}`} style={{ opacity: fadeT }}>
                {cluster.back.map((e, j) => (
                  <ellipse key={`b-${j}`} cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} fill={e.fill} />
                ))}
                {cluster.mid.map((e, j) => (
                  <ellipse key={`m-${j}`} cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} fill="url(#foliageMid)" />
                ))}
                {cluster.front.map((e, j) => (
                  <ellipse key={`f-${j}`} cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} fill="url(#foliageFront)" />
                ))}
              </g>
            )
          })}
        </g>

        {/* Bloom au sommet quand forceFull (bilan) */}
        {forceFull && (
          <g>
            <circle cx={0} cy={-470} r={26} fill="#FFE5DD" opacity={0.6} />
            <ellipse cx={-6} cy={-476} rx={6} ry={4.5} fill="#F4B5C9" />
            <ellipse cx={6}  cy={-476} rx={6} ry={4.5} fill="#F4B5C9" />
            <ellipse cx={-6} cy={-466} rx={6} ry={4.5} fill="#F4B5C9" />
            <ellipse cx={6}  cy={-466} rx={6} ry={4.5} fill="#F4B5C9" />
            <circle cx={0} cy={-471} r={3} fill="#FBD56B" />
          </g>
        )}
      </g>

      {/* ÉLÉMENTS DÉBLOQUÉS classiques (foreground : fleurs, animaux, papillons, mushrooms, owl/squirrel sur arbre) */}
      {unlocked.filter(e => e.kind !== 'pond' && e.kind !== 'log' && e.kind !== 'sapling' && e.kind !== 'deer').map(renderEl)}

      {/* PARTICULES (sparkle gold à la notation, position arbitraire ou calée sur la card) */}
      {particleBurst && (() => {
        const px = particleBurst.x ?? 800
        const py = particleBurst.y ?? 500
        const angles = [0, 45, 90, 135, 180, 225, 270, 315]
        return (
          <g key={`burst-${particleBurst.ts}`} className="focus-particle-burst">
            {angles.map((a, i) => {
              const rad = (a * Math.PI) / 180
              const dx = Math.cos(rad) * 38
              const dy = Math.sin(rad) * 38
              return (
                <circle
                  key={i}
                  cx={px}
                  cy={py}
                  r={4}
                  fill="#FBD56B"
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

      {/* Arc du soleil (trace pointillée du parcours) */}
      <g>
        <path d="M0 70 Q400 100 800 80 Q1200 60 1600 75" stroke="rgba(255,255,255,0.4)" strokeWidth={2} strokeLinecap="round" fill="none" strokeDasharray="2 6" />
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

      // 2) Charger le jardin persisté DE CE USER (clé localStorage suffixée par userId)
      const loadedGarden = loadDayGarden(today, user.id)
      if (!cancelled) {
        setDayGarden(loadedGarden)
        dayGardenRef.current = loadedGarden
        setCumElapsedAtStart(loadedGarden.elapsedMs)
        setSessionStartElementCount(loadedGarden.elements.length)
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
  // le temps écoulé si l'utilisateur ferme l'onglet
  useEffect(() => {
    if (phase !== 'session') return
    const intv = setInterval(() => {
      const totalElapsed = cumElapsedAtStart + Math.max(0, Date.now() - startedAt)
      const next: DayGardenState = { ...dayGardenRef.current, elapsedMs: totalElapsed }
      dayGardenRef.current = next
      saveDayGarden(next, userIdRef.current)
    }, 30000)
    return () => clearInterval(intv)
  }, [phase, cumElapsedAtStart, startedAt])

  // Sauvegarde finale au démontage de la page
  useEffect(() => {
    return () => {
      if (startedAt === 0) return
      const totalElapsed = cumElapsedAtStart + Math.max(0, Date.now() - startedAt)
      saveDayGarden({ ...dayGardenRef.current, elapsedMs: totalElapsed }, userIdRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    // Le score n'a pas d'incidence visuelle.
    setParticleBurst({ ts: Date.now() })

    // Sur PREMIÈRE notation : 50% de chance que rien n'apparaisse (juste l'arbre pousse),
    // sinon tirage d'UN seul élément (fleur 30% / insecte 12% / animal 6% / rare 2%).
    // Re-rating ne déclenche pas (pas de farming).
    if (wasEmpty) {
      const totalElapsed = cumElapsedAtStart + Math.max(0, Date.now() - startedAt)
      const newEl = pickElement(dayGardenRef.current.elements)
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
    }

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

          {/* JARDIN visible en fond — l'arbre est forcé en pleine maturité */}
          <div className="focus-garden">
            <FocusGarden
              elements={dayGarden.elements}
              elapsedMs={cumElapsedAtStart + Math.max(0, now - startedAt)}
              timeToFullMs={TIME_TO_FULL_MS}
              nowMs={now}
              forceFull
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

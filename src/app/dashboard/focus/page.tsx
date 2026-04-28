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
  results: Array<Result | null>
  elapsedMs: number
  timeToFullMs: number
  /** Si true (écran bilan), tige forcée au max et fleur affichée si au moins une note. */
  forceFull?: boolean
}

// Géométrie SVG (viewBox 120x130)
const POT_Y = 110
const STEM_TOP_MIN_Y = 30 // hauteur la plus haute atteignable

function FocusPlant({ results, elapsedMs, timeToFullMs, forceFull = false }: PlantProps) {
  const ratedLeaves: Array<{ idx: number; score: Score; atMs: number }> = []
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

// ===================== PLANT HERO (variante grande taille avec paysage) =====================
// Version XL utilisée dans le panneau .focus-garden pendant la session.
// ViewBox 240x400 (portrait), ciel + soleil + collines + herbe + pot + plante.
// Le soleil monte avec la progression temporelle ; la plante balance légèrement.

const HERO_POT_TOP_Y = 330
const HERO_STEM_TOP_MIN_Y = 80
const HERO_STEM_RANGE = HERO_POT_TOP_Y - HERO_STEM_TOP_MIN_Y // 250

function FocusPlantHero({ results, elapsedMs, timeToFullMs }: PlantProps) {
  const ratedLeaves: Array<{ idx: number; score: Score; atMs: number }> = []
  results.forEach((r, idx) => {
    if (r && r.outcome.kind === 'rated') {
      ratedLeaves.push({ idx, score: r.outcome.score, atMs: r.outcome.atMs })
    }
  })

  const stemProgress = Math.max(0, Math.min(1, elapsedMs / timeToFullMs))

  // Soleil monte de y=160 (horizon) à y=55 (zenith) avec la progression.
  const sunY = 160 - stemProgress * 105

  // Brins d'herbe répartis devant le pot
  const grassBlades = [10, 28, 48, 72, 96, 142, 168, 188, 208, 226]

  return (
    <svg
      viewBox="0 0 240 400"
      className="focus-garden-svg"
      role="img"
      preserveAspectRatio="xMidYEnd meet"
    >
      <title>Ton jardin de session</title>

      {/* Soleil avec halo */}
      <circle cx={195} cy={sunY} r={36} fill="#F3D88A" opacity={0.18} className="focus-sun-halo" />
      <circle cx={195} cy={sunY} r={22} fill="#F3D88A" opacity={0.92} className="focus-sun" />

      {/* Collines distantes (une couche claire, une couche sombre) */}
      <path
        d="M 0 340 Q 60 312 120 328 Q 180 342 240 320 L 240 380 L 0 380 Z"
        fill="#C9D8B5"
        opacity={0.55}
      />
      <path
        d="M 0 358 Q 80 348 150 358 Q 200 366 240 355 L 240 380 L 0 380 Z"
        fill="#A8C088"
        opacity={0.85}
      />

      {/* Sol (herbe) */}
      <rect x={0} y={365} width={240} height={35} fill="#9DB87E" />

      {/* Brins d'herbe devant le pot */}
      {grassBlades.map((x, i) => (
        <g key={`grass-${i}`}>
          <path d={`M ${x} 370 L ${x + 1.5} 362 L ${x + 3} 370`}
                stroke="#6E8A58" strokeWidth={0.8} fill="none" />
          <path d={`M ${x + 5} 372 L ${x + 6.5} 365 L ${x + 8} 372`}
                stroke="#6E8A58" strokeWidth={0.8} fill="none" opacity={0.8} />
        </g>
      ))}

      {/* Pot */}
      <path d="M 92 330 L 148 330 L 140 368 L 100 368 Z" fill="#A37147" />
      <path d="M 92 330 L 148 330 L 145 326 L 95 326 Z" fill="#7E5630" />
      <ellipse cx={120} cy={326} rx={26} ry={3.2} fill="#5C3A21" />
      {/* Reflet sur le pot */}
      <path d="M 100 334 L 105 360" stroke="rgba(255,255,255,0.16)" strokeWidth={2} strokeLinecap="round" />

      {/* Pierres devant le pot pour les fiches reportées */}
      {results.map((r, idx) => {
        if (!r || r.outcome.kind !== 'reported') return null
        const offset = (idx * 13) % 50 - 25
        const yJitter = (idx % 3) * 1.5
        return (
          <ellipse
            key={`stone-${idx}`}
            cx={120 + offset}
            cy={372 + yJitter}
            rx={3.8}
            ry={2.2}
            fill="#B8B0A0"
            opacity={0.78}
          />
        )
      })}

      {/* Groupe plante avec animation de balancement */}
      <g className="focus-plant-sway-group">
        {/* Tige : ligne pleine mise à l'échelle verticalement */}
        <g
          className="focus-plant-stem-group"
          style={{
            transform: `scaleY(${stemProgress})`,
            transformOrigin: `120px ${HERO_POT_TOP_Y}px`,
          }}
        >
          <line
            x1={120}
            y1={HERO_POT_TOP_Y}
            x2={120}
            y2={HERO_STEM_TOP_MIN_Y}
            stroke="#2D6A4F"
            strokeWidth={3.5}
            strokeLinecap="round"
          />
        </g>

        {/* Feuilles : forme de goutte attachée à la tige, couleur = score */}
        {ratedLeaves.map(({ idx, score, atMs }, n) => {
          const leafProgress = Math.max(0, Math.min(1, atMs / timeToFullMs))
          const yPos = HERO_POT_TOP_Y - leafProgress * HERO_STEM_RANGE
          const side = n % 2 === 0 ? -1 : 1
          const tipX = 120 + side * 22
          const midX = 120 + side * 13
          const color = SCORE_COLORS[score]
          // Forme de feuille : du stem à la pointe, courbe haut puis bas
          const leafPath = `M 120 ${yPos} Q ${midX} ${yPos - 9} ${tipX} ${yPos} Q ${midX} ${yPos + 9} 120 ${yPos} Z`
          return (
            <g key={`leaf-${idx}`} className="focus-plant-leaf">
              <path d={leafPath} fill={color} />
              {/* Nervure centrale */}
              <line
                x1={120}
                y1={yPos}
                x2={tipX}
                y2={yPos}
                stroke="rgba(0,0,0,0.18)"
                strokeWidth={0.6}
              />
              {/* Léger reflet */}
              <ellipse
                cx={midX}
                cy={yPos - 2}
                rx={5}
                ry={1.4}
                fill="rgba(255,255,255,0.22)"
              />
            </g>
          )
        })}
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
  const [results, setResults] = useState<Array<Result | null>>([])
  const [loading, setLoading] = useState(false)
  const [startedAt, setStartedAt] = useState<number>(0)
  const [now, setNow] = useState<number>(0)

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
  function findNextEmptyIdx(arr: Array<Result | null>, fromIdx: number): number {
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
    while (newSteps.length < J.length) newSteps.push(null)
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

    // Avance seulement si la fiche n'avait jamais été actionnée dans cette session
    if (wasEmpty) {
      const next = findNextEmptyIdx(newResults, currentIdx)
      if (next === -1) setPhase('done')
      else setCurrentIdx(next)
    }
    // Si re-rating : on reste sur la fiche, l'utilisateur peut vérifier ou naviguer.

    setLoading(false)
  }, [current, loading, phase, currentIdx, results, supabase, today, currentSystemName, startedAt])

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
      while (newSteps.length < J.length) newSteps.push(null)
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
  const alreadyRated = currentResult?.outcome.kind === 'rated'
  const alreadyReported = currentResult?.outcome.kind === 'reported'
  const ratedScore = alreadyRated ? (currentResult.outcome as { score: Score }).score : null

  const canPrev = currentIdx > 0
  const canNext = currentIdx + 1 !== queue.length

  return (
    <div className="focus-root">
      {/* TOP BAR */}

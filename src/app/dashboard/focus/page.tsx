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
import BibliothecaSvg, { BibliothecaTreasuresPanel, BIBLIOTHECA_TOTAL_CAPACITY, unlockedTreasuresCount, nextTreasure as nextBibTreasure } from '@/components/BibliothecaSvg'
import LiveBook from '@/components/LiveBook'
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

// Cible de complétion de la bibliothèque : 1500h cumulées (~ 1 année P1).
// 1 fiche notée ≈ 1h d'étude → 1 livre ajouté à la bibliothèque.
// Au-delà de 1500 fiches, la bibliothèque reste pleine.
const TIME_TO_FULL_MS = BIBLIOTHECA_TOTAL_CAPACITY * 60 * 60 * 1000

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

// 'lobby' = vue contemplative : la bibliothèque entière + bouton "Commencer".
// La session ne montre QUE le livre qui s'écrit (modèle Forest/Focus Tree :
// le jardin se contemple avant et après, jamais pendant).
type Phase = 'loading' | 'lobby' | 'session' | 'done' | 'empty'

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

// stepScore : lit le score OFFICIEL uniquement. Utilisé pour la logique
// de calendrier (due, nextUndone, queue priority de base).
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

// effectiveStepScore : score officiel sinon temp_score. Reflète l'état perçu
// par l'utilisateur — un retravailler en avance compte comme "score posé"
// jusqu'au vrai J.
function effectiveStepScore(s: StepEntry): Score | null {
  const off = stepScore(s)
  if (off) return off
  if (!s) return null
  const t = (s as { temp_score?: number }).temp_score
  if (typeof t === 'number' && t >= 1 && t <= 5) return t as Score
  return null
}

function stepDate(lesson: Lesson, i: number): string {
  if (!lesson.learn_date) return ''
  return dateStrFromOffset(lesson.learn_date, J[i])
}

function getLastScore(lesson: Lesson): Score | null {
  const steps = (lesson.steps as StepEntry[]) || []
  for (let i = J.length - 1; i >= 0; i--) {
    const sc = effectiveStepScore(steps[i])
    if (sc) return sc
  }
  return null
}

// Reporter / Annuler (colonnes lessons.skips / lessons.postpones).
function lessonSkips(l: Lesson): number[] {
  const s = (l as { skips?: unknown }).skips
  return Array.isArray(s) ? (s as number[]) : []
}
function lessonPostpones(l: Lesson): Record<string, string> {
  const p = (l as { postpones?: unknown }).postpones
  return p && typeof p === 'object' ? (p as Record<string, string>) : {}
}

function getDueForToday(lesson: Lesson, today: string): DueInfo | null {
  if (!lesson.learn_date) return null
  const steps = (lesson.steps as StepEntry[]) || []
  const skips = lessonSkips(lesson)
  const postpones = lessonPostpones(lesson)
  for (let i = 0; i < J.length; i++) {
    if (stepScore(steps[i])) continue
    if (skips.includes(i)) continue
    const dd = postpones[String(i)] ?? stepDate(lesson, i)
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
  // Ordre de révision : palier J croissant (plus petit J d'abord).
  return out.sort((a, b) => J[a.due.stepIndex] - J[b.due.stepIndex])
}

function buildQueue(
  lessons: Lesson[],
  systems: System[],
  lessonParam: string | null,
  systemParam: string | null,
  lessonsParam: string | null,
  today: string
): QueueItem[] {
  // 0) Mode "retravailler multi" : si ?lessons=id1,id2,id3 fourni, on construit
  //    une queue UNIQUEMENT de ces fiches, chacune sur son prochain J non noté
  //    avec status: 'fresh'. Le focus utilisera cette info pour écrire en
  //    temp_score (pas en score officiel) et ne pas bouger le calendrier.
  if (lessonsParam) {
    const ids = lessonsParam.split(',').map(s => s.trim()).filter(Boolean)
    const queue: QueueItem[] = []
    for (const id of ids) {
      const l = lessons.find(x => x.id === id)
      if (!l) continue
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
        queue.push({ lesson: l, due, lastScore: getLastScore(l), priority: -1 })
      }
    }
    return queue
  }

  // 1) Construit la queue de base : toutes les J du jour.
  //    Filtre par matière si ?system= explicite ; sinon par le semestre courant.
  let baseQueue: QueueItem[]
  if (systemParam) {
    const sysLessons = lessons.filter(l => l.system_id === systemParam)
    baseQueue = computeTodayQueue(sysLessons, today)
  } else {
    const semRaw = typeof window !== 'undefined' ? localStorage.getItem('medrev-sem') : null
    const sem: 1 | 2 | 'year' = semRaw === '1' ? 1 : semRaw === 'year' ? 'year' : 2
    // En mode 'year' : pas de filtre par semestre, on prend toutes les leçons
    const semLessons = sem === 'year'
      ? lessons
      : lessons.filter(l => {
          const sys = systems.find(s => s.id === l.system_id)
          return sys?.semestre === sem
        })
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

// ===================== BIBLIOTHÈQUE (état persistant annuel) =====================
// 1 fiche notée = 1 livre ajouté à la bibliothèque (cumulé sur l'année).
// Persisté en localStorage (clé "medrev-garden-{userId}" — réutilisée pour
// éviter une migration de schéma. Le champ legacy `elements` est ignoré.)

type DayBibliothecaState = {
  startedDate?: string  // date de la première session
  elapsedMs: number     // temps cumulé total (sur l'année), pour stats
  fichesCount: number   // nombre total de fiches notées (sur l'année)
}

const BIB_KEY_BASE = 'medrev-garden'

function bibKey(userId: string | null): string | null {
  if (!userId) return null
  return BIB_KEY_BASE + '-' + userId
}

function loadDayBibliotheca(today: string, userId: string | null): DayBibliothecaState {
  const empty: DayBibliothecaState = { startedDate: today, elapsedMs: 0, fichesCount: 0 }
  if (typeof window === 'undefined') return empty
  const key = bibKey(userId)
  if (!key) return empty
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DayBibliothecaState>
      return {
        startedDate: parsed.startedDate ?? today,
        elapsedMs: typeof parsed.elapsedMs === 'number' ? parsed.elapsedMs : 0,
        fichesCount: typeof parsed.fichesCount === 'number' ? parsed.fichesCount : 0,
      }
    }
    return empty
  } catch {
    return empty
  }
}

function saveDayBibliotheca(state: DayBibliothecaState, userId: string | null) {
  if (typeof window === 'undefined') return
  const key = bibKey(userId)
  if (!key) return
  try {
    // On préserve un champ `elements: []` pour rester compatible avec l'ancien
    // schéma localStorage (au cas où une autre version de l'app le lirait).
    localStorage.setItem(key, JSON.stringify({ ...state, elements: [] }))
  } catch {
    // ignore quota errors
  }
}

// ============ Sync cloud (Supabase, table `gardens`) ============
// On garde la même table pour éviter une migration. La colonne `elements`
// existe toujours en DB mais on ne la lit plus, et on écrit `[]` pour rester
// compatible avec l'ancien schéma.

type SbClient = ReturnType<typeof createClient>

async function pullBibFromSupabase(supabase: SbClient, userId: string): Promise<DayBibliothecaState | null> {
  try {
    const { data, error } = await supabase
      .from('gardens')
      .select('started_date, elapsed_ms, fiches_count')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return null
    return {
      startedDate: (data as any).started_date ?? undefined,
      elapsedMs: Number((data as any).elapsed_ms ?? 0),
      fichesCount: Number((data as any).fiches_count ?? 0),
    }
  } catch {
    return null
  }
}

function pushBibToSupabase(supabase: SbClient, userId: string | null, state: DayBibliothecaState): void {
  if (!userId) return
  void supabase
    .from('gardens')
    .upsert(
      {
        user_id: userId,
        started_date: state.startedDate ?? null,
        elapsed_ms: state.elapsedMs,
        fiches_count: state.fichesCount,
        elements: [],  // legacy, conservé vide pour compat
      },
      { onConflict: 'user_id' }
    )
    .then(() => { /* ok */ }, () => { /* swallow */ })
}

function mergeBibStates(a: DayBibliothecaState, b: DayBibliothecaState): DayBibliothecaState {
  // La bibliothèque ne décroît jamais : on garde le max des compteurs.
  let startedDate: string | undefined
  if (a.startedDate && b.startedDate) startedDate = a.startedDate < b.startedDate ? a.startedDate : b.startedDate
  else startedDate = a.startedDate ?? b.startedDate
  return {
    startedDate,
    elapsedMs: Math.max(a.elapsedMs, b.elapsedMs),
    fichesCount: Math.max(a.fichesCount, b.fichesCount),
  }
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
  const lessonsParam = searchParams.get('lessons')

  const [userId, setUserId] = useState<string | null>(null)
  const [systems, setSystems] = useState<System[]>([])
  const [phase, setPhase] = useState<Phase>('loading')
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [results, setResults] = useState<(Result | null)[]>([])
  const [loading, setLoading] = useState(false)
  const [startedAt, setStartedAt] = useState<number>(0)
  const [now, setNow] = useState<number>(0)

  // ============ MODE IMMERSIF (plein écran + wake lock) ============
  // Le plein écran masque les notifs visuelles sur la plupart des OS modernes.
  // Wake Lock empêche l'écran de se mettre en veille pendant la session.
  const [isFullscreen, setIsFullscreen] = useState(false)
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null)

  // Acquiert un wake lock dès qu'on est en session, libère sinon.
  // Le navigateur libère le lock quand l'onglet devient hidden — on ré-acquiert au visibilitychange.
  useEffect(() => {
    if (phase !== 'session') return
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
    let cancelled = false
    const acquire = async () => {
      try {
        const lock = await (navigator as unknown as {
          wakeLock: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> }
        }).wakeLock.request('screen')
        if (cancelled) { void lock.release(); return }
        wakeLockRef.current = lock
      } catch { /* swallow : feature non supportée ou refusée */ }
    }
    void acquire()
    const onVisible = () => {
      if (document.visibilityState === 'visible' && wakeLockRef.current === null) void acquire()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      if (wakeLockRef.current) { void wakeLockRef.current.release(); wakeLockRef.current = null }
    }
  }, [phase])

  // Suit l'état plein écran (l'utilisateur peut sortir via Escape sans cliquer notre bouton)
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else {
        await document.documentElement.requestFullscreen()
      }
    } catch { /* swallow : refus utilisateur ou non supporté */ }
  }, [])

  // Burst de particules : ts incrémenté à chaque rate pour re-déclencher l'anim CSS.
  // Position optionnelle (x, y) en coords viewBox jardin.
  const [particleBurst, setParticleBurst] = useState<{ ts: number; x?: number; y?: number } | null>(null)

  // Vol du livre refermé : du pupitre vers le compteur-bibliothèque de la
  // topbar (la bibliothèque elle-même n'est plus visible pendant la session —
  // modèle Forest). Ghost séparé du LiveBook : il survit au changement de fiche.
  const [bookFly, setBookFly] = useState<{ x: number; y: number; ts: number } | null>(null)
  const libChipRef = useRef<HTMLDivElement | null>(null)

  const today = new Date().toISOString().split('T')[0]

  // ============ ÉTAT JARDIN PERSISTANT (annuel) ============
  // Persisté en localStorage avec clé 'medrev-garden' (sans date). Cultivé toute l'année.
  // elapsedMs cumulé sur l'ensemble de l'année. Jamais reset.
  const [dayGarden, setDayGarden] = useState<DayBibliothecaState>({ startedDate: today, elapsedMs: 0, fichesCount: 0 })
  const [cumElapsedAtStart, setCumElapsedAtStart] = useState(0)
  // Stocke le nombre de fiches CUMULÉES au DÉMARRAGE de la session courante.
  // Utilisé pour le recap : permet de calculer combien de livres ont été ajoutés pendant cette session.
  const [sessionStartFichesCount, setSessionStartFichesCount] = useState(0)
  const dayGardenRef = useRef<DayBibliothecaState>(dayGarden)
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
      const localGarden = loadDayBibliotheca(today, user.id)
      if (!cancelled) {
        setDayGarden(localGarden)
        dayGardenRef.current = localGarden
        setCumElapsedAtStart(localGarden.elapsedMs)
        setSessionStartFichesCount(localGarden.fichesCount)
      }
      // Pull cloud (best-effort) + merge. Si pas de réseau ou pas encore de
      // ligne en DB, on reste sur le localGarden (et on pushera plus tard).
      const cloudGarden = await pullBibFromSupabase(supabase, user.id)
      if (cancelled) return
      if (cloudGarden) {
        const merged = mergeBibStates(localGarden, cloudGarden)
        setDayGarden(merged)
        dayGardenRef.current = merged
        setCumElapsedAtStart(merged.elapsedMs)
        setSessionStartFichesCount(merged.fichesCount)
        saveDayBibliotheca(merged, user.id)
        // Si le merge diffère du cloud, on pousse pour que les autres devices voient
        // tout de suite l'état le plus récent.
        if (
          merged.elapsedMs !== cloudGarden.elapsedMs ||
          merged.fichesCount !== cloudGarden.fichesCount
        ) {
          pushBibToSupabase(supabase, user.id, merged)
        }
      } else {
        // Aucune ligne cloud : on initialise avec le state local
        // (utile pour les comptes existants qui n'avaient que localStorage).
        if (localGarden.elapsedMs > 0 || localGarden.fichesCount > 0) {
          pushBibToSupabase(supabase, user.id, localGarden)
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
      const q = buildQueue(lesList, sysList, lessonParam, systemParam, lessonsParam, today)
      setQueue(q)
      setResults(new Array(q.length).fill(null))
      // Lobby d'abord : la bibliothèque se contemple, la session se CHOISIT.
      // startedAt reste à 0 jusqu'au clic "Commencer" (le cleanup de
      // démontage ignore startedAt === 0, donc pas de temps fantôme).
      setPhase(q.length === 0 ? 'empty' : 'lobby')
      setCurrentIdx(0)
      setNow(Date.now())
    })()
    return () => { cancelled = true }
  }, [supabase, router, lessonParam, systemParam, lessonsParam, today])

  // Sauvegarde périodique de l'elapsed cumul (toutes les 30s) pour ne pas perdre
  // le temps écoulé si l'utilisateur ferme l'onglet. Push aussi Supabase.
  useEffect(() => {
    if (phase !== 'session') return
    const intv = setInterval(() => {
      const totalElapsed = cumElapsedAtStart + Math.max(0, Date.now() - startedAt)
      const next: DayBibliothecaState = { ...dayGardenRef.current, elapsedMs: totalElapsed }
      dayGardenRef.current = next
      saveDayBibliotheca(next, userIdRef.current)
      pushBibToSupabase(supabase, userIdRef.current, next)
    }, 30000)
    return () => clearInterval(intv)
  }, [phase, cumElapsedAtStart, startedAt, supabase])

  // Sauvegarde finale au démontage de la page (localStorage + push cloud best-effort)
  useEffect(() => {
    return () => {
      if (startedAt === 0) return
      const totalElapsed = cumElapsedAtStart + Math.max(0, Date.now() - startedAt)
      const finalState: DayBibliothecaState = { ...dayGardenRef.current, elapsedMs: totalElapsed }
      saveDayBibliotheca(finalState, userIdRef.current)
      pushBibToSupabase(supabase, userIdRef.current, finalState)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tick chrono en mode session
  useEffect(() => {
    if (phase !== 'session') return
    // Tick 1s : suffit pour le compteur de durée affiché. La bibliothèque
    // est statique (pas de cycle jour/nuit), donc pas besoin de 100ms.
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [phase])

  const current = queue[currentIdx]
  const currentSystem = current ? systems.find(s => s.id === current.lesson.system_id) : undefined
  const currentSystemName = currentSystem?.name ?? 'Matière'
  const currentResult = results[currentIdx] ?? null

  // Prochain trésor à débloquer (utilisé dans le recap de fin de session)
  const upcomingTreasure = nextBibTreasure(dayGarden.fichesCount)

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
    // Si le J n'est pas encore dû (status: 'fresh'), on écrit un score TEMPORAIRE
    // qui ne touche ni le calendrier ni les helpers (stepScore ne lit que .score).
    // Sinon (today/missed), c'est le score officiel : il remplace tout temp.
    if (current.due.status === 'fresh') {
      newSteps[current.due.stepIndex] = {
        note: '',
        temp_score: score,
        temp_date: today,
      } as unknown as StepEntry
    } else {
      newSteps[current.due.stepIndex] = { score, date: today, note: '' } as StepEntry
    }
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
    // Position : centre du SVG bibliothèque (les particules survolent les livres).
    // Le score n'a pas d'incidence visuelle ; seule l'action de noter compte.
    if (wasEmpty) {
      const totalElapsed = cumElapsedAtStart + Math.max(0, Date.now() - startedAt)
      const updatedGarden: DayBibliothecaState = {
        ...dayGardenRef.current,
        elapsedMs: totalElapsed,
        fichesCount: dayGardenRef.current.fichesCount + 1,
      }
      dayGardenRef.current = updatedGarden
      setDayGarden(updatedGarden)
      saveDayBibliotheca(updatedGarden, userIdRef.current)
      // Push cloud immédiat : si l'utilisateur change d'appareil juste après,
      // il retrouve son dernier livre tout de suite.
      pushBibToSupabase(supabase, userIdRef.current, updatedGarden)

      // Écho visuel : le livre du pupitre se referme et vole vers le
      // compteur-bibliothèque de la topbar (il "part" se ranger).
      const chip = libChipRef.current
      if (chip) {
        const r = chip.getBoundingClientRect()
        setBookFly({ x: r.left + r.width / 2, y: r.top + r.height / 2, ts: Date.now() })
      }
    }

    setParticleBurst({ ts: Date.now(), x: 800, y: 550 })

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
          <div className="focus-topbar-right">
            <button type="button" onClick={toggleFullscreen} className={`focus-immersive${isFullscreen ? ' active' : ''}`} aria-label={isFullscreen ? 'Sortir du plein écran' : 'Mode immersif'} title={isFullscreen ? 'Sortir du plein écran (Esc)' : 'Mode immersif (plein écran + écran allumé)'}>{isFullscreen ? '⊟' : '⊞'}</button>
            <Link data-tour="focus-quit" href="/dashboard" className="focus-quit" aria-label="Quitter">{'×'}</Link>
          </div>
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

  // ============ phase === 'lobby' : la bibliothèque + "Commencer" ============
  // Modèle Forest : on contemple le jardin, puis on choisit de planter.
  if (phase === 'lobby') {
    const treasures = unlockedTreasuresCount(dayGarden.fichesCount)
    return (
      <div className="focus-root">
        <div className="focus-topbar">
          <div className="focus-brand">
            <span className="focus-brand-dot" aria-hidden="true" />
            MedRev <span className="focus-brand-mode">focus</span>
          </div>
          <div className="focus-topbar-right">
            <button type="button" onClick={toggleFullscreen} className={`focus-immersive${isFullscreen ? ' active' : ''}`} aria-label={isFullscreen ? 'Sortir du plein écran' : 'Mode immersif'} title={isFullscreen ? 'Sortir du plein écran (Esc)' : 'Mode immersif (plein écran + écran allumé)'}>{isFullscreen ? '⊟' : '⊞'}</button>
            <Link data-tour="focus-quit" href="/dashboard" className="focus-quit" aria-label="Quitter">{'×'}</Link>
          </div>
        </div>

        <div className="focus-stage">
          {/* La bibliothèque entière, sans rien devant */}
          <div className="focus-garden">
            <BibliothecaSvg
              fichesCount={dayGarden.fichesCount}
              className="focus-garden-svg"
              preserveAspectRatio="xMidYMid slice"
            />
          </div>

          {/* Jalons sur la gauche */}
          <BibliothecaTreasuresPanel fichesCount={dayGarden.fichesCount} />

          {/* Invitation à la session, en bas au centre */}
          <div className="focus-lobby-card">
            <div className="focus-lobby-kicker">Bibliotheca · {dayGarden.fichesCount} ouvrage{dayGarden.fichesCount > 1 ? 's' : ''} · {treasures}/6 trésors</div>
            <div className="focus-lobby-title">
              {queue.length} fiche{queue.length > 1 ? 's' : ''} à réviser
            </div>
            <div className="focus-lobby-sub">
              Chaque fiche notée ajoute un livre à ta bibliothèque.
            </div>
            <button
              type="button"
              className="focus-lobby-start"
              onClick={() => {
                setStartedAt(Date.now())
                setNow(Date.now())
                setPhase('session')
              }}
            >
              Commencer la session →
            </button>
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
    const sessionElapsedMs = Math.max(0, now - startedAt)
    // Livres ajoutés à la bibliothèque pendant cette session : différence entre
    // le nombre de fiches notées avant et après. 1 fiche notée = 1 livre.
    const sessionBooks = Math.max(0, dayGarden.fichesCount - sessionStartFichesCount)
    // Trésors débloqués pendant cette session (paliers franchis)
    const treasuresAtStart = unlockedTreasuresCount(sessionStartFichesCount)
    const treasuresAtEnd = unlockedTreasuresCount(dayGarden.fichesCount)
    const sessionTreasuresUnlocked = Math.max(0, treasuresAtEnd - treasuresAtStart)

    return (
      <div className="focus-root">
        {/* TOP BAR (overlay glass sur le ciel) */}
        <div className="focus-topbar">
          <div className="focus-brand">
            <span className="focus-brand-dot" aria-hidden="true" />
            MedRev <span className="focus-brand-mode">focus</span>
          </div>
          <div className="focus-topbar-right">
            <button type="button" onClick={toggleFullscreen} className={`focus-immersive${isFullscreen ? ' active' : ''}`} aria-label={isFullscreen ? 'Sortir du plein écran' : 'Mode immersif'} title={isFullscreen ? 'Sortir du plein écran (Esc)' : 'Mode immersif (plein écran + écran allumé)'}>{isFullscreen ? '⊟' : '⊞'}</button>
            <Link data-tour="focus-quit" href="/dashboard" className="focus-quit" aria-label="Quitter">{'×'}</Link>
          </div>
        </div>

        <div className="focus-stage">

          {/* BIBLIOTHÈQUE visible en fond — état cumulé annuel (livres + trésors débloqués) */}
          <div className="focus-garden">
            <BibliothecaSvg
              fichesCount={dayGarden.fichesCount}
              className="focus-garden-svg"
              preserveAspectRatio="xMidYMid slice"
            />
          </div>

          {/* CARD bilan à GAUCHE pour laisser la bibliothèque visible à droite */}
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

              {/* Recap : livres ajoutés à la bibliothèque + trésors débloqués */}
              <div className="focus-done-recap">
                <div className="focus-done-recap-row">
                  <span className="focus-done-recap-icon" aria-hidden="true">{'\u{1F4DA}'}</span>
                  <span className="focus-done-recap-text">
                    {sessionBooks > 0 ? (
                      <>Tu as ajouté <strong>{sessionBooks}</strong> {sessionBooks > 1 ? 'ouvrages' : 'ouvrage'} à ta bibliothèque</>
                    ) : (
                      <>Aucune fiche notée cette session — la bibliothèque attend</>
                    )}
                  </span>
                </div>
                {sessionTreasuresUnlocked > 0 ? (
                  <div className="focus-done-recap-gains">
                    <div className="focus-done-recap-gains-lbl">Trésors débloqués cette session</div>
                    <div className="focus-done-recap-gains-row">
                      <span className="focus-done-recap-pill rare">
                        <strong>{sessionTreasuresUnlocked}</strong> {sessionTreasuresUnlocked > 1 ? 'nouveaux trésors' : 'nouveau trésor'}
                      </span>
                    </div>
                  </div>
                ) : upcomingTreasure ? (
                  <div className="focus-done-recap-empty">
                    Prochain trésor : <strong>{upcomingTreasure.name}</strong> à <strong>{upcomingTreasure.at} h</strong> ({upcomingTreasure.at - dayGarden.fichesCount} fiches restantes).
                  </div>
                ) : (
                  <div className="focus-done-recap-empty">Tous les trésors sont débloqués — bravo !</div>
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

          {/* Panel trésors sur la droite (la card de bilan est à gauche) */}
          <BibliothecaTreasuresPanel
            fichesCount={dayGarden.fichesCount}
            className="bib-treasures-right"
          />
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
          {/* Compteur-bibliothèque : cible du vol du livre refermé.
              key = re-pop de l'anim à chaque livre rangé. */}
          <div
            className="focus-lib-chip"
            ref={libChipRef}
            title="Livres rangés dans ta bibliothèque cette session"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4H6.5A2.5 2.5 0 0 0 4 6.5v13ZM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-2.5" />
            </svg>
            <strong key={Math.max(0, dayGarden.fichesCount - sessionStartFichesCount)} className="focus-lib-chip-num">
              +{Math.max(0, dayGarden.fichesCount - sessionStartFichesCount)}
            </strong>
          </div>
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
          <button type="button" onClick={toggleFullscreen} className={`focus-immersive${isFullscreen ? ' active' : ''}`} aria-label={isFullscreen ? 'Sortir du plein écran' : 'Mode immersif'} title={isFullscreen ? 'Sortir du plein écran (Esc)' : 'Mode immersif (plein écran + écran allumé)'}>{isFullscreen ? '⊟' : '⊞'}</button>
          <Link data-tour="focus-quit" href="/dashboard" className="focus-quit" aria-label="Quitter la session">{'×'}</Link>
        </div>
      </div>

      {/* STAGE de session : ÉPURÉ. Pas de bibliothèque, pas de panel —
          seulement le livre qui s'écrit (hero) + la card de notation.
          La bibliothèque se contemple au lobby et au bilan (modèle Forest). */}
      <div className="focus-stage">

        {/* Fond sobre : dégradé marine + vignette, rien d'autre */}
        <div className="focus-session-bg" aria-hidden="true" />

        {/* LE LIVRE : héros de la session, il s'écrit en temps réel.
            Remonté (key) à chaque fiche → chrono et pages repartent à zéro. */}
        <LiveBook
          key={`${current.lesson.id}-${currentIdx}`}
          lessonName={current.lesson.name}
          className="lb-desk-hero"
        />

        {/* GHOST : livre refermé qui vole du pupitre vers le compteur-
            bibliothèque. Séparé du pupitre pour survivre au changement de fiche. */}
        {bookFly && (
          <div
            key={bookFly.ts}
            className="lb-ghost"
            style={{
              ['--tx' as never]: `${bookFly.x.toFixed(0)}px`,
              ['--ty' as never]: `${bookFly.y.toFixed(0)}px`,
            }}
            onAnimationEnd={() => setBookFly(null)}
            aria-hidden="true"
          />
        )}

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

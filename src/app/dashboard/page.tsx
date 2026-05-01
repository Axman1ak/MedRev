'use client'
// src/app/dashboard/page.tsx

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import BibliothecaSvg, { BibliothecaTreasuresPanel, BIBLIOTHECA_TOTAL_CAPACITY, BIBLIOTHECA_TREASURES, unlockedTreasuresCount, nextTreasure as nextBibTreasure } from '@/components/BibliothecaSvg'
import type { System, Lesson } from '@/types'
import './styles.css'

const J = [0, 1, 3, 5, 7, 15, 21, 30, 45, 60, 75, 90, 105, 120]
const FRAGILE_THRESHOLD = 3 // fiche considérée fragile si moyenne < 3

// ======================= TYPES =======================
type Score = 1 | 2 | 3 | 4 | 5
type StepEntry = { score?: Score; ok?: boolean; date?: string; note?: string } | null
type ScoreClass = 's1' | 's2' | 's3' | 's4' | 's5'

type DueInfo = {
  stepIndex: number
  dueDate: string
  status: 'missed' | 'today'
  overdueDays: number
}

type PriorityLesson = {
  lesson: Lesson
  due: DueInfo
  lastScore: Score | null
  priority: number
}

type FragileFiche = {
  lesson: Lesson
  avg: number
  last3: Score[]
  nextRevDate: string | null
}

type MatiereStat = {
  system: System
  totalFiches: number
  fichesWithScores: number
  avgScore: number | null
  fragile: FragileFiche[]
  okCount: number
}

type WeekDay = { label: string; date: string; active: boolean; isToday: boolean; inFuture: boolean }

// ======================= DATE HELPERS =======================
function dateStrFromOffset(base: string, offset: number): string {
  const d = new Date(base + 'T12:00:00')
  d.setDate(d.getDate() + offset)
  return d.toISOString().split('T')[0]
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)
}

// ======================= STEP HELPERS =======================
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

function getAverageScore(lesson: Lesson): number | null {
  const steps = (lesson.steps as StepEntry[]) || []
  let sum = 0, n = 0
  for (let i = 0; i < J.length; i++) {
    const sc = stepScore(steps[i])
    if (sc) { sum += sc; n++ }
  }
  return n > 0 ? sum / n : null
}

function getLast3Scores(lesson: Lesson): Score[] {
  const steps = (lesson.steps as StepEntry[]) || []
  const out: Score[] = []
  for (let i = J.length - 1; i >= 0 && out.length < 3; i--) {
    const sc = stepScore(steps[i])
    if (sc) out.unshift(sc)
  }
  return out
}

function getNextRevDate(lesson: Lesson): string | null {
  if (!lesson.learn_date) return null
  const steps = (lesson.steps as StepEntry[]) || []
  for (let i = 0; i < J.length; i++) {
    if (!stepScore(steps[i])) return stepDate(lesson, i)
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
    break // steps are chronological
  }
  return null
}

// ======================= PRIORITY / QUEUE =======================
function computeTodayQueue(lessons: Lesson[], today: string): PriorityLesson[] {
  const out: PriorityLesson[] = []
  for (const l of lessons) {
    const due = getDueForToday(l, today)
    if (!due) continue
    const lastScore = getLastScore(l)
    // Priority: lower = more urgent
    // Groupes : missed (0-999) < due with score (1000-5999) < new, no prior score (6000+)
    let priority: number
    if (due.status === 'missed') {
      // plus overdue + plus faible = plus urgent
      priority = -due.overdueDays * 100 + (lastScore ?? 3) * 10
    } else if (lastScore !== null) {
      priority = 1000 + lastScore * 100
    } else {
      priority = 6000 + due.stepIndex
    }
    out.push({ lesson: l, due, lastScore, priority })
  }
  return out.sort((a, b) => a.priority - b.priority)
}

// ======================= STREAK / REGULARITY =======================
function buildActiveDaysSet(lessons: Lesson[]): Set<string> {
  const set = new Set<string>()
  for (const l of lessons) {
    const steps = (l.steps as StepEntry[]) || []
    for (const s of steps) {
      if (!s) continue
      if (stepScore(s) === null) continue
      if (s.date) set.add(s.date)
    }
  }
  return set
}

function computeStreak(activeDays: Set<string>, today: string): number {
  let streak = 0
  let cursor = today
  // si aujourd'hui pas encore actif, on part d'hier (le streak tient toujours)
  if (!activeDays.has(cursor)) cursor = dateStrFromOffset(cursor, -1)
  while (activeDays.has(cursor)) {
    streak++
    cursor = dateStrFromOffset(cursor, -1)
  }
  return streak
}

function computeRecordStreak(activeDays: Set<string>): number {
  const sorted = Array.from(activeDays).sort()
  if (sorted.length === 0) return 0
  let max = 1, cur = 1
  for (let i = 1; i < sorted.length; i++) {
    if (daysBetween(sorted[i - 1], sorted[i]) === 1) {
      cur++
      if (cur > max) max = cur
    } else {
      cur = 1
    }
  }
  return max
}

function computeWeek(activeDays: Set<string>, today: string): WeekDay[] {
  const labels = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
  const d = new Date(today + 'T12:00:00')
  const dayOfWeek = d.getDay() // 0=dim
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const out: WeekDay[] = []
  for (let i = 0; i < 7; i++) {
    const t = new Date(d)
    t.setDate(d.getDate() + mondayOffset + i)
    const dateStr = t.toISOString().split('T')[0]
    out.push({
      label: labels[i],
      date: dateStr,
      active: activeDays.has(dateStr),
      isToday: dateStr === today,
      inFuture: dateStr > today,
    })
  }
  return out
}

// ======================= HEATMAP (4 semaines) =======================
// Construit une grille 4 semaines × 7 jours pour l'affichage régularité.
// La dernière semaine = semaine courante (lun-dim). Les 3 précédentes complètes.
type HeatmapCell = { date: string; active: boolean; isToday: boolean; inFuture: boolean }

function computeHeatmap(activeDays: Set<string>, today: string, weeksBack: number = 4): HeatmapCell[][] {
  const d = new Date(today + 'T12:00:00')
  const dayOfWeek = d.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const weeks: HeatmapCell[][] = []
  // weeksBack-1 semaines avant la courante, puis la courante en dernier
  for (let w = weeksBack - 1; w >= 0; w--) {
    const week: HeatmapCell[] = []
    for (let i = 0; i < 7; i++) {
      const t = new Date(d)
      t.setDate(d.getDate() + mondayOffset + i - w * 7)
      const dateStr = t.toISOString().split('T')[0]
      week.push({
        date: dateStr,
        active: activeDays.has(dateStr),
        isToday: dateStr === today,
        inFuture: dateStr > today,
      })
    }
    weeks.push(week)
  }
  return weeks
}

// ======================= UPCOMING LOAD =======================
type WeekLoad = { label: string; count: number }

function computeUpcomingLoad(lessons: Lesson[], today: string): WeekLoad[] {
  const d = new Date(today + 'T12:00:00')
  const dayOfWeek = d.getDay()
  // décalage jusqu'au lundi suivant (exclu la semaine en cours)
  const nextMondayOffset = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  const weekStarts: string[] = []
  for (let w = 0; w < 4; w++) {
    const s = new Date(d)
    s.setDate(d.getDate() + nextMondayOffset + w * 7)
    weekStarts.push(s.toISOString().split('T')[0])
  }
  const counts = [0, 0, 0, 0]
  for (const l of lessons) {
    if (!l.learn_date) continue
    const steps = (l.steps as StepEntry[]) || []
    for (let i = 0; i < J.length; i++) {
      if (stepScore(steps[i])) continue
      const dd = stepDate(l, i)
      for (let w = 0; w < 4; w++) {
        const end = dateStrFromOffset(weekStarts[w], 6)
        if (dd >= weekStarts[w] && dd <= end) {
          counts[w]++
          break
        }
      }
    }
  }
  return counts.map((c, i) => ({ label: `S+${i + 1}`, count: c }))
}

// ======================= MATIÈRE STATS =======================
function computeMatiereStats(systems: System[], lessons: Lesson[]): MatiereStat[] {
  const out: MatiereStat[] = []
  for (const sys of systems) {
    const sysLessons = lessons.filter(l => l.system_id === sys.id)
    let sum = 0, n = 0
    const fragile: FragileFiche[] = []
    for (const l of sysLessons) {
      const avg = getAverageScore(l)
      if (avg === null) continue
      sum += avg; n++
      if (avg < FRAGILE_THRESHOLD) {
        fragile.push({
          lesson: l,
          avg,
          last3: getLast3Scores(l),
          nextRevDate: getNextRevDate(l),
        })
      }
    }
    fragile.sort((a, b) => a.avg - b.avg)
    out.push({
      system: sys,
      totalFiches: sysLessons.length,
      fichesWithScores: n,
      avgScore: n > 0 ? sum / n : null,
      fragile,
      okCount: Math.max(0, sysLessons.length - fragile.length),
    })
  }
  // Filtre : matières avec au moins une fiche notée
  const withData = out.filter(m => m.fichesWithScores > 0)
  // Tri par avg ascendant (plus faible en premier)
  withData.sort((a, b) => (a.avgScore ?? 999) - (b.avgScore ?? 999))
  return withData
}

// ======================= STYLING HELPERS =======================
function scoreClass(avg: number | null): ScoreClass {
  if (avg === null) return 's3'
  if (avg < 2) return 's1'
  if (avg < 3) return 's2'
  if (avg < 3.7) return 's3'
  if (avg < 4.5) return 's4'
  return 's5'
}

function scoreLabel(avg: number | null): string {
  const cls = scoreClass(avg)
  if (cls === 's1') return 'À retravailler'
  if (cls === 's2') return 'Fragile'
  if (cls === 's3') return 'Moyen'
  if (cls === 's4') return 'Bien'
  return 'Maîtrisée'
}

function formatDateFR(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

function buildMetaForDue(due: DueInfo, systemName: string, lastScore: Score | null): { text: string; withOverdue: boolean } {
  const parts: string[] = []
  if (due.status === 'missed') {
    parts.push(`J+${J[due.stepIndex]} manqué depuis ${due.overdueDays} j`)
  } else if (lastScore === null && due.stepIndex === 0) {
    parts.push(`J+0 nouvelle fiche`)
  } else {
    parts.push(`J+${J[due.stepIndex]} dû aujourd'hui`)
  }
  parts.push(systemName)
  if (lastScore !== null) parts.push(`dernière ${lastScore}/5`)
  return { text: parts.join(' · '), withOverdue: due.status === 'missed' }
}

// ======================= MINI BIBLIOTHÈQUE (lecture du state Focus) =======================
// On ne fait QUE lire l'état de la bibliothèque (localStorage prioritaire, Supabase optionnel).
// La culture se fait sur la page /dashboard/focus — ici on l'expose en aperçu via le
// composant <BibliothecaSvg> partagé pour un rendu strictement identique.
type BibSnapshot = { elapsedMs: number; fichesCount: number }

function readBibLocal(userId: string): BibSnapshot {
  if (typeof window === 'undefined') return { elapsedMs: 0, fichesCount: 0 }
  try {
    const raw = localStorage.getItem('medrev-garden-' + userId)
    if (!raw) return { elapsedMs: 0, fichesCount: 0 }
    const parsed = JSON.parse(raw)
    return {
      elapsedMs: Number(parsed.elapsedMs ?? 0),
      fichesCount: Number(parsed.fichesCount ?? 0),
    }
  } catch {
    return { elapsedMs: 0, fichesCount: 0 }
  }
}

// ======================= MINI BIBLIOTHÈQUE COMPONENT =======================
// Aperçu compact de la bibliothèque annuelle. Utilise <BibliothecaSvg> pour
// un rendu identique au focus, juste à plus petite échelle.
function DashGarden({
  userId, queueLength, startHref,
}: { userId: string | null; queueLength: number; startHref: string }) {
  const supabase = createClient()
  const [bib, setBib] = useState<BibSnapshot | null>(null)

  useEffect(() => {
    if (!userId) return
    setBib(readBibLocal(userId))
    // Pull cloud (best-effort) si plus à jour que local
    void (async () => {
      try {
        const { data } = await supabase
          .from('gardens')
          .select('elapsed_ms, fiches_count')
          .eq('user_id', userId)
          .maybeSingle()
        if (!data) return
        const cloudElapsed = Number((data as any).elapsed_ms ?? 0)
        const cloudFiches = Number((data as any).fiches_count ?? 0)
        setBib(prev => {
          const local = prev ?? { elapsedMs: 0, fichesCount: 0 }
          return {
            elapsedMs: Math.max(local.elapsedMs, cloudElapsed),
            fichesCount: Math.max(local.fichesCount, cloudFiches),
          }
        })
      } catch {
        // swallow
      }
    })()

    // Re-load si Focus écrit dans localStorage pendant que le dashboard est ouvert.
    if (!userId) return
    const uid: string = userId
    function onStorage(e: StorageEvent) {
      if (e.key === 'medrev-garden-' + uid) setBib(readBibLocal(uid))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [userId, supabase])

  // Refresh visibilité si on revient sur l'onglet (ex: après une session focus).
  useEffect(() => {
    if (!userId) return
    const uid = userId
    function onVisible() {
      if (document.visibilityState === 'visible') setBib(readBibLocal(uid))
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [userId])

  const fichesCount = bib?.fichesCount ?? 0
  const treasures = unlockedTreasuresCount(fichesCount)
  const upcoming = nextBibTreasure(fichesCount)

  const [showFullscreen, setShowFullscreen] = useState(false)

  // Fermeture modale par ESC
  useEffect(() => {
    if (!showFullscreen) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setShowFullscreen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showFullscreen])

  return (
    <>
      <aside className="dash-bib-side" aria-label="Ma bibliothèque">
        <div className="dash-bib-thumb">
          <BibliothecaSvg fichesCount={fichesCount} />
        </div>
        <div className="dash-bib-stats">
          <span className="dash-bib-stats-num">{fichesCount}</span>
          <span className="dash-bib-stats-tot">/ {BIBLIOTHECA_TOTAL_CAPACITY}</span>
          <span className="dash-bib-stats-lbl">Ouvrages</span>
        </div>
        <div className="dash-bib-tres">
          <div className="dash-bib-tres-dots" aria-hidden="true">
            {BIBLIOTHECA_TREASURES.map(t => (
              <span key={t.unlockAt} className={`dash-bib-tres-dot${fichesCount >= t.unlockAt ? ' on' : ''}`} title={`${t.unlockAt}h · ${t.name}`} />
            ))}
          </div>
          <span className="dash-bib-tres-lbl">
            {treasures}/6 trésors{upcoming ? ` · prochain à ${upcoming.at} h` : ' · complet'}
          </span>
        </div>
        <Link
          href={queueLength > 0 ? startHref : '#'}
          className={`dash-bib-cta${queueLength === 0 ? ' disabled' : ''}`}
          aria-disabled={queueLength === 0}
        >
          {queueLength === 0
            ? 'Aucune révision aujourd\'hui'
            : `Démarrer · ${queueLength} ${queueLength > 1 ? 'fiches' : 'fiche'}`}
        </Link>
        <button
          type="button"
          className="dash-bib-link"
          onClick={() => setShowFullscreen(true)}
        >
          Voir ma bibliothèque entièrement →
        </button>
      </aside>

      {showFullscreen && (
        <div
          className="dash-bib-fullscreen"
          role="dialog"
          aria-label="Bibliothèque complète"
          onClick={() => setShowFullscreen(false)}
        >
          <button
            type="button"
            className="dash-bib-fullscreen-close"
            onClick={() => setShowFullscreen(false)}
            aria-label="Fermer"
          >×</button>
          <div className="dash-bib-fullscreen-stage" onClick={e => e.stopPropagation()}>
            <BibliothecaSvg fichesCount={fichesCount} className="dash-bib-fullscreen-svg" />
            <BibliothecaTreasuresPanel fichesCount={fichesCount} className="dash-bib-fullscreen-panel" />
          </div>
        </div>
      )}
    </>
  )
}

// ======================= MAIN COMPONENT =======================
export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<{ name?: string } | null>(null)
  const [systems, setSystems] = useState<System[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [semester, setSemester] = useState<1 | 2>(2)
  const [showTodayModal, setShowTodayModal] = useState(false)
  const [showWeakModal, setShowWeakModal] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const firstName = profile?.name?.split(' ')[0] ?? ''

  const load = useCallback(async (uid: string) => {
    const [{ data: sys }, { data: les }] = await Promise.all([
      supabase.from('systems').select('*').eq('user_id', uid).order('semestre').order('created_at'),
      supabase.from('lessons').select('*').eq('user_id', uid).order('created_at'),
    ])
    setSystems((sys as System[] | null) ?? [])
    setLessons((les as Lesson[] | null) ?? [])
  }, [supabase])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      setUserId(user.id)
      supabase.from('profiles').select('*').eq('id', user.id).single()
        .then(({ data }) => {
          if (data) {
            const displayName =
              (user.user_metadata as { username?: string; name?: string })?.username ||
              (user.user_metadata as { username?: string; name?: string })?.name ||
              (data as { name?: string }).name ||
              user.email?.split('@')[0] || ''
            setProfile({ name: displayName })
          }
        })
      load(user.id)
    })
  }, [load, router, supabase])

  // Écoute le toggle Sem 1 / Sem 2 depuis le layout
  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem('medrev-sem')
    setSemester(raw === '1' ? 1 : 2)
    function handler(e: Event) {
      const detail = (e as CustomEvent<1 | 2>).detail
      if (detail === 1 || detail === 2) setSemester(detail)
    }
    window.addEventListener('medrev-sem-change', handler)
    return () => window.removeEventListener('medrev-sem-change', handler)
  }, [])

  // Fermeture modale par ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowTodayModal(false)
        setShowWeakModal(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Reset du scroll à chaque entrée sur le dashboard (évite le décalage
  // hérité d'une autre page comme /dashboard/fiches qui scrolle le <main>)
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo(0, 0)
    const main = document.querySelector('main')
    if (main) main.scrollTop = 0
  }, [])

  // ================= DONNÉES DÉRIVÉES =================
  const semSystems = useMemo(() => systems.filter(s => s.semestre === semester), [systems, semester])
  const semSystemIds = useMemo(() => new Set(semSystems.map(s => s.id)), [semSystems])
  const semLessons = useMemo(() => lessons.filter(l => semSystemIds.has(l.system_id)), [lessons, semSystemIds])

  const todayQueue = useMemo(() => computeTodayQueue(semLessons, today), [semLessons, today])
  const activeDays = useMemo(() => buildActiveDaysSet(semLessons), [semLessons])
  const streak = useMemo(() => computeStreak(activeDays, today), [activeDays, today])
  const recordStreak = useMemo(() => computeRecordStreak(activeDays), [activeDays])
  const weekDays = useMemo(() => computeWeek(activeDays, today), [activeDays, today])
  const heatmap = useMemo(() => computeHeatmap(activeDays, today, 4), [activeDays, today])
  const upcomingLoad = useMemo(() => computeUpcomingLoad(semLessons, today), [semLessons, today])
  const matiereStats = useMemo(() => computeMatiereStats(semSystems, semLessons), [semSystems, semLessons])

  // Nombre de jours actifs cette semaine jusqu'à aujourd'hui (inclus)
  const weekDone = weekDays.filter(d => d.active && !d.inFuture).length
  // Une semaine = 7 jours (lun-dim), même si on est mercredi.
  const weekTotal = 7

  // Point faible principal
  const weakest = matiereStats[0] ?? null
  const weakestFragile = weakest?.fragile.slice(0, 2) ?? []

  // Charge : peak
  const loadMax = Math.max(1, ...upcomingLoad.map(w => w.count))
  const peakIdx = upcomingLoad.findIndex(w => w.count === loadMax && loadMax > 0)

  // Session focus — ouvre /dashboard/focus avec la queue complète.
  // Le focus gère l'ordre suggéré ; les flèches permettent de naviguer.
  const startSessionHref = '/dashboard/focus'

  // Label du jour
  const todayLabel = new Date(today + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric'
  })

  if (!userId) return null

  return (
    <div className="dash-page">

      {/* ====== TOP BAR ====== */}
      <div className="dash-top">
        <div>
          <h1 className="dash-title">
            {firstName ? <>Bonjour <em>{firstName}</em></> : <>Bonjour</>}
          </h1>
          <div className="dash-hello">Encore une journée pour avancer.</div>
        </div>
        <div className="dash-date">{todayLabel}</div>
      </div>

      {/* ====== 4 ZONES ====== */}
      <div className="dash">

        {/* ZONE 1 : AUJOURD'HUI */}
        <div className="today">
          <div className="today-left">
            <div className="today-head">
              <span className="today-label"><span className="today-label-dot" /> Aujourd&apos;hui</span>
              {todayQueue.length > 5 && (
                <button className="see-more" onClick={() => setShowTodayModal(true)}>
                  Voir les {todayQueue.length} révisions
                </button>
              )}
            </div>

            {todayQueue.length === 0 ? (
              <>
                <h2 className="today-intro">Aucune révision pour aujourd&apos;hui</h2>
                <div className="today-sub">Profite de ta journée — ou ajoute des fiches pour démarrer.</div>
                <div className="today-empty">Rien à faire aujourd&apos;hui.</div>
              </>
            ) : (
              <>
                <h2 className="today-intro">
                  Voici tes <em>révisions du jour</em>, dans l&apos;ordre suggéré
                </h2>
                <div className="today-sub">
                  le premier item est prioritaire — tu peux skip ou reporter à tout moment
                </div>

                <div className="today-list">
                  {todayQueue.slice(0, 5).map((p, idx) => {
                    const sys = semSystems.find(s => s.id === p.lesson.system_id)
                    const sysName = sys?.name ?? 'Matière'
                    const meta = buildMetaForDue(p.due, sysName, p.lastScore)
                    const highlight = idx === 0
                    return (
                      <div key={p.lesson.id} className={`today-item${highlight ? ' highlight' : ''}`}>
                        <div className="today-item-icon">{highlight ? '!' : idx + 1}</div>
                        <div className="today-item-main">
                          <div className="today-item-name">{p.lesson.name}</div>
                          <div className="today-item-meta">
                            {meta.withOverdue
                              ? <><strong>J+{J[p.due.stepIndex]} manqué depuis {p.due.overdueDays} j</strong> · {sysName}{p.lastScore !== null ? ` · dernière ${p.lastScore}/5` : ''}</>
                              : meta.text}
                          </div>
                        </div>
                        <div className="today-item-arrow">{'\u2192'}</div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* Mini-jardin remplace le side panel CTA. La session focus se lance
              depuis le bouton intégré au jardin. */}
          <DashGarden
            userId={userId}
            queueLength={todayQueue.length}
            startHref={startSessionHref}
          />
        </div>

        {/* ZONES 2, 3, 4 */}
        <div className="dash-row">

          {/* ZONE 2 : POINT FAIBLE — refonte lisibilité.
              1 chiffre dominant (le score moyen, 44px), 1 visualisation (5 dots du score),
              max 2 fiches fragiles avec leur score, CTA en bas. */}
          <div className="dash-card weak-card">
            <div className="dash-card-title with-action">
              Point faible
              {matiereStats.length > 0 && (
                <button className="see-more" onClick={() => setShowWeakModal(true)}>
                  Tout voir
                </button>
              )}
            </div>

            {weakest === null ? (
              <div className="weak-empty">
                Pas encore assez de notes pour identifier un point faible.
              </div>
            ) : (
              <>
                <div className="weak-hero">
                  <div className="weak-hero-left">
                    <div className="weak-hero-matiere">{weakest.system.name}</div>
                    <div className="weak-hero-label">{scoreLabel(weakest.avgScore)}</div>
                  </div>
                  <div className={`weak-hero-num ${scoreClass(weakest.avgScore)}`}>
                    <span className="weak-hero-num-val">{weakest.avgScore !== null ? weakest.avgScore.toFixed(1) : '—'}</span>
                    <span className="weak-hero-num-max">/5</span>
                  </div>
                </div>

                {weakestFragile.length > 0 ? (
                  <div className="weak-list">
                    {weakestFragile.slice(0, 2).map(f => {
                      const cls = scoreClass(f.avg)
                      return (
                        <div key={f.lesson.id} className="weak-item">
                          <div className="weak-item-name">{f.lesson.name}</div>
                          <span className={`weak-chip ${cls}`}>{f.avg.toFixed(1)}</span>
                        </div>
                      )
                    })}
                    {weakestFragile.length > 2 && (
                      <div className="weak-more">+ {weakestFragile.length - 2} autre{weakestFragile.length - 2 > 1 ? 's' : ''}</div>
                    )}
                  </div>
                ) : (
                  <div className="weak-noframe">Aucune fiche fragile — tu gères.</div>
                )}

                <Link
                  href={`/dashboard/focus?system=${weakest.system.id}`}
                  className="weak-cta"
                  style={{ textDecoration: 'none' }}
                >
                  Retravailler {weakestFragile.length > 0 ? 'ces fiches' : 'cette matière'}
                </Link>
              </>
            )}
          </div>

          {/* ZONE 3 : RÉGULARITÉ — refonte lisibilité.
              1 streak ÉNORME au centre, contexte fusionné, grille 7 jours plus grosse. */}
          <div className="dash-card reg-card">
            <div className="dash-card-title">Régularité</div>

            <div className="reg-hero">
              <div className="reg-hero-left">
                <div className="reg-hero-num">{streak}</div>
                <div className="reg-hero-unit">
                  {streak <= 1 ? 'jour' : 'jours'}<br />
                  <span className="reg-hero-unit-soft">d&apos;affilée</span>
                </div>
              </div>
              <div className="reg-stats">
                Record <strong>{recordStreak} j</strong><br />
                Sem. <strong>{weekDone}/{weekTotal}</strong>
              </div>
            </div>

            <div className="reg-heat-wrap">
              <div className="reg-heat-headers">
                <div className="reg-heat-day">L</div>
                <div className="reg-heat-day">M</div>
                <div className="reg-heat-day">M</div>
                <div className="reg-heat-day">J</div>
                <div className="reg-heat-day">V</div>
                <div className="reg-heat-day">S</div>
                <div className="reg-heat-day">D</div>
              </div>
              {heatmap.map((week, wi) => (
                <div key={wi} className="reg-heatmap">
                  {week.map((cell, ci) => {
                    const cls = [
                      'reg-heat-cell',
                      cell.active && !cell.inFuture ? 'done' : '',
                      cell.isToday ? 'today' : '',
                      cell.inFuture ? 'future' : '',
                    ].filter(Boolean).join(' ')
                    return <div key={ci} className={cls} />
                  })}
                </div>
              ))}
              <div className="reg-heat-axis">
                <span>il y a 4 sem.</span>
                <span>aujourd&apos;hui {'↑'}</span>
              </div>
            </div>
          </div>

          {/* ZONE 4 : CHARGE À VENIR — refonte lisibilité.
              1 total dominant (44px), 4 barres verticales pour les semaines, pic en couleur. */}
          <div className="dash-card load-card">
            <div className="dash-card-title">Charge à venir</div>

            {(() => {
              const total = upcomingLoad.reduce((acc, w) => acc + w.count, 0)
              const showPeak = loadMax > 10
              return (
                <>
                  <div className="load-hero">
                    <div className="load-hero-num">{total}</div>
                    <div className="load-hero-unit">
                      {total <= 1 ? 'fiche' : 'fiches'}<br />
                      <span className="load-hero-unit-soft">sur 4 semaines</span>
                    </div>
                  </div>

                  <div className="load-bars">
                    {upcomingLoad.map((w, i) => {
                      const isPeak = showPeak && i === peakIdx && w.count === loadMax
                      const pct = loadMax > 0 ? Math.max(8, Math.round((w.count / loadMax) * 100)) : 0
                      return (
                        <div key={w.label} className={`load-col${isPeak ? ' peak' : ''}`}>
                          <div className="load-col-bar-wrap">
                            <div
                              className={`load-col-bar${isPeak ? ' peak' : ''}`}
                              style={{ height: w.count > 0 ? `${pct}%` : '6%' }}
                            />
                          </div>
                          <div className="load-col-count">{w.count}</div>
                          <div className="load-col-label">{w.label}</div>
                        </div>
                      )
                    })}
                  </div>

                  {total === 0 ? (
                    <div className="load-note calm"><strong>Aucune révision</strong> prévue.</div>
                  ) : showPeak && peakIdx >= 0 ? (
                    <div className="load-note"><strong>Pic en {upcomingLoad[peakIdx].label}</strong> — pense à étaler.</div>
                  ) : (
                    <div className="load-note calm"><strong>Charge équilibrée</strong> sur 4 sem.</div>
                  )}
                </>
              )
            })()}
          </div>

        </div>
      </div>

      {/* ====== MODALE : AUJOURD'HUI ====== */}
      {showTodayModal && (
        <TodayModal
          queue={todayQueue}
          systems={semSystems}
          startHref={startSessionHref}
          onClose={() => setShowTodayModal(false)}
          todayLabel={todayLabel}
        />
      )}

      {/* ====== MODALE : POINT FAIBLE ====== */}
      {showWeakModal && (
        <WeakModal
          stats={matiereStats}
          onClose={() => setShowWeakModal(false)}
        />
      )}
    </div>
  )
}

// ======================= TODAY MODAL =======================
type TodaySort = 'priority' | 'subject' | 'j'

function TodayModal({
  queue, systems, startHref, onClose, todayLabel,
}: {
  queue: PriorityLesson[]
  systems: System[]
  startHref: string
  onClose: () => void
  todayLabel: string
}) {
  const [sort, setSort] = useState<TodaySort>('priority')
  const [subjectFilter, setSubjectFilter] = useState<string>('all')

  const sortedFiltered = useMemo(() => {
    let list = queue.slice()
    if (subjectFilter !== 'all') {
      list = list.filter(p => p.lesson.system_id === subjectFilter)
    }
    if (sort === 'subject') {
      list.sort((a, b) => {
        const sa = systems.find(s => s.id === a.lesson.system_id)?.name ?? ''
        const sb = systems.find(s => s.id === b.lesson.system_id)?.name ?? ''
        return sa.localeCompare(sb)
      })
    } else if (sort === 'j') {
      list.sort((a, b) => J[a.due.stepIndex] - J[b.due.stepIndex])
    }
    // 'priority' = déjà trié par le calcul
    return list
  }, [queue, systems, sort, subjectFilter])

  const totalMin = queue.length * 8

  const subjectsInQueue = useMemo(() => {
    const ids = new Set(queue.map(p => p.lesson.system_id))
    return systems.filter(s => ids.has(s.id))
  }, [queue, systems])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>

        <div className="full-header">
          <div className="full-title-wrap">
            <div className="full-title-ic">{'\u25CF'}</div>
            <div>
              <h2 className="full-title">Révisions du jour</h2>
              <div className="full-sub">{todayLabel}</div>
            </div>
          </div>
          <button className="full-close" onClick={onClose} aria-label="Fermer">{'\u00D7'}</button>
        </div>

        <div className="full-today-stats">
          <div>
            <div className="full-stat-label">Total</div>
            <div className="full-stat-val"><em>{queue.length}</em> révision{queue.length > 1 ? 's' : ''}</div>
          </div>
          <div>
            <div className="full-stat-label">Temps estimé</div>
            <div className="full-stat-val">~ {totalMin} <span className="small">min</span></div>
          </div>
          <Link href={startHref} className="btn-focus-lg" onClick={onClose}>
            Démarrer la session focus
          </Link>
        </div>

        <div className="full-filters">
          <span className="full-filters-label">Trier par</span>
          <button
            className={`pill${sort === 'priority' ? ' active' : ''}`}
            onClick={() => setSort('priority')}
          >Priorité</button>
          <button
            className={`pill${sort === 'subject' ? ' active' : ''}`}
            onClick={() => setSort('subject')}
          >Matière</button>
          <button
            className={`pill${sort === 'j' ? ' active' : ''}`}
            onClick={() => setSort('j')}
          >Palier J</button>
          <span style={{ flex: 1 }} />
          <span className="full-filters-label">Matière</span>
          <select
            value={subjectFilter}
            onChange={e => setSubjectFilter(e.target.value)}
            style={{
              padding: '5px 10px', border: '1px solid var(--border)',
              borderRadius: 20, background: 'white', fontSize: 11,
              fontFamily: 'inherit', color: 'var(--gray)', cursor: 'pointer',
            }}
          >
            <option value="all">Toutes</option>
            {subjectsInQueue.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <div className="modal-scroll">
          <div className="full-today-list">
            {sortedFiltered.length === 0 ? (
              <div className="full-empty">Aucune fiche ne correspond.</div>
            ) : sortedFiltered.map((p, idx) => {
              const sys = systems.find(s => s.id === p.lesson.system_id)
              const sysName = sys?.name ?? 'Matière'
              const highlight = sort === 'priority' && idx === 0
              const minTime = 8
              return (
                <div key={p.lesson.id} className={`full-row${highlight ? ' highlight' : ''}`}>
                  <div className="full-row-num">{highlight ? '!' : idx + 1}</div>
                  <div>
                    <div className="full-row-name">{p.lesson.name}</div>
                    <div className="full-row-meta">
                      {p.due.status === 'missed'
                        ? <><strong>J+{J[p.due.stepIndex]} manqué depuis {p.due.overdueDays} j</strong> · {sysName} · ~{minTime} min</>
                        : <>J+{J[p.due.stepIndex]} dû aujourd&apos;hui · {sysName} · ~{minTime} min</>}
                    </div>
                  </div>
                  <div className={p.lastScore ? `score-chip s${p.lastScore}` : 'score-chip none'}>
                    {p.lastScore ?? '—'}
                  </div>
                  <div className="full-row-actions">
                    <Link
                      href={`/dashboard/focus?lesson=${p.lesson.id}`}
                      className="row-btn go"
                      onClick={onClose}
                    >
                      Faire
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}

// ======================= WEAK MODAL =======================
function WeakModal({
  stats, onClose,
}: {
  stats: MatiereStat[]
  onClose: () => void
}) {
  const maxAvg = 5
  const chartCols = Math.max(1, stats.length)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>

        <div className="full-header">
          <div className="full-title-wrap">
            <div className="full-title-ic rose">{'\u25C6'}</div>
            <div>
              <h2 className="full-title">Toutes tes matières</h2>
              <div className="full-sub">Classées par moyenne, du plus faible au plus maîtrisé</div>
            </div>
          </div>
          <button className="full-close" onClick={onClose} aria-label="Fermer">{'\u00D7'}</button>
        </div>

        {stats.length > 0 && (
          <div className="full-weak-chart">
            <div className="chart-label">Vue d&apos;ensemble · moyenne par matière</div>
            <div className="chart-bars" style={{ gridTemplateColumns: `repeat(${chartCols}, 1fr)` }}>
              {stats.map(m => {
                const avg = m.avgScore ?? 0
                const pct = Math.max(18, Math.round((avg / maxAvg) * 100))
                const cls = scoreClass(m.avgScore)
                return (
                  <div key={m.system.id} className="chart-col">
                    <div className={`chart-bar ${cls}`} style={{ height: `${pct}%` }}>
                      <div className="chart-bar-v">{avg.toFixed(1)}</div>
                    </div>
                    <div className="chart-name">{m.system.name}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="modal-scroll">
          <div className="full-weak-list">
            {stats.length === 0 ? (
              <div className="full-empty">Pas encore assez de notes pour classer les matières.</div>
            ) : stats.map((m, idx) => {
              const cls = scoreClass(m.avgScore)
              const dotColor = `var(--${cls})`
              return (
                <div key={m.system.id} className="mat-card">
                  <div className="mat-head">
                    <div className="mat-rank">{idx + 1}</div>
                    <div className="mat-name-wrap">
                      <div className="mat-dot" style={{ background: dotColor }} />
                      <div>
                        <div className="mat-name">{m.system.name}</div>
                        <div className="mat-counts">
                          <strong>{m.totalFiches}</strong> fiche{m.totalFiches > 1 ? 's' : ''}
                          {m.fragile.length > 0 ? (
                            <> · <strong className={cls === 's1' ? 's1' : 's2'}>{m.fragile.length} fragile{m.fragile.length > 1 ? 's' : ''}</strong></>
                          ) : (
                            <> · <strong className="s4">0 fragile</strong></>
                          )}
                          {' · '}{m.okCount} OK
                        </div>
                      </div>
                    </div>
                    <div className={`mat-avg ${cls}`}>
                      <span className="mat-avg-n">{m.avgScore !== null ? m.avgScore.toFixed(1) : '—'}</span>
                      <span className="mat-avg-x">/ 5</span>
                    </div>
                  </div>

                  {m.fragile.length > 0 && (
                    <div className="mat-body">
                      {m.fragile.map(f => {
                        const fCls = scoreClass(f.avg)
                        const nextLabel = f.nextRevDate
                          ? (f.nextRevDate === new Date().toISOString().split('T')[0]
                              ? "aujourd'hui"
                              : `prochaine ${formatDateFR(f.nextRevDate)}`)
                          : ''
                        return (
                          <div key={f.lesson.id} className="mat-fiche">
                            <div className={`mat-fiche-bullet ${fCls}`} />
                            <div>
                              <div className="mat-fiche-name">{f.lesson.name}</div>
                              <div className="mat-fiche-meta">
                                {f.last3.length > 0 ? `3 dernières · ${f.last3.join(' · ')}` : 'Pas encore notée'}
                                {nextLabel ? ` · ${nextLabel}` : ''}
                              </div>
                            </div>
                            <div className={`mat-fiche-avg ${fCls}`}>{f.avg.toFixed(1)}</div>
                            <Link
                              href={`/dashboard/focus?lesson=${f.lesson.id}`}
                              className="mat-fiche-cta"
                              onClick={onClose}
                            >
                              Retravailler
                            </Link>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {m.fragile.length === 0 && m.totalFiches > 0 && (
                    <div className="mat-body">
                      <div className="mat-note">Aucune fiche fragile à signaler.</div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}

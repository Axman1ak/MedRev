'use client'
// src/app/dashboard/page.tsx

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import DashTodo from '@/components/DashTodo'
import ReviewModal from '@/components/ReviewModal'
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
  fragile: FragileFiche[]      // avg < FRAGILE_THRESHOLD (3) — utilisé par le modal "Tout voir"
  weakestFiches: FragileFiche[] // toutes les fiches scorées de la matière, triées avg asc — utilisé par la card Point faible
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
// stepScore : lit le score OFFICIEL d'un step. N'inclut PAS temp_score.
// Utilisé partout où la logique de calendrier officiel compte (queue, due,
// nextUndone, etc.) — un step avec uniquement temp_score est "non scoré".
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

// effectiveStepScore : score officiel SI présent, sinon temp_score (retravailler
// en avance). Utilisé pour les agrégations vues par l'utilisateur (avg, last3,
// last) — l'effort de retravailler doit se refléter dans la "santé" d'une fiche
// jusqu'à ce que le vrai J arrive et substitue son score officiel.
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

function getAverageScore(lesson: Lesson): number | null {
  const steps = (lesson.steps as StepEntry[]) || []
  let sum = 0, n = 0
  for (let i = 0; i < J.length; i++) {
    const sc = effectiveStepScore(steps[i])
    if (sc) { sum += sc; n++ }
  }
  return n > 0 ? sum / n : null
}

function getLast3Scores(lesson: Lesson): Score[] {
  const steps = (lesson.steps as StepEntry[]) || []
  const out: Score[] = []
  for (let i = J.length - 1; i >= 0 && out.length < 3; i--) {
    const sc = effectiveStepScore(steps[i])
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

// Reporter / Annuler (colonnes lessons.skips / lessons.postpones — n'affectent
// pas steps, donc moyennes/tampons/stats restent intacts).
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
    if (skips.includes(i)) continue            // palier annulé → on passe au suivant
    const dd = postpones[String(i)] ?? stepDate(lesson, i)  // report éventuel
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
    const allScored: FragileFiche[] = []
    for (const l of sysLessons) {
      const avg = getAverageScore(l)
      if (avg === null) continue
      sum += avg; n++
      const entry: FragileFiche = {
        lesson: l,
        avg,
        last3: getLast3Scores(l),
        nextRevDate: getNextRevDate(l),
      }
      allScored.push(entry)
      if (avg < FRAGILE_THRESHOLD) {
        fragile.push(entry)
      }
    }
    fragile.sort((a, b) => a.avg - b.avg)
    allScored.sort((a, b) => a.avg - b.avg)
    out.push({
      system: sys,
      totalFiches: sysLessons.length,
      fichesWithScores: n,
      avgScore: n > 0 ? sum / n : null,
      fragile,
      weakestFiches: allScored,
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
function DashGarden({ userId }: { userId: string | null }) {
  const supabase = createClient()
  const [bib, setBib] = useState<BibSnapshot | null>(null)

  useEffect(() => {
    if (!userId) return
    setBib(readBibLocal(userId))
    void (async () => {
      try {
        const { data } = await supabase
          .from('gardens')
          .select('elapsed_ms, fiches_count')
          .eq('user_id', userId)
          .maybeSingle()
        if (!data) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cloudFiches = Number((data as any).fiches_count ?? 0)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cloudElapsed = Number((data as any).elapsed_ms ?? 0)
        setBib(prev => {
          const local = prev ?? { elapsedMs: 0, fichesCount: 0 }
          return { elapsedMs: Math.max(local.elapsedMs, cloudElapsed), fichesCount: Math.max(local.fichesCount, cloudFiches) }
        })
      } catch {}
    })()
    const uid: string = userId
    function onStorage(e: StorageEvent) { if (e.key === 'medrev-garden-' + uid) setBib(readBibLocal(uid)) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [userId, supabase])

  useEffect(() => {
    if (!userId) return
    const uid = userId
    function onVisible() { if (document.visibilityState === 'visible') setBib(readBibLocal(uid)) }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [userId])

  const fichesCount = bib?.fichesCount ?? 0
  const treasures = unlockedTreasuresCount(fichesCount)
  const upcoming = nextBibTreasure(fichesCount)
  const progPct = Math.min(100, Math.round((treasures / 6) * 100))

  const shelves = useMemo(() => {
    const cols = ['#15304E', '#22507E', '#2E5E8E', '#3E6F9C', '#6E93B8']
    return [0, 1].map(row => Array.from({ length: 22 }, (_, i) => {
      const gold = (i + row * 5) % 9 === 4
      const sh = cols[(i * 3 + row * 5) % 5]
      const h = 30 + Math.round(Math.abs(Math.sin((i + row * 5) * 1.3)) * 30)
      return { bg: gold ? '#BE914A' : sh, h }
    }))
  }, [])

  return (
    <div className="panel bib reveal d3">
      <div className="phead">
        <div className="picon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 5h6v14H4zM10 5h6v14h-6z" strokeLinejoin="round"/><path d="M16 6l4 .8-2.4 13.3-3.9-.8" strokeLinejoin="round"/></svg></div>
        <div><div className="ptitle">Bibliothèque</div><div className="psub">ta collection grandit</div></div>
      </div>
      <div className="case">
        {shelves.map((row, r) => (
          <div className="shelf" key={r}>
            {row.map((b, i) => <span key={i} className="bk" style={{ background: b.bg, height: b.h }} />)}
          </div>
        ))}
      </div>
      <div className="bib-foot">
        <div className="bignum">{fichesCount} <small>ouvrage{fichesCount > 1 ? 's' : ''}</small></div>
        <div className="tres-pill"><span className="gd" />{treasures} trésor{treasures > 1 ? 's' : ''}</div>
      </div>
      <div className="prog"><i style={{ width: progPct + '%' }} /></div>
      <div className="prog-lbl">{upcoming ? `prochain trésor à ${upcoming.at} h de focus` : 'tous les trésors débloqués'}</div>
    </div>
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
  const [reviewLesson, setReviewLesson] = useState<Lesson | null>(null)
  const [semester, setSemester] = useState<1 | 2 | 'year'>(2)
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

  // Écoute le toggle Sem 1 / Sem 2 / Année depuis le layout
  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem('medrev-sem')
    setSemester(raw === '1' ? 1 : raw === 'year' ? 'year' : 2)
    function handler(e: Event) {
      const detail = (e as CustomEvent<1 | 2 | 'year'>).detail
      if (detail === 1 || detail === 2 || detail === 'year') setSemester(detail)
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
  // En mode 'year' : tous les systèmes ; sinon filtre par semestre
  const semSystems = useMemo(
    () => semester === 'year' ? systems : systems.filter(s => s.semestre === semester),
    [systems, semester]
  )
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
  // On affiche les 2 fiches les plus faibles de la matière (toutes, pas seulement
  // les fragiles avg < 3) — sinon la card est vide quand il n'y a qu'une fragile.
  // Limite à 2 pour éviter le chevauchement avec le bouton "Retravailler" en bas.
  const weakestFragile = weakest?.weakestFiches.slice(0, 2) ?? []

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

  function openReview(lesson: Lesson) { setReviewLesson(lesson) }
  function handleReviewUpdated(updated: Lesson) {
    setLessons(prev => prev.map(l => (l.id === updated.id ? updated : l)))
    setReviewLesson(prev => (prev && prev.id === updated.id ? updated : prev))
  }

  // Reporter à demain / Annuler ce palier — écrit dans lessons.postpones / lessons.skips.
  // MAJ optimiste (la fiche quitte la liste tout de suite) puis persistance Supabase.
  const tomorrow = dateStrFromOffset(today, 1)
  async function postponeStep(lesson: Lesson, stepIndex: number) {
    const postpones = { ...lessonPostpones(lesson), [String(stepIndex)]: tomorrow }
    setLessons(prev => prev.map(l => (l.id === lesson.id ? { ...l, postpones } : l)))
    await supabase.from('lessons').update({ postpones }).eq('id', lesson.id)
  }
  async function skipStep(lesson: Lesson, stepIndex: number) {
    const skips = Array.from(new Set([...lessonSkips(lesson), stepIndex]))
    setLessons(prev => prev.map(l => (l.id === lesson.id ? { ...l, skips } : l)))
    await supabase.from('lessons').update({ skips }).eq('id', lesson.id)
  }
  const reviewSystemName = reviewLesson
    ? (systems.find(s => s.id === reviewLesson.system_id)?.name || '')
    : ''

  if (!userId) return null

  return (
    <div className="dvx">
      <div className="topbar reveal d1">
        <div>
          <div className="kick">{todayLabel}</div>
          <h1 className="hi">Bonjour {firstName}</h1>
        </div>
        <div className="search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4" strokeLinecap="round"/></svg>
          Rechercher une fiche, une matière…
        </div>
      </div>

      <div className="grid">
        <div className="panel reveal d2">
          <div className="phead">
            <div className="picon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 6v14M5 8v11a1 1 0 0 0 1 1h6M19 8v11a1 1 0 0 1-1 1h-6M5 8a3 3 0 0 1 3-3 4 4 0 0 1 4 3 4 4 0 0 1 4-3 3 3 0 0 1 3 3" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
            <div>
              <div className="ptitle">Fiches du jour</div>
              <div className="psub"><b>{todayQueue.length} fiche{todayQueue.length > 1 ? 's' : ''}</b> à réviser</div>
            </div>
            {todayQueue.length > 0 && <Link href={startSessionHref} className="go">Commencer →</Link>}
          </div>
          <div className="flist">
            {todayQueue.length === 0 ? (
              <div style={{ color: 'var(--gray)', fontSize: 14, padding: '24px 0' }}>Aucune révision aujourd&apos;hui. Profite de ta journée !</div>
            ) : todayQueue.slice(0, 6).map((p, idx) => {
              const sys = semSystems.find(s => s.id === p.lesson.system_id)
              const sysName = sys?.name ?? 'Matière'
              const overdue = p.due.status === 'missed'
              const score = p.lastScore || 0
              return (
                <div
                  key={p.lesson.id}
                  className={`fiche${idx === 0 ? ' hot' : ''}`}
                  onClick={() => openReview(p.lesson)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openReview(p.lesson) }}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="ftag">{sysName.slice(0, 2).toUpperCase()}</div>
                  <div className="fmid">
                    <div className="fnm">{p.lesson.name}</div>
                    <div className="fsub">{sysName}
                      <span className="dots">{[1, 2, 3, 4, 5].map(n => <span key={n} className={`dot${n <= score ? ' f' : ''}`} />)}</span>
                    </div>
                  </div>
                  {overdue
                    ? <span className="badge-late">en retard · {p.due.overdueDays} j</span>
                    : <span className="fdue">aujourd&apos;hui</span>}
                  <div className="fiche-actions">
                    <button
                      type="button"
                      className="fa-btn"
                      title="Reporter ce palier à demain"
                      onClick={e => { e.stopPropagation(); postponeStep(p.lesson, p.due.stepIndex) }}
                    >Reporter</button>
                    <button
                      type="button"
                      className="fa-btn fa-skip"
                      title="Annuler ce palier (sauté, sans pénaliser la moyenne)"
                      onClick={e => { e.stopPropagation(); skipStep(p.lesson, p.due.stepIndex) }}
                    >Annuler</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="col-r">
          <DashTodo userId={userId} />
          <DashGarden userId={userId} />
        </div>
      </div>

      {reviewLesson && (
        <ReviewModal
          lesson={reviewLesson}
          systemName={reviewSystemName}
          initialStepIdx={null}
          onClose={() => setReviewLesson(null)}
          onUpdated={handleReviewUpdated}
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
            <div className="full-title-ic">{'●'}</div>
            <div>
              <h2 className="full-title">Révisions du jour</h2>
              <div className="full-sub">{todayLabel}</div>
            </div>
          </div>
          <button className="full-close" onClick={onClose} aria-label="Fermer">{'×'}</button>
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
            <div className="full-title-ic rose">{'◆'}</div>
            <div>
              <h2 className="full-title">Toutes tes matières</h2>
              <div className="full-sub">Classées par moyenne, du plus faible au plus maîtrisé</div>
            </div>
          </div>
          <button className="full-close" onClick={onClose} aria-label="Fermer">{'×'}</button>
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
                      <span className="mat-avg-n">{m.avgScore !== null ? m.avgScore.toFixed(1) : '·'}</span>
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

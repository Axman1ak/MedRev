'use client'
// src/app/dashboard/page.tsx

import { reviewDate } from '@/lib/restDays'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import DashTodo from '@/components/DashTodo'
import ReviewModal from '@/components/ReviewModal'
import SubjectIcon from '@/components/SubjectIcon'
import type { System, Lesson, TdEvent } from '@/types'
import { toDateStr, todayStr } from '@/types'
import { DEFAULT_J, scheduleOf, makeScheduleResolver } from '@/lib/schedule'
import { buildSubjectColorMap } from '@/lib/subjectColors'
import './styles.css'
import { normalizeYear, scopeToYear } from '@/lib/year'
import { useIsNarrow } from '@/lib/useNarrow'
import PageLoader from '@/components/PageLoader'
import { currentSemestre } from '@/lib/semestre'

const J = DEFAULT_J  // fallback ; le vrai planning est lu par matière (scheduleOf)
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
  return toDateStr(d)
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

function stepDate(lesson: Lesson, i: number, j: number[] = DEFAULT_J): string {
  if (!lesson.learn_date) return ''
  return reviewDate(lesson.learn_date, j[i])
}

function getLastScore(lesson: Lesson, j: number[] = DEFAULT_J): Score | null {
  const steps = (lesson.steps as StepEntry[]) || []
  for (let i = j.length - 1; i >= 0; i--) {
    const sc = effectiveStepScore(steps[i])
    if (sc) return sc
  }
  return null
}

function getAverageScore(lesson: Lesson, j: number[] = DEFAULT_J): number | null {
  const steps = (lesson.steps as StepEntry[]) || []
  let sum = 0, n = 0
  for (let i = 0; i < j.length; i++) {
    const sc = effectiveStepScore(steps[i])
    if (sc) { sum += sc; n++ }
  }
  return n > 0 ? sum / n : null
}

function getLast3Scores(lesson: Lesson, j: number[] = DEFAULT_J): Score[] {
  const steps = (lesson.steps as StepEntry[]) || []
  const out: Score[] = []
  for (let i = j.length - 1; i >= 0 && out.length < 3; i--) {
    const sc = effectiveStepScore(steps[i])
    if (sc) out.unshift(sc)
  }
  return out
}

function getNextRevDate(lesson: Lesson, j: number[] = DEFAULT_J): string | null {
  if (!lesson.learn_date) return null
  const steps = (lesson.steps as StepEntry[]) || []
  for (let i = 0; i < j.length; i++) {
    if (!stepScore(steps[i])) return stepDate(lesson, i, j)
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

function getDueForToday(lesson: Lesson, today: string, j: number[] = DEFAULT_J): DueInfo | null {
  if (!lesson.learn_date) return null
  const steps = (lesson.steps as StepEntry[]) || []
  const skips = lessonSkips(lesson)
  const postpones = lessonPostpones(lesson)
  for (let i = 0; i < j.length; i++) {
    if (stepScore(steps[i])) continue
    if (skips.includes(i)) continue            // palier annulé → on passe au suivant
    const dd = postpones[String(i)] ?? stepDate(lesson, i, j)  // report éventuel
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
function computeTodayQueue(lessons: Lesson[], today: string, schedOf: (id: string | null | undefined) => number[]): PriorityLesson[] {
  const out: PriorityLesson[] = []
  for (const l of lessons) {
    const j = schedOf(l.system_id)
    const due = getDueForToday(l, today, j)
    if (!due) continue
    const lastScore = getLastScore(l, j)
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
    const dateStr = toDateStr(t)
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
      const dateStr = toDateStr(t)
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

function computeUpcomingLoad(lessons: Lesson[], today: string, schedOf: (id: string | null | undefined) => number[]): WeekLoad[] {
  const d = new Date(today + 'T12:00:00')
  const dayOfWeek = d.getDay()
  // décalage jusqu'au lundi suivant (exclu la semaine en cours)
  const nextMondayOffset = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  const weekStarts: string[] = []
  for (let w = 0; w < 4; w++) {
    const s = new Date(d)
    s.setDate(d.getDate() + nextMondayOffset + w * 7)
    weekStarts.push(toDateStr(s))
  }
  const counts = [0, 0, 0, 0]
  for (const l of lessons) {
    if (!l.learn_date) continue
    const steps = (l.steps as StepEntry[]) || []
    const j = schedOf(l.system_id)
    for (let i = 0; i < j.length; i++) {
      if (stepScore(steps[i])) continue
      const dd = stepDate(l, i, j)
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
    const j = scheduleOf(sys)
    let sum = 0, n = 0
    const fragile: FragileFiche[] = []
    const allScored: FragileFiche[] = []
    for (const l of sysLessons) {
      const avg = getAverageScore(l, j)
      if (avg === null) continue
      sum += avg; n++
      const entry: FragileFiche = {
        lesson: l,
        avg,
        last3: getLast3Scores(l, j),
        nextRevDate: getNextRevDate(l, j),
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
  return { text: parts.join(', '), withOverdue: due.status === 'missed' }
}

// ======================= CARTE PROGRESSION =======================
// Remplace l'ancienne bibliothèque : des chiffres réels, sans métaphore.
// Temps de travail : gardens.day_log (alimenté par la session de travail).
// Maîtrise : une fiche est maîtrisée quand sa dernière note (officielle ou
// temporaire) vaut 4 ou 5.
function progDayKey(d: Date) { return toDateStr(d) }
function lastEffectiveScore(l: Lesson): number | null {
  const steps = (Array.isArray(l.steps) ? l.steps : []) as StepEntry[]
  for (let i = steps.length - 1; i >= 0; i--) {
    const sc = effectiveStepScore(steps[i])
    if (sc) return sc
  }
  return null
}
function fmtHours(ms: number): string {
  const min = Math.round(ms / 60000)
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`
}

const SUBS_SHOWN = 8 // 4 lignes de 2 : au-delà, petit lien « Voir les N autres »
// lessons / systems : ceux du semestre choisi (S1, S2 ou Année), comme Fiches du jour.
// colorOf : les couleurs de matière partagées avec la page Fiches.
function DashProgress({ userId, lessons, systems, colorOf }: { userId: string | null; lessons: Lesson[]; systems: System[]; colorOf: Map<string, string> }) {
  const supabase = createClient()
  const [dayLog, setDayLog] = useState<Record<string, number>>({})
  const [allSubs, setAllSubs] = useState(false)

  useEffect(() => {
    if (!userId) return
    let off = false
    void (async () => {
      try {
        const { data } = await supabase.from('gardens').select('day_log').eq('user_id', userId).maybeSingle()
        const raw = (data as { day_log?: unknown } | null)?.day_log
        if (off || !raw || typeof raw !== 'object') return
        const out: Record<string, number> = {}
        for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === 'number' && v > 0) out[k] = v
        setDayLog(out)
      } catch {}
    })()
    return () => { off = true }
  }, [userId, supabase])

  const view = useMemo(() => {
    const today = new Date(); today.setHours(12, 0, 0, 0)
    // Série : jours consécutifs avec du travail, jusqu'à aujourd'hui (ou hier si rien encore aujourd'hui)
    let streak = 0
    const d = new Date(today)
    if (!dayLog[progDayKey(d)]) d.setDate(d.getDate() - 1)
    while (dayLog[progDayKey(d)]) { streak++; d.setDate(d.getDate() - 1) }
    // Semaine en cours (depuis lundi)
    const monday = new Date(today); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
    let weekMs = 0
    for (let i = 0; i < 7; i++) { const x = new Date(monday); x.setDate(x.getDate() + i); weekMs += dayLog[progDayKey(x)] ?? 0 }
    // 8 semaines : colonnes = semaines, lignes = lundi..dimanche
    const start = new Date(monday); start.setDate(start.getDate() - 7 * 7)
    const weeks: { key: string; lvl: number; future: boolean; title: string }[][] = []
    for (let w = 0; w < 8; w++) {
      const col = []
      for (let k = 0; k < 7; k++) {
        const x = new Date(start); x.setDate(x.getDate() + w * 7 + k)
        const key = progDayKey(x)
        const min = (dayLog[key] ?? 0) / 60000
        const lvl = min <= 0 ? 0 : min < 30 ? 1 : min < 60 ? 2 : min < 120 ? 3 : 4
        const label = x.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
        col.push({ key, lvl, future: x > today, title: min > 0 ? `${label} : ${fmtHours(min * 60000)}` : `${label} : rien` })
      }
      weeks.push(col)
    }
    // Maîtrise
    const mastered = lessons.filter(l => (lastEffectiveScore(l) ?? 0) >= 4).length
    const subjects = systems
      .map(s => {
        const ls = lessons.filter(l => l.system_id === s.id)
        const m = ls.filter(l => (lastEffectiveScore(l) ?? 0) >= 4).length
        return { id: s.id, name: s.name, total: ls.length, pct: ls.length ? Math.round((m / ls.length) * 100) : 0, color: colorOf.get(s.id) || '#3E6F9C' }
      })
      .filter(s => s.total > 0)
      .sort((a, b) => b.total - a.total)
    return { streak, weekMs, weeks, mastered, subjects }
  }, [dayLog, lessons, systems, colorOf])

  return (
    <div className="panel bib dpg reveal d3">
      <div className="phead">
        <div className="picon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 19V10M10 19V5M16 19v-6M22 19H2" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
        <div><div className="ptitle">Ta progression</div><div className="psub">ton travail, semaine après semaine</div></div>
        <Link href="/dashboard/stats" className="dpg-link">Statistiques</Link>
      </div>
      <div className="dpg-kpis">
        <div><b>{view.streak} j</b><span>d&apos;affilée</span></div>
        <div><b>{fmtHours(view.weekMs)}</b><span>cette semaine</span></div>
        <div><b>{view.mastered} / {lessons.length}</b><span>fiches maîtrisées</span></div>
      </div>
      <div className="dpg-sec">
        <div className="dpg-lbl"><span>8 dernières semaines</span><span>plus foncé = plus de temps</span></div>
        <div className="dpg-heat" role="img" aria-label="Temps de travail par jour sur les 8 dernières semaines">
          {view.weeks.map((col, w) => (
            <div key={w} className="dpg-col">
              {col.map(c => <i key={c.key} className={`l${c.lvl}${c.future ? ' fut' : ''}`} title={c.title} />)}
            </div>
          ))}
        </div>
      </div>
      {view.subjects.length > 0 && (
        <div className="dpg-sec dpg-subs">
          <div className="dpg-lbl"><span>Maîtrise par matière</span><span>dernière note 4 ou 5</span></div>
          <div className="dpg-subgrid">
            {(allSubs ? view.subjects : view.subjects.slice(0, SUBS_SHOWN)).map(s => (
              <div key={s.id} className="dpg-sub" title={`${s.name} : ${s.pct}% des fiches maîtrisées`}>
                <span className="dpg-sub-top">
                  <span className="dpg-sub-n"><span className="dpg-dot" style={{ background: s.color }} />{s.name}</span>
                  <span className="dpg-pct">{s.pct}%</span>
                </span>
                <span className="dpg-bar"><i style={{ width: `${s.pct}%`, background: s.color }} /></span>
              </div>
            ))}
          </div>
          {view.subjects.length > SUBS_SHOWN && (
            <button type="button" className="dpg-more" onClick={() => setAllSubs(v => !v)}>
              {allSubs ? 'Voir moins' : `Voir les ${view.subjects.length - SUBS_SHOWN} autres`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ======================= MAIN COMPONENT =======================
export default function DashboardPage() {
  const supabase = createClient()
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  // Chargement des DONNÉES, pas seulement de l'identité. L'écran ne gardait
  // le loader que tant que `userId` était nul, or il arrive dès que
  // auth.getUser() répond, bien avant les matières et les fiches. Entre les
  // deux, la page s'affichait entièrement vide pendant une seconde.
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<{ name?: string } | null>(null)
  const [systems, setSystems] = useState<System[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [reviewLesson, setReviewLesson] = useState<Lesson | null>(null)
  const [semester, setSemester] = useState<1 | 2 | 'year'>(currentSemestre)
  const [showTodayModal, setShowTodayModal] = useState(false)
  // TD du jour (table td_events) — affichés en tête du panneau Fiches du jour.
  const [todayTds, setTodayTds] = useState<TdEvent[]>([])
  useEffect(() => {
    if (!userId) return
    const dateStr = todayStr()
    supabase
      .from('td_events')
      .select('*')
      .eq('user_id', userId)
      .eq('date', dateStr)
      .order('start_time')
      .then(({ data }) => setTodayTds((data as TdEvent[] | null) ?? []))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])
  const [showWeakModal, setShowWeakModal] = useState(false)
  const flistRef = useRef<HTMLDivElement>(null)
  // h = hauteur dispo, stride = hauteur d'une ligne + gap, btnCost = ce que
  // coûte réellement le bouton « voir plus » dans le flux (sa marge + sa
  // hauteur). Tout est mesuré : une valeur devinée faisait perdre une ligne
  // entière dans certaines hauteurs d'écran.
  const [flistM, setFlistM] = useState<{ h: number; stride: number; gap: number; btnCost: number }>({ h: 0, stride: 74, gap: 9, btnCost: 39 })
  // Sur téléphone la page défile : tronquer la liste pour tenir dans un cadre
  // cacherait douze fiches derrière un bouton alors qu'un coup de pouce suffit.
  const isNarrow = useIsNarrow(900)
  // Téléphone (même seuil que la barre d'onglets) : en-tête « carte », liste façon iOS
  const isPhone = useIsNarrow(768)

  const today = todayStr()

  const firstName = profile?.name?.split(' ')[0] ?? ''

  const load = useCallback(async (uid: string) => {
    const [{ data: sys }, { data: les }, { data: prof }] = await Promise.all([
      supabase.from('systems').select('*').eq('user_id', uid).order('semestre').order('created_at'),
      supabase.from('lessons').select('*').eq('user_id', uid).order('created_at'),
      supabase.from('profiles').select('current_year').eq('id', uid).single(),
    ])
    // On ne montre que l'année d'études en cours. Les autres années restent en
    // base et reviennent dès qu'on rebascule dessus dans les Réglages.
    const year = normalizeYear((prof as { current_year?: string } | null)?.current_year)
    const scoped = scopeToYear(
      (sys as System[] | null) ?? [],
      (les as Lesson[] | null) ?? [],
      year,
    )
    setSystems(scoped.systems)
    setLessons(scoped.lessons)
    setLoading(false)
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
      // Un échec réseau ne doit pas laisser le loader tourner pour toujours :
      // mieux vaut un écran vide qu'un écran qui ment.
      load(user.id).catch(() => setLoading(false))
    })
  }, [load, router, supabase])

  // Écoute le toggle Sem 1 / Sem 2 / Année depuis le layout
  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem('medrev-sem')
    setSemester(raw === '1' ? 1 : raw === '2' ? 2 : raw === 'year' ? 'year' : currentSemestre())
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

  // Mesure combien de fiches « du jour » tiennent SANS scroll (hauteur réelle
  // d'une ligne) ; au-delà : bouton « voir plus » → modale complète.
  useEffect(() => {
    const el = flistRef.current
    if (!el) return
    const compute = () => {
      const row = el.querySelector('.fiche') as HTMLElement | null
      const gap = parseFloat(getComputedStyle(el).rowGap) || 9
      const stride = (row ? row.offsetHeight : 64) + gap
      const btn = el.querySelector('.flist-more') as HTMLElement | null
      // Le gap qui précède le bouton est déjà compté dans le stride de la
      // dernière ligne : il ne reste que sa marge et sa hauteur propre.
      const btnCost = btn
        ? (parseFloat(getComputedStyle(btn).marginTop) || 0) + btn.offsetHeight
        : 39
      setFlistM({ h: el.clientHeight, stride, gap, btnCost })
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [userId, lessons])

  // ================= DONNÉES DÉRIVÉES =================
  // En mode 'year' : tous les systèmes ; sinon filtre par semestre
  const semSystems = useMemo(
    () => semester === 'year' ? systems : systems.filter(s => s.semestre === semester),
    [systems, semester]
  )
  const semSystemIds = useMemo(() => new Set(semSystems.map(s => s.id)), [semSystems])
  const semLessons = useMemo(() => lessons.filter(l => semSystemIds.has(l.system_id)), [lessons, semSystemIds])

  // Planning de révision par matière + couleurs de matière partagées (mêmes
  // couleurs que la page Fiches).
  const schedOf = useMemo(() => makeScheduleResolver(systems), [systems])
  const colorOf = useMemo(() => buildSubjectColorMap(semSystems), [semSystems])

  const todayQueue = useMemo(() => computeTodayQueue(semLessons, today, schedOf), [semLessons, today, schedOf])

  // (Les suggestions "Et si tu révisais…" vivent désormais sur la page
  // Statistiques — le dashboard reste volontairement épuré.)
  const activeDays = useMemo(() => buildActiveDaysSet(semLessons), [semLessons])
  const streak = useMemo(() => computeStreak(activeDays, today), [activeDays, today])
  const recordStreak = useMemo(() => computeRecordStreak(activeDays), [activeDays])
  const weekDays = useMemo(() => computeWeek(activeDays, today), [activeDays, today])
  const heatmap = useMemo(() => computeHeatmap(activeDays, today, 4), [activeDays, today])
  const upcomingLoad = useMemo(() => computeUpcomingLoad(semLessons, today, schedOf), [semLessons, today, schedOf])
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

  const reviewSystemName = reviewLesson
    ? (systems.find(s => s.id === reviewLesson.system_id)?.name || '')
    : ''

  // Ordre de la liste : les retards d'abord (les plus en retard en tête),
  // puis le reste par palier J croissant. C'est ce que promet la page
  // d'accueil (« Les retards d'abord »).
  const sortedQueue = useMemo(
    () => [...todayQueue].sort((a, b) => {
      const la = a.due.status === 'missed' ? a.due.overdueDays : 0
      const lb = b.due.status === 'missed' ? b.due.overdueDays : 0
      if (la !== lb) return lb - la
      return schedOf(a.lesson.system_id)[a.due.stepIndex] - schedOf(b.lesson.system_id)[b.due.stepIndex]
    }),
    [todayQueue]
  )
  // Combien de fiches tiennent SANS scroll : tout le panneau s'il n'y a pas de
  // bouton, sinon on ne réserve que la hauteur du bouton « voir plus » (~44px),
  // pas une ligne entière → moins de vide en bas.
  // Sans bouton, la dernière ligne n'a pas de gap après elle, d'où le + gap.
  const fitAll = Math.max(1, Math.floor((flistM.h + flistM.gap) / flistM.stride))
  // Téléphone : les 5 premières (les retards d'abord), le reste derrière
  // « Voir N fiches de plus », pour ne pas faire défiler toute la liste.
  const PHONE_MAX = 6
  const moreThanFit = isNarrow ? sortedQueue.length > PHONE_MAX : sortedQueue.length > fitAll
  // Avec bouton : n lignes + n gaps + le coût mesuré du bouton.
  const fitWithBtn = isNarrow ? PHONE_MAX : Math.max(1, Math.floor((flistM.h - flistM.btnCost) / flistM.stride))
  const lateCount = sortedQueue.filter(p => p.due.status === 'missed').length
  const visibleQueue = moreThanFit ? sortedQueue.slice(0, fitWithBtn) : sortedQueue
  const hiddenCount = sortedQueue.length - visibleQueue.length

  // Avant : `return null`, donc un écran blanc jusqu'à l'arrivée des données.
  if (loading || !userId) return <div className="dvx"><PageLoader label="Chargement de ta journée…" /></div>

  // "14:00:00" → "14h" · "14:30:00" → "14h30"
  const fmtTd = (t: string | null) => {
    if (!t) return ''
    const [h, m] = t.split(':')
    return m === '00' ? `${parseInt(h, 10)}h` : `${parseInt(h, 10)}h${m}`
  }

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

      {/* TÉLÉPHONE : la carte du jour, avec le bouton à portée de pouce */}
      {isPhone && (
        <div className="m-hero reveal d2">
          <div className="m-hero-top">
            <div>
              <b>{todayQueue.length === 0 ? 'Rien à réviser' : `${todayQueue.length} fiche${todayQueue.length > 1 ? 's' : ''}`}</b>
              <span>{todayQueue.length === 0 ? "Profite de ta journée." : "à réviser aujourd'hui"}</span>
            </div>
            {lateCount > 0 && <span className="m-hero-late">{lateCount} en retard</span>}
          </div>
          {todayQueue.length > 0 && <Link href={startSessionHref} className="m-hero-go">Commencer la session</Link>}
        </div>
      )}

      <div className="grid">
        <div className="panel reveal d2">
          {isPhone && todayQueue.length > 0 && <h2 className="m-sec">Fiches du jour</h2>}
          <div className="phead">
            <div className="picon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 6v14M5 8v11a1 1 0 0 0 1 1h6M19 8v11a1 1 0 0 1-1 1h-6M5 8a3 3 0 0 1 3-3 4 4 0 0 1 4 3 4 4 0 0 1 4-3 3 3 0 0 1 3 3" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
            <div>
              <div className="ptitle">Fiches du jour</div>
              <div className="psub"><b>{todayQueue.length} fiche{todayQueue.length > 1 ? 's' : ''}</b> à réviser</div>
            </div>
            {todayQueue.length > 0 && <Link href={startSessionHref} className="go">Commencer</Link>}
          </div>

          {/* TD du jour — l'emploi du temps réel passe avant les révisions */}
          {todayTds.length > 0 && (
            <Link href="/dashboard/calendar" className="td-today" title="Voir le calendrier">
              {todayTds.map(td => (
                <span key={td.id} className="td-today-row">
                  <strong className="td-today-time">
                    {td.start_time ? fmtTd(td.start_time) : 'TD'}
                    {td.end_time ? `–${fmtTd(td.end_time)}` : ''}
                  </strong>
                  <span className="td-today-title">{td.title}</span>
                  {td.location && <span className="td-today-loc">{td.location}</span>}
                </span>
              ))}
            </Link>
          )}

          <div className="flist" ref={flistRef}>
            {todayQueue.length === 0 ? (
              <div style={{ color: 'var(--gray)', fontSize: 14, padding: '24px 0' }}>Aucune révision aujourd&apos;hui. Profite de ta journée !</div>
            ) : (<>{visibleQueue.map((p, idx) => {
              const sys = semSystems.find(s => s.id === p.lesson.system_id)
              const sysName = sys?.name ?? 'Matière'
              const sysColor = colorOf.get(p.lesson.system_id) || '#22507E'
              const sysJ = schedOf(p.lesson.system_id)
              const overdue = p.due.status === 'missed'
              return (
                <div
                  key={p.lesson.id}
                  className="fiche"
                  onClick={() => openReview(p.lesson)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') openReview(p.lesson) }}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="ftag" style={{ color: sysColor, background: `${sysColor}1A` }}><SubjectIcon name={sysName} /></div>
                  <div className="fmid">
                    <div className="fnm">{p.lesson.name}</div>
                    <div className="fsub">{sysName}
                      <span className="fj">J+{sysJ[p.due.stepIndex]}</span>
                    </div>
                  </div>
                  {isPhone
                    ? <>
                        {overdue && <span className={`m-late${p.due.overdueDays <= 1 ? ' soft' : ''}`}>{p.due.overdueDays <= 1 ? 'hier' : `${p.due.overdueDays} j`}</span>}
                        <svg className="m-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      </>
                    : overdue
                      ? <span className={`badge-late${p.due.overdueDays <= 1 ? ' soft' : ''}`}>{p.due.overdueDays <= 1 ? 'prévue hier' : `${p.due.overdueDays} j de retard`}</span>
                      : <span className="fdue">aujourd&apos;hui</span>}
                </div>
              )
            })}
            {hiddenCount > 0 && (
              <button
                type="button"
                className="flist-more"
                onClick={() => setShowTodayModal(true)}
              >{isPhone ? `Voir les ${hiddenCount} autres` : `Voir ${hiddenCount} fiche${hiddenCount > 1 ? 's' : ''} de plus`}</button>
            )}
            </>)}
          </div>

        </div>

        <div className="col-r">
          <DashTodo userId={userId} />
          <DashProgress userId={userId} lessons={semLessons} systems={semSystems} colorOf={colorOf} />
        </div>
      </div>

      {reviewLesson && (
        <ReviewModal
          lesson={reviewLesson}
          systemName={reviewSystemName}
          schedule={scheduleOf(systems.find(s => s.id === reviewLesson.system_id))}
          initialStepIdx={null}
          onClose={() => setReviewLesson(null)}
          onUpdated={handleReviewUpdated}
        />
      )}

      {showTodayModal && (
        <TodayModal
          queue={sortedQueue}
          systems={semSystems}
          startHref={startSessionHref}
          onClose={() => setShowTodayModal(false)}
          todayLabel={todayLabel}
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
  const [sort, setSort] = useState<TodaySort>('j')
  const [subjectFilter, setSubjectFilter] = useState<string>('all')
  const schedOf = useMemo(() => makeScheduleResolver(systems), [systems])
  const colorOf = useMemo(() => buildSubjectColorMap(systems), [systems])

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
      list.sort((a, b) => schedOf(a.lesson.system_id)[a.due.stepIndex] - schedOf(b.lesson.system_id)[b.due.stepIndex])
    }
    // 'priority' = déjà trié par le calcul
    return list
  }, [queue, systems, sort, subjectFilter, schedOf])

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
          <Link href={startHref} className="btn-focus-lg" onClick={onClose}>
            Démarrer la session
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
              const late = p.due.status === 'missed'
              const rowColor = colorOf.get(p.lesson.system_id) || '#22507E'
              const rowJ = schedOf(p.lesson.system_id)
              return (
                <div key={p.lesson.id} className={`full-row${idx === 0 ? ' highlight' : ''}`}>
                  <span className="full-row-ic" style={{ color: rowColor, background: `${rowColor}1A` }}><SubjectIcon name={sysName} /></span>
                  <div className="full-row-main">
                    <div className="full-row-name">{p.lesson.name}</div>
                    <div className="full-row-sub">{sysName}</div>
                  </div>
                  <span className={`full-row-j${late ? ' late' : ''}`}>J+{rowJ[p.due.stepIndex]}</span>
                  <span className={`full-row-state${late ? ' late' : ''}`}>
                    {late ? `+${p.due.overdueDays} j` : "aujourd'hui"}
                  </span>
                  <span className={p.lastScore ? `full-row-score s${p.lastScore}` : 'full-row-score none'}>
                    {p.lastScore ?? '-'}
                  </span>
                  <Link
                    href={`/dashboard/focus?lesson=${p.lesson.id}`}
                    className="full-row-go"
                    onClick={onClose}
                  >Faire</Link>
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
            <div className="chart-label">Vue d&apos;ensemble : moyenne par matière</div>
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
                            <>, <strong className={cls === 's1' ? 's1' : 's2'}>{m.fragile.length} fragile{m.fragile.length > 1 ? 's' : ''}</strong></>
                          ) : (
                            <>, <strong className="s4">0 fragile</strong></>
                          )}
                          {', '}{m.okCount} OK
                        </div>
                      </div>
                    </div>
                    <div className={`mat-avg ${cls}`}>
                      <span className="mat-avg-n">{m.avgScore !== null ? m.avgScore.toFixed(1) : '-'}</span>
                      <span className="mat-avg-x">/ 5</span>
                    </div>
                  </div>

                  {m.fragile.length > 0 && (
                    <div className="mat-body">
                      {m.fragile.map(f => {
                        const fCls = scoreClass(f.avg)
                        const nextLabel = f.nextRevDate
                          ? (f.nextRevDate === todayStr()
                              ? "aujourd'hui"
                              : `prochaine ${formatDateFR(f.nextRevDate)}`)
                          : ''
                        return (
                          <div key={f.lesson.id} className="mat-fiche">
                            <div className={`mat-fiche-bullet ${fCls}`} />
                            <div>
                              <div className="mat-fiche-name">{f.lesson.name}</div>
                              <div className="mat-fiche-meta">
                                {f.last3.length > 0 ? `3 dernières notes : ${f.last3.join(', ')}` : 'Pas encore notée'}
                                {nextLabel ? `, ${nextLabel}` : ''}
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

'use client'
// src/app/dashboard/page.tsx

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
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
  const upcomingLoad = useMemo(() => computeUpcomingLoad(semLessons, today), [semLessons, today])
  const matiereStats = useMemo(() => computeMatiereStats(semSystems, semLessons), [semSystems, semLessons])

  // Nombre de jours actifs cette semaine jusqu'à aujourd'hui (inclus)
  const weekDone = weekDays.filter(d => d.active && !d.inFuture).length
  const weekTotal = weekDays.filter(d => !d.inFuture).length

  // Point faible principal
  const weakest = matiereStats[0] ?? null
  const weakestFragile = weakest?.fragile.slice(0, 2) ?? []

  // Charge : peak
  const loadMax = Math.max(1, ...upcomingLoad.map(w => w.count))
  const peakIdx = upcomingLoad.findIndex(w => w.count === loadMax && loadMax > 0)

  // Session focus — déclenche la page fiches avec la première du queue
  const firstInQueue = todayQueue[0] ?? null
  const startSessionHref = firstInQueue
    ? `/dashboard/fiches?start=${firstInQueue.lesson.id}`
    : '/dashboard/fiches'

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

          <div className="today-cta">
            <div className="today-cta-top">
              <div className="today-cta-label">Session focus</div>
              <div className="today-cta-num">{todayQueue.length}</div>
              <div className="today-cta-unit">
                {todayQueue.length === 0 ? 'aucune fiche' : todayQueue.length === 1 ? 'fiche à revoir' : 'fiches à enchaîner'}
              </div>
              {todayQueue.length > 0 && (
                <div className="today-cta-time">
                  <strong>~{todayQueue.length * 8} min</strong> · ton rythme habituel
                </div>
              )}
            </div>
            <div className="today-cta-bottom">
              <Link
                href={startSessionHref}
                className="btn-focus"
                style={todayQueue.length === 0 ? { pointerEvents: 'none', opacity: .5 } : undefined}
              >
                {todayQueue.length === 0 ? 'Rien à démarrer' : 'Démarrer maintenant'}
              </Link>
              <div className="btn-focus-hint">skip ou reporter possible à tout moment</div>
            </div>
          </div>
        </div>

        {/* ZONES 2, 3, 4 */}
        <div className="dash-row">

          {/* ZONE 2 : POINT FAIBLE */}
          <div className="dash-card">
            <div className="dash-card-title with-action">
              Point faible
              {matiereStats.length > 0 && (
                <button className="see-more" onClick={() => setShowWeakModal(true)}>
                  Toutes les matières
                </button>
              )}
            </div>

            {weakest === null ? (
              <div className="weak-empty">
                Pas encore assez de notes pour identifier un point faible.
              </div>
            ) : (
              <>
                <h3 className="weak-matiere">
                  <span className={`weak-dot ${scoreClass(weakest.avgScore)}`} />
                  {weakest.system.name}
                </h3>
                <div className="weak-score">
                  <span className={`weak-score-num ${scoreClass(weakest.avgScore)}`}>
                    {weakest.avgScore !== null ? weakest.avgScore.toFixed(1) : '—'}
                  </span>
                  <span className="weak-score-max">/ 5</span>
                  <span className={`weak-score-label ${scoreClass(weakest.avgScore)}`}>
                    {scoreLabel(weakest.avgScore)}
                  </span>
                </div>

                {weakestFragile.length > 0 ? (
                  <>
                    <div className="weak-sub">
                      {weakestFragile.length} fiche{weakestFragile.length > 1 ? 's' : ''} fragile{weakestFragile.length > 1 ? 's' : ''}
                    </div>
                    <div className="weak-list">
                      {weakestFragile.map(f => {
                        const cls = scoreClass(f.avg)
                        return (
                          <div key={f.lesson.id} className="weak-item">
                            <div>
                              <div className="weak-item-name">{f.lesson.name}</div>
                              <div className="weak-item-meta">
                                {f.last3.length > 0
                                  ? `3 dernières · ${f.last3.join(' · ')}`
                                  : 'Pas encore notée'}
                              </div>
                            </div>
                            <div className="weak-item-score">
                              <span className={`weak-item-num ${cls}`}>{f.avg.toFixed(1)}</span>
                              <span className={`weak-chip ${cls}`}>{Math.round(f.avg)}</span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  <div className="weak-sub" style={{ marginTop: 8 }}>Aucune fiche fragile — tu gères.</div>
                )}

                <Link
                  href={`/dashboard/fiches?system=${weakest.system.id}`}
                  className="weak-cta"
                  style={{ textDecoration: 'none' }}
                >
                  Retravailler {weakestFragile.length > 0 ? 'ces fiches' : 'cette matière'}
                </Link>
              </>
            )}
          </div>

          {/* ZONE 3 : RÉGULARITÉ */}
          <div className="dash-card">
            <div className="dash-card-title">Régularité</div>

            <div className="reg-num-wrap">
              <div className="reg-num">{streak}</div>
              <div className="reg-num-unit">jours<br />d&apos;affilée</div>
            </div>
            <div className="reg-sub">
              {streak === 0
                ? 'Reprends le rythme aujourd\u2019hui.'
                : <>Tu tiens depuis le <strong>{formatDateFR(dateStrFromOffset(today, -(streak - 1)))}</strong>.</>}
            </div>

            <div className="reg-record">
              <span className="reg-record-label">Record perso</span>
              <strong>{recordStreak} jour{recordStreak > 1 ? 's' : ''}</strong>
            </div>

            <div className="reg-week">
              <div className="reg-week-label">
                <span>Cette semaine</span>
                <strong>{weekDone} / {weekTotal}</strong>
              </div>
              <div className="reg-strip">
                {weekDays.map((d, i) => {
                  const cls = [
                    'reg-day',
                    d.active && !d.inFuture ? 'done' : '',
                    d.isToday ? 'today' : '',
                  ].filter(Boolean).join(' ')
                  return (
                    <div key={i} className={cls}>
                      <div className="reg-day-dot" />
                      <div className="reg-day-label">{d.label}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ZONE 4 : CHARGE À VENIR */}
          <div className="dash-card">
            <div className="dash-card-title">Charge à venir</div>

            <div className="load-rows">
              {upcomingLoad.map((w, i) => {
                const showPeak = loadMax > 10
                const isPeak = showPeak && i === peakIdx && w.count === loadMax
                const pct = loadMax > 0 ? Math.max(6, Math.round((w.count / loadMax) * 100)) : 0
                return (
                  <div key={w.label} className="load-row">
                    <span className="load-week">{w.label}</span>
                    <div className="load-bar">
                      <div
                        className={`load-bar-f${isPeak ? ' peak' : ''}`}
                        style={{ width: `${w.count > 0 ? pct : 0}%` }}
                      />
                    </div>
                    <span className={`load-count${isPeak ? ' peak' : ''}`}>{w.count}</span>
                  </div>
                )
              })}
            </div>

            {loadMax === 0 ? (
              <div className="load-note calm">
                <strong>Aucune révision</strong> prévue dans les 4 prochaines semaines.
              </div>
            ) : peakIdx >= 0 && loadMax > 10 ? (
              <div className="load-note">
                <strong>Pic en {upcomingLoad[peakIdx].label}</strong> — pense à étaler tes nouvelles fiches.
              </div>
            ) : (
              <div className="load-note calm">
                <strong>Charge équilibrée</strong> sur les 4 prochaines semaines.
              </div>
            )}
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
                      href={`/dashboard/fiches?start=${p.lesson.id}`}
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
                              href={`/dashboard/fiches?start=${f.lesson.id}`}
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

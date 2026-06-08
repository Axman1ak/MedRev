'use client'
// src/app/dashboard/calendar/page.tsx

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { System, Lesson } from '@/types'
import ReviewModal from '@/components/ReviewModal'
import './styles.css'

const J = [0, 1, 3, 5, 7, 15, 21, 30, 45, 60, 75, 90, 105, 120]
const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const DAY_LABELS_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
const MONTH_FULL_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

// ============= Types =============
type Score = 1 | 2 | 3 | 4 | 5
type ScoreCls = 's1' | 's2' | 's3' | 's4' | 's5' | 'none'
type StepEntry = { score?: Score; ok?: boolean; date?: string; note?: string } | null

type FicheOccurrence = {
  lesson: Lesson
  stepIndex: number
  date: string
  scoreForThisJ: Score | null
  lastScore: Score | null
}

// ============= Helpers =============
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

function getLastScore(lesson: Lesson): Score | null {
  const steps = (lesson.steps as StepEntry[]) || []
  for (let i = J.length - 1; i >= 0; i--) {
    const sc = stepScore(steps[i])
    if (sc) return sc
  }
  return null
}

function scoreClass(score: Score | null): ScoreCls {
  if (score === null) return 'none'
  return `s${score}` as ScoreCls
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDaysToDate(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function computeOccurrences(lessons: Lesson[]): FicheOccurrence[] {
  const out: FicheOccurrence[] = []
  for (const l of lessons) {
    if (!l.learn_date) continue
    const steps = (l.steps as StepEntry[]) || []
    const lastScore = getLastScore(l)
    for (let i = 0; i < J.length; i++) {
      const d = new Date(l.learn_date + 'T12:00:00')
      d.setDate(d.getDate() + J[i])
      out.push({
        lesson: l,
        stepIndex: i,
        date: toDateStr(d),
        scoreForThisJ: stepScore(steps[i]),
        lastScore,
      })
    }
  }
  return out
}

function groupByDate(occs: FicheOccurrence[]): Map<string, FicheOccurrence[]> {
  const map = new Map<string, FicheOccurrence[]>()
  occs.forEach(o => {
    const list = map.get(o.date)
    if (list) list.push(o)
    else map.set(o.date, [o])
  })
  // Tri dans chaque jour : non notées d'abord (à traiter), puis notées
  map.forEach(list => {
    list.sort((a, b) => {
      const aDone = a.scoreForThisJ !== null ? 1 : 0
      const bDone = b.scoreForThisJ !== null ? 1 : 0
      if (aDone !== bDone) return aDone - bDone
      return a.lesson.name.localeCompare(b.lesson.name)
    })
  })
  return map
}

// ============= Main Component =============
export default function CalendarPage() {
  const supabase = createClient()
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [systems, setSystems] = useState<System[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [semester, setSemester] = useState<1 | 2 | 'year'>(2)
  const [weekOffset, setWeekOffset] = useState(0)
  const [monthOffset, setMonthOffset] = useState(0)
  const [view, setView] = useState<'week' | 'month'>('week')
  const [showAllForDay, setShowAllForDay] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState<{ lesson: Lesson; stepIdx: number } | null>(null)
  const weekRef = useRef<HTMLDivElement>(null)
  const [weekPx, setWeekPx] = useState(0)
  const monthRef = useRef<HTMLDivElement>(null)
  const [monthPx, setMonthPx] = useState(0)

  const today = toDateStr(new Date())

  // ============= Load =============
  const load = useCallback(async (uid: string) => {
    const [{ data: sys }, { data: les }] = await Promise.all([
      supabase.from('systems').select('*').eq('user_id', uid).order('semestre').order('created_at'),
      supabase.from('lessons').select('*').eq('user_id', uid),
    ])
    setSystems((sys as System[] | null) ?? [])
    setLessons((les as Lesson[] | null) ?? [])
  }, [supabase])

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/'); return }
      setUserId(user.id)
      load(user.id)
    })
  }, [load, router, supabase])

  // Semester toggle from layout (S1 / S2 / Année)
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

  // Reset scroll au montage (cohérent avec les autres pages dashboard)
  useEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo(0, 0)
    const main = document.querySelector('main')
    if (main) main.scrollTop = 0
  }, [])

  // Mesure la hauteur dispo de la grille semaine pour calculer combien de
  // fiches tiennent par colonne (au-delà : bouton « voir plus »).
  useEffect(() => {
    const el = weekRef.current
    if (!el) return
    const update = () => setWeekPx(el.clientHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [view, lessons])

  // Idem pour la grille mensuelle (hauteur d'une case = grille / nb lignes).
  useEffect(() => {
    const el = monthRef.current
    if (!el) return
    const update = () => setMonthPx(el.clientHeight)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [view, lessons, monthOffset])

  // ============= Derived =============
  const semSystems = useMemo(
    () => semester === 'year' ? systems : systems.filter(s => s.semestre === semester),
    [systems, semester]
  )
  const semSystemIds = useMemo(() => new Set(semSystems.map(s => s.id)), [semSystems])
  const semLessons = useMemo(() => lessons.filter(l => semSystemIds.has(l.system_id)), [lessons, semSystemIds])

  const systemsById = useMemo(() => {
    const map = new Map<string, System>()
    systems.forEach(s => map.set(s.id, s))
    return map
  }, [systems])

  const occurrences = useMemo(() => computeOccurrences(semLessons), [semLessons])
  const byDate = useMemo(() => groupByDate(occurrences), [occurrences])

  // ============= Week computations =============
  const weekMonday = useMemo(() => {
    return getMondayOfWeek(addDaysToDate(new Date(), weekOffset * 7))
  }, [weekOffset])

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDaysToDate(weekMonday, i))
  }, [weekMonday])

  const weekLabel = useMemo(() => {
    const s = weekDays[0]
    const e = weekDays[6]
    const sm = MONTH_FULL_FR[s.getMonth()]
    const em = MONTH_FULL_FR[e.getMonth()]
    if (s.getMonth() === e.getMonth()) {
      return `${s.getDate()} au ${e.getDate()} ${sm}`
    }
    return `${s.getDate()} ${sm} au ${e.getDate()} ${em}`
  }, [weekDays])

  const weekTotal = useMemo(() => {
    return weekDays.reduce((acc, d) => {
      const list = byDate.get(toDateStr(d))
      return acc + (list?.length ?? 0)
    }, 0)
  }, [weekDays, byDate])

  const weekDone = useMemo(() => {
    return weekDays.reduce((acc, d) => {
      const list = byDate.get(toDateStr(d))
      if (!list) return acc
      return acc + list.filter(o => o.scoreForThisJ !== null).length
    }, 0)
  }, [weekDays, byDate])

  // ============= Month computations =============
  const monthDate = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + monthOffset)
    d.setDate(1)
    return d
  }, [monthOffset])

  const monthLabel = useMemo(() => {
    const m = MONTH_FULL_FR[monthDate.getMonth()]
    return `${m.charAt(0).toUpperCase() + m.slice(1)} ${monthDate.getFullYear()}`
  }, [monthDate])

  const monthDays = useMemo(() => {
    const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1)
    const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0)
    const startPad = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
    const days: (Date | null)[] = Array(startPad).fill(null)
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), i))
    }
    while (days.length % 7 !== 0) days.push(null)
    return days
  }, [monthDate])

  // ============= Handlers =============
  function openReview(occ: FicheOccurrence) {
    const isFuture = occ.date > today
    setReviewing({
      lesson: occ.lesson,
      stepIdx: isFuture ? -1 : occ.stepIndex,
    })
    setShowAllForDay(null)
  }

  function handleUpdated(updatedLesson: Lesson) {
    setLessons(prev => prev.map(l => l.id === updatedLesson.id ? updatedLesson : l))
  }

  function goToday() {
    if (view === 'week') setWeekOffset(0)
    else setMonthOffset(0)
  }

  function prev() {
    if (view === 'week') setWeekOffset(w => w - 1)
    else setMonthOffset(m => m - 1)
  }

  function next() {
    if (view === 'week') setWeekOffset(w => w + 1)
    else setMonthOffset(m => m + 1)
  }

  function clickMonthDay(d: Date) {
    const thisMonday = getMondayOfWeek(new Date())
    const targetMonday = getMondayOfWeek(d)
    const diffDays = Math.round((targetMonday.getTime() - thisMonday.getTime()) / 86400000)
    setWeekOffset(Math.round(diffDays / 7))
    setView('week')
  }

  // Combien de rectangles tiennent dans une colonne semaine (hauteur fixe).
  // ROW_H = hauteur rectangle (30) + gap (4) ; DAY_HEAD_H/LIST_PAD = chrome colonne.
  const DAY_HEAD_H = 62, LIST_PAD = 18, ROW_H = 34, MORE_H = 34
  function daySlots(count: number): { visible: number; overflow: number } {
    if (!weekPx) {
      const v = Math.min(count, 8)
      return { visible: v, overflow: count - v }
    }
    const avail = weekPx - DAY_HEAD_H - LIST_PAD
    const maxFull = Math.max(1, Math.floor(avail / ROW_H))
    if (count <= maxFull) return { visible: count, overflow: 0 }
    const v = Math.max(1, Math.floor((avail - MORE_H) / ROW_H))
    return { visible: v, overflow: count - v }
  }

  // Combien de titres tiennent dans une case mois (sinon : « voir plus »).
  const monthRows = monthDays.length / 7
  const M_NUM_H = 22, M_PAD = 14, M_TITLE_H = 16, M_MORE_H = 15
  function monthSlots(count: number): { visible: number; overflow: number } {
    if (!monthPx || !monthRows) {
      const v = Math.min(count, 3)
      return { visible: v, overflow: count - v }
    }
    const avail = (monthPx / monthRows) - M_NUM_H - M_PAD
    const maxFull = Math.max(1, Math.floor(avail / M_TITLE_H))
    if (count <= maxFull) return { visible: count, overflow: 0 }
    const v = Math.max(1, Math.floor((avail - M_MORE_H) / M_TITLE_H))
    return { visible: v, overflow: count - v }
  }

  if (!userId) return null

  // ============= Render =============
  const totalFiches = semLessons.length
  const hasAnyLesson = totalFiches > 0

  return (
    <div className="cal-page">

      {/* HEADER */}
      <div className="cal-head">
        <div>
          <h1 className="cal-title">
            {view === 'week'
              ? <>Semaine du <em>{weekLabel}</em></>
              : <em>{monthLabel}</em>}
          </h1>
          <div className="cal-sub">
            {view === 'week' && weekTotal > 0
              ? <>{weekTotal} révision{weekTotal > 1 ? 's' : ''} cette semaine{weekDone > 0 ? ` · ${weekDone} déjà notée${weekDone > 1 ? 's' : ''}` : ''}</>
              : view === 'week' ? 'Aucune révision planifiée cette semaine'
              : 'Vue mensuelle · clique sur un jour pour y aller'}
          </div>
        </div>
        <div className="cal-controls">
          <div className="cal-toggle">
            <button
              className={view === 'week' ? 'active' : ''}
              onClick={() => setView('week')}
            >Semaine</button>
            <button
              className={view === 'month' ? 'active' : ''}
              onClick={() => setView('month')}
            >Mois</button>
          </div>
          <div className="cal-nav">
            <button onClick={prev} aria-label="Précédent">{'‹'}</button>
            <button className="cal-today-btn" onClick={goToday}>Aujourd&apos;hui</button>
            <button onClick={next} aria-label="Suivant">{'›'}</button>
          </div>
        </div>
      </div>

      {/* EMPTY STATE */}
      {!hasAnyLesson && (
        <div className="cal-empty-state">
          <div className="cal-empty-icon" aria-hidden>▦</div>
          <div className="cal-empty-title">
            Aucune révision programmée pour {semester === 'year' ? 'l\'année' : `le semestre ${semester}`}
          </div>
          <p className="cal-empty-text">
            Le calendrier se remplit automatiquement à mesure que tu crées
            des fiches et les notes au jour J. La courbe J replanifie les 14
            paliers (J0 → J+120) pour chacune.
          </p>
          <Link href="/dashboard/fiches" className="cal-empty-btn">
            Créer ma première fiche →
          </Link>
        </div>
      )}

      {/* WEEK VIEW */}
      {hasAnyLesson && view === 'week' && (
        <div className="cal-week" ref={weekRef}>
          {weekDays.map((day, i) => {
            const dateStr = toDateStr(day)
            const occs = byDate.get(dateStr) ?? []
            const isToday = dateStr === today
            const isPast = dateStr < today
            const { visible, overflow } = daySlots(occs.length)
            const shown = occs.slice(0, visible)

            const classes = [
              'cal-day',
              isToday ? 'cal-today' : '',
              isPast && !isToday ? 'cal-past' : '',
            ].filter(Boolean).join(' ')

            return (
              <div key={i} className={classes}>
                <div className="cal-day-head">
                  <div className="cal-day-name">
                    {isToday ? "Aujourd'hui" : DAY_LABELS_LONG[i]}
                  </div>
                  <div className="cal-day-num-row">
                    <div className="cal-day-num">{day.getDate()}</div>
                    <div className={`cal-day-count${occs.length === 0 ? ' cal-zero' : ''}`}>
                      {occs.length}
                    </div>
                  </div>
                </div>

                {occs.length === 0 ? (
                  <div className="cal-day-empty">{'·'}</div>
                ) : (
                  <>
                    <div className="cal-day-list">
                      {shown.map(occ => {
                        const done = occ.scoreForThisJ !== null
                        const displayScore = done ? occ.scoreForThisJ : occ.lastScore
                        const cls = scoreClass(displayScore)
                        const sysName = systemsById.get(occ.lesson.system_id)?.name ?? ''
                        return (
                          <button
                            key={`${occ.lesson.id}-${occ.stepIndex}`}
                            className={`cal-fiche${done ? ' cal-done' : ''}`}
                            onClick={() => openReview(occ)}
                            title={`${sysName ? sysName + ' · ' : ''}${occ.lesson.name} · J+${J[occ.stepIndex]}`}
                          >
                            <span className={`cal-fiche-dot ${cls}${done ? ' cal-scored' : ''}`} />
                            <span className="cal-fiche-body">
                              <span className="cal-fiche-name">{occ.lesson.name}</span>
                              <span className="cal-fiche-j">J+{J[occ.stepIndex]}</span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    {overflow > 0 && (
                      <button
                        className="cal-day-more"
                        onClick={() => setShowAllForDay(dateStr)}
                      >
                        voir plus · +{overflow}
                      </button>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* MONTH VIEW */}
      {hasAnyLesson && view === 'month' && (
        <div className="cal-month">
          <div className="cal-month-head">
            {DAY_LABELS.map(d => (
              <div key={d} className="cal-month-head-cell">{d}</div>
            ))}
          </div>
          <div className="cal-month-grid" ref={monthRef}>
            {monthDays.map((day, i) => {
              if (!day) return <div key={i} className="cal-month-cell cal-empty" />
              const dateStr = toDateStr(day)
              const occs = byDate.get(dateStr) ?? []
              const isToday = dateStr === today
              const isPast = dateStr < today
              const { visible: mVisible, overflow: mOverflow } = monthSlots(occs.length)
              const titleOccs = occs.slice(0, mVisible)
              const classes = [
                'cal-month-cell',
                isToday ? 'cal-today' : '',
                isPast && !isToday ? 'cal-past' : '',
              ].filter(Boolean).join(' ')
              return (
                <div
                  key={i}
                  className={classes}
                  onClick={() => clickMonthDay(day)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="cal-month-num-row">
                    <span className="cal-month-num">{day.getDate()}</span>
                    {occs.length > 0 && (
                      <span className="cal-month-count">{occs.length}</span>
                    )}
                  </div>
                  {titleOccs.length > 0 && (
                    <div className="cal-month-titles">
                      {titleOccs.map(o => {
                        const done = o.scoreForThisJ !== null
                        const cls = scoreClass(done ? o.scoreForThisJ : o.lastScore)
                        return (
                          <span
                            key={`${o.lesson.id}-${o.stepIndex}`}
                            className={`cal-month-title ${cls}${done ? ' cal-done' : ''}`}
                            title={o.lesson.name}
                          >
                            {o.lesson.name}
                          </span>
                        )
                      })}
                      {mOverflow > 0 && (
                        <button
                          className="cal-month-more"
                          onClick={(e) => { e.stopPropagation(); setShowAllForDay(dateStr) }}
                        >
                          +{mOverflow} voir plus
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* LEGEND */}
      {hasAnyLesson && (
        <div className="cal-legend">
          <span><strong>Point</strong> = note de la révision (ou dernière note de la fiche).</span>
          <span className="cal-legend-item"><span className="cal-legend-dot s1" />1</span>
          <span className="cal-legend-item"><span className="cal-legend-dot s2" />2</span>
          <span className="cal-legend-item"><span className="cal-legend-dot s3" />3</span>
          <span className="cal-legend-item"><span className="cal-legend-dot s4" />4</span>
          <span className="cal-legend-item"><span className="cal-legend-dot s5" />5</span>
          <span className="cal-legend-item"><span className="cal-legend-dot cal-none" />jamais notée</span>
          <span className="cal-legend-hint">Clic sur une ligne → picker J + notation.</span>
        </div>
      )}

      {/* OVERFLOW MODAL : toutes les fiches d'un jour */}
      {showAllForDay && (() => {
        const occs = byDate.get(showAllForDay) ?? []
        const d = new Date(showAllForDay + 'T12:00:00')
        const label = d.toLocaleDateString('fr-FR', {
          weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
        })
        return (
          <div className="cal-overflow" onClick={() => setShowAllForDay(null)}>
            <div className="cal-overflow-card" onClick={e => e.stopPropagation()}>
              <div className="cal-overflow-head">
                <div>
                  <h2 className="cal-overflow-title">
                    {occs.length} révision{occs.length > 1 ? 's' : ''}
                  </h2>
                  <div className="cal-overflow-sub">{label.charAt(0).toUpperCase() + label.slice(1)}</div>
                </div>
                <button
                  className="cal-overflow-close"
                  onClick={() => setShowAllForDay(null)}
                  aria-label="Fermer"
                >{'×'}</button>
              </div>
              <div className="cal-overflow-list">
                {occs.map(occ => {
                  const done = occ.scoreForThisJ !== null
                  const displayScore = done ? occ.scoreForThisJ : occ.lastScore
                  const cls = scoreClass(displayScore)
                  const sysName = systemsById.get(occ.lesson.system_id)?.name ?? ''
                  return (
                    <button
                      key={`${occ.lesson.id}-${occ.stepIndex}`}
                      className={`cal-fiche${done ? ' cal-done' : ''}`}
                      onClick={() => openReview(occ)}
                      title={sysName}
                    >
                      <span className={`cal-fiche-dot ${cls}${done ? ' cal-scored' : ''}`} />
                      <span className="cal-fiche-body">
                        <span className="cal-fiche-name">{occ.lesson.name}</span>
                        <span className="cal-fiche-j">J+{J[occ.stepIndex]}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}

      {/* REVIEW MODAL (partagé) */}
      {reviewing && (
        <ReviewModal
          lesson={reviewing.lesson}
          systemName={systemsById.get(reviewing.lesson.system_id)?.name ?? ''}
          initialStepIdx={reviewing.stepIdx === -1 ? null : reviewing.stepIdx}
          onClose={() => setReviewing(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  )
}

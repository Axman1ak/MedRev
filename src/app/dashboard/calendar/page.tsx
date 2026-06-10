'use client'
// src/app/dashboard/calendar/page.tsx

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { System, Lesson, TdEvent } from '@/types'
import ReviewModal from '@/components/ReviewModal'
import SubjectIcon from '@/components/SubjectIcon'
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

// "14:00:00" → "14h" · "14:30:00" → "14h30" · null → ''
function fmtTdTime(t: string | null): string {
  if (!t) return ''
  const [h, m] = t.split(':')
  return m === '00' ? `${parseInt(h, 10)}h` : `${parseInt(h, 10)}h${m}`
}

// Plage horaire compacte d'un TD : "14h–16h", "14h", ou ''.
function tdTimeRange(td: TdEvent): string {
  const a = fmtTdTime(td.start_time)
  const b = fmtTdTime(td.end_time)
  if (a && b) return `${a}–${b}`
  return a || b
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

function computeOccurrences(lessons: Lesson[]): FicheOccurrence[] {
  const out: FicheOccurrence[] = []
  for (const l of lessons) {
    if (!l.learn_date) continue
    const steps = (l.steps as StepEntry[]) || []
    const lastScore = getLastScore(l)
    const skips = lessonSkips(l)
    const postpones = lessonPostpones(l)
    for (let i = 0; i < J.length; i++) {
      if (skips.includes(i)) continue          // palier annulé → pas d'occurrence
      const d = new Date(l.learn_date + 'T12:00:00')
      d.setDate(d.getDate() + J[i])
      out.push({
        lesson: l,
        stepIndex: i,
        date: postpones[String(i)] ?? toDateStr(d),  // report éventuel
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

  // TD de fac (table td_events) — type d'événement à part des révisions.
  const [tds, setTds] = useState<TdEvent[]>([])
  // Modal TD : null = fermé · 'new' = création · TdEvent = édition.
  const [tdModal, setTdModal] = useState<'new' | TdEvent | null>(null)
  const [tdTitle, setTdTitle] = useState('')
  const [tdSysId, setTdSysId] = useState('')
  const [tdDate, setTdDate] = useState('')
  const [tdStart, setTdStart] = useState('')
  const [tdEnd, setTdEnd] = useState('')
  const [tdLocation, setTdLocation] = useState('')
  const [tdRepeatUntil, setTdRepeatUntil] = useState('')
  const [tdSaving, setTdSaving] = useState(false)
  const [tdError, setTdError] = useState<string | null>(null)
  const weekRef = useRef<HTMLDivElement>(null)
  const [weekPx, setWeekPx] = useState(0)
  const monthRef = useRef<HTMLDivElement>(null)
  const [monthPx, setMonthPx] = useState(0)

  const today = toDateStr(new Date())

  // ============= Load =============
  const load = useCallback(async (uid: string) => {
    const [{ data: sys }, { data: les }, { data: td }] = await Promise.all([
      supabase.from('systems').select('*').eq('user_id', uid).order('semestre').order('created_at'),
      supabase.from('lessons').select('*').eq('user_id', uid),
      supabase.from('td_events').select('*').eq('user_id', uid).order('date').order('start_time'),
    ])
    setSystems((sys as System[] | null) ?? [])
    setLessons((les as Lesson[] | null) ?? [])
    setTds((td as TdEvent[] | null) ?? [])
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

  // TD groupés par date (non filtrés par semestre : c'est l'emploi du temps réel).
  const tdsByDate = useMemo(() => {
    const map = new Map<string, TdEvent[]>()
    tds.forEach(td => {
      const list = map.get(td.date)
      if (list) list.push(td)
      else map.set(td.date, [td])
    })
    map.forEach(list => list.sort((a, b) => (a.start_time ?? '') < (b.start_time ?? '') ? -1 : 1))
    return map
  }, [tds])

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

  // ---- TD : création / édition / suppression ----
  function openTdNew(dateStr?: string) {
    setTdTitle(''); setTdSysId(''); setTdDate(dateStr ?? today)
    setTdStart(''); setTdEnd(''); setTdLocation(''); setTdRepeatUntil('')
    setTdError(null)
    setTdModal('new')
  }

  function openTdEdit(td: TdEvent) {
    setTdTitle(td.title); setTdSysId(td.system_id ?? ''); setTdDate(td.date)
    setTdStart(td.start_time ? td.start_time.slice(0, 5) : '')
    setTdEnd(td.end_time ? td.end_time.slice(0, 5) : '')
    setTdLocation(td.location ?? ''); setTdRepeatUntil('')
    setTdError(null)
    setTdModal(td)
  }

  async function saveTd() {
    if (!userId || !tdTitle.trim() || !tdDate || tdSaving) return
    setTdSaving(true)
    setTdError(null)
    const base = {
      user_id: userId,
      system_id: tdSysId || null,
      title: tdTitle.trim(),
      start_time: tdStart || null,
      end_time: tdEnd || null,
      location: tdLocation.trim() || null,
    }
    try {
      if (tdModal === 'new') {
        // Récurrence par duplication : une row par semaine jusqu'à la date
        // limite (cap 30 occurrences = ~7 mois, garde-fou anti-typo).
        const dates: string[] = [tdDate]
        if (tdRepeatUntil && tdRepeatUntil > tdDate) {
          let d = tdDate
          while (dates.length < 30) {
            d = addDaysToDate(new Date(d + 'T12:00:00'), 7).toISOString().split('T')[0]
            if (d > tdRepeatUntil) break
            dates.push(d)
          }
        }
        const { data, error } = await supabase
          .from('td_events')
          .insert(dates.map(date => ({ ...base, date })))
          .select()
        if (error) throw error
        setTds(prev => [...prev, ...((data as TdEvent[] | null) ?? [])])
      } else if (tdModal) {
        const { data, error } = await supabase
          .from('td_events')
          .update({ ...base, date: tdDate })
          .eq('id', tdModal.id)
          .select()
          .single()
        if (error) throw error
        setTds(prev => prev.map(t => (t.id === tdModal.id ? (data as TdEvent) : t)))
      }
      setTdModal(null)
    } catch (e) {
      setTdError(e instanceof Error ? e.message : 'Enregistrement impossible. Réessaie.')
    } finally {
      setTdSaving(false)
    }
  }

  async function deleteTd(id: string) {
    setTdSaving(true)
    try {
      const { error } = await supabase.from('td_events').delete().eq('id', id)
      if (error) throw error
      setTds(prev => prev.filter(t => t.id !== id))
      setTdModal(null)
    } catch (e) {
      setTdError(e instanceof Error ? e.message : 'Suppression impossible.')
    } finally {
      setTdSaving(false)
    }
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
  // tdCount : les TD du jour occupent leurs propres lignes en haut de la
  // colonne — on les retranche de la place disponible pour les fiches.
  function daySlots(count: number, tdCount: number): { visible: number; overflow: number } {
    if (!weekPx) {
      const v = Math.min(count, Math.max(1, 8 - tdCount))
      return { visible: v, overflow: count - v }
    }
    const avail = weekPx - DAY_HEAD_H - LIST_PAD - tdCount * ROW_H
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
          <button
            className="cal-td-trigger"
            onClick={() => openTdNew()}
            title="Ajouter un TD / cours dans le calendrier"
          >
            + TD
          </button>
          {view === 'week' && (hasAnyLesson || tds.length > 0) && (
            <button
              className="cal-print-trigger"
              onClick={() => window.print()}
              title="Imprimer la semaine affichée"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" strokeLinecap="round" strokeLinejoin="round"/>
                <rect x="6" y="14" width="12" height="7" rx="1"/>
              </svg>
              Imprimer
            </button>
          )}
        </div>
      </div>

      {/* EMPTY STATE */}
      {!hasAnyLesson && tds.length === 0 && (
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
      {(hasAnyLesson || tds.length > 0) && view === 'week' && (
        <div className="cal-week" ref={weekRef}>
          {weekDays.map((day, i) => {
            const dateStr = toDateStr(day)
            const occs = byDate.get(dateStr) ?? []
            const dayTds = tdsByDate.get(dateStr) ?? []
            const isToday = dateStr === today
            const isPast = dateStr < today
            const { visible, overflow } = daySlots(occs.length, dayTds.length)
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

                {/* TD du jour — toujours en tête de colonne, bord couleur matière */}
                {dayTds.length > 0 && (
                  <div className="cal-tds">
                    {dayTds.map(td => {
                      const sys = td.system_id ? systemsById.get(td.system_id) : undefined
                      const c = (sys as unknown as { color?: string } | undefined)?.color
                      return (
                        <button
                          key={td.id}
                          className="cal-td"
                          style={c ? { borderLeftColor: c } : undefined}
                          onClick={() => openTdEdit(td)}
                          title={`${td.title}${sys ? ' · ' + sys.name : ''}${td.location ? ' · ' + td.location : ''}`}
                        >
                          {tdTimeRange(td) && <span className="cal-td-time">{tdTimeRange(td)}</span>}
                          <span className="cal-td-title">{td.title}</span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {occs.length === 0 ? (
                  dayTds.length === 0 ? <div className="cal-day-empty">{'·'}</div> : <div style={{ flex: 1 }} />
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
      {(hasAnyLesson || tds.length > 0) && view === 'month' && (
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
              const mTds = tdsByDate.get(dateStr) ?? []
              const isToday = dateStr === today
              const isPast = dateStr < today
              // Les TD occupent des lignes de titre : on les retranche du quota.
              const slots = monthSlots(occs.length + mTds.length)
              const mVisible = Math.max(0, slots.visible - mTds.length)
              const mOverflow = occs.length - mVisible
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
                  {(titleOccs.length > 0 || mTds.length > 0) && (
                    <div className="cal-month-titles">
                      {mTds.map(td => (
                        <button
                          key={td.id}
                          className="cal-month-td"
                          onClick={(e) => { e.stopPropagation(); openTdEdit(td) }}
                          title={`${td.title}${td.location ? ' · ' + td.location : ''}`}
                        >
                          {tdTimeRange(td) && <strong>{tdTimeRange(td)}</strong>} {td.title}
                        </button>
                      ))}
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
                      className={`cal-fiche cal-of-row${done ? ' cal-done' : ''}`}
                      onClick={() => openReview(occ)}
                      title={sysName}
                    >
                      <span className="cal-of-ic"><SubjectIcon name={sysName} /></span>
                      <span className="cal-of-main">
                        <span className="cal-fiche-name">{occ.lesson.name}</span>
                        {sysName && <span className="cal-of-sub">{sysName}</span>}
                      </span>
                      <span className={`cal-fiche-dot ${cls}${done ? ' cal-scored' : ''}`} />
                      <span className="cal-fiche-j">J+{J[occ.stepIndex]}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}

      {/* FEUILLE D'IMPRESSION (cachée à l'écran, seule visible en @media print) */}
      {(hasAnyLesson || tds.length > 0) && (
        <div className="cal-print" aria-hidden="true">
          <div className="cal-print-head">
            <span className="cal-print-brand">Med·Rev</span>
            <span className="cal-print-title">Semaine du {weekLabel}</span>
            <span className="cal-print-meta">
              {weekTotal} révision{weekTotal > 1 ? 's' : ''}
              {' · '}{semester === 'year' ? 'Année' : `Semestre ${semester}`}
              {' · '}imprimé le {new Date().toLocaleDateString('fr-FR')}
            </span>
          </div>
          <div className="cal-print-grid">
            {weekDays.map((day, i) => {
              const dateStr = toDateStr(day)
              const occs = byDate.get(dateStr) ?? []
              const dayTds = tdsByDate.get(dateStr) ?? []
              // Groupe par matière : nom de matière affiché une seule fois
              // (au lieu d'une sous-ligne par fiche) → colonne bien plus courte.
              const bySys = new Map<string, FicheOccurrence[]>()
              occs.forEach(o => {
                const sn = systemsById.get(o.lesson.system_id)?.name ?? 'Autre'
                const arr = bySys.get(sn)
                if (arr) arr.push(o)
                else bySys.set(sn, [o])
              })
              return (
                <div key={i} className="cal-print-day">
                  <div className="cal-print-day-head">
                    <span className="cal-print-day-name">{DAY_LABELS_LONG[i]}</span>
                    <span className="cal-print-day-num">{day.getDate()}</span>
                  </div>
                  {/* TD du jour — avant les révisions */}
                  {dayTds.map(td => (
                    <div key={td.id} className="cal-print-tdrow">
                      <span className="cal-print-td-time">{tdTimeRange(td) || '·'}</span>
                      <span className="cal-print-td-title">
                        {td.title}
                        {td.location ? ` · ${td.location}` : ''}
                      </span>
                    </div>
                  ))}
                  {occs.length === 0 ? (
                    <div className="cal-print-none">—</div>
                  ) : (
                    Array.from(bySys.entries()).map(([sysName, list]) => (
                      <div key={sysName} className="cal-print-group">
                        <div className="cal-print-group-name">{sysName}</div>
                        {list.map(occ => {
                          const done = occ.scoreForThisJ !== null
                          return (
                            <div
                              key={`${occ.lesson.id}-${occ.stepIndex}`}
                              className={`cal-print-item${done ? ' cal-print-done' : ''}`}
                            >
                              <span className="cal-print-box">{done ? '✓' : ''}</span>
                              <span className="cal-print-item-name">
                                {occ.lesson.name}
                                <span className="cal-print-item-j"> J+{J[occ.stepIndex]}</span>
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    ))
                  )}
                </div>
              )
            })}
          </div>
          <div className="cal-print-foot">
            Coche chaque case une fois la révision faite, puis note la fiche dans MedRev.
          </div>
        </div>
      )}

      {/* MODAL TD : création / édition */}
      {tdModal && (
        <div className="cal-overflow" onClick={() => setTdModal(null)}>
          <div className="cal-overflow-card cal-tdmodal" onClick={e => e.stopPropagation()}>
            <div className="cal-overflow-head">
              <div>
                <h2 className="cal-overflow-title">
                  {tdModal === 'new' ? 'Nouveau TD / cours' : 'Modifier le TD'}
                </h2>
                <div className="cal-overflow-sub">
                  {tdModal === 'new'
                    ? 'Un événement de ton emploi du temps, distinct des révisions.'
                    : 'Cette occurrence uniquement.'}
                </div>
              </div>
              <button className="cal-overflow-close" onClick={() => setTdModal(null)} aria-label="Fermer">{'×'}</button>
            </div>
            <div className="cal-tdform">
              <label className="cal-tdfield">
                <span className="cal-tdlabel">Intitulé</span>
                <input
                  className="cal-tdinput"
                  type="text"
                  placeholder="ex : TD Anatomie, CM Biochimie, colle…"
                  value={tdTitle}
                  onChange={e => setTdTitle(e.target.value)}
                  autoFocus
                />
              </label>
              <div className="cal-tdrow2">
                <label className="cal-tdfield">
                  <span className="cal-tdlabel">Matière (optionnel)</span>
                  <select className="cal-tdinput" value={tdSysId} onChange={e => setTdSysId(e.target.value)}>
                    <option value="">Aucune</option>
                    {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
                <label className="cal-tdfield">
                  <span className="cal-tdlabel">Date</span>
                  <input className="cal-tdinput" type="date" value={tdDate} onChange={e => setTdDate(e.target.value)} />
                </label>
              </div>
              <div className="cal-tdrow2">
                <label className="cal-tdfield">
                  <span className="cal-tdlabel">Début</span>
                  <input className="cal-tdinput" type="time" value={tdStart} onChange={e => setTdStart(e.target.value)} />
                </label>
                <label className="cal-tdfield">
                  <span className="cal-tdlabel">Fin</span>
                  <input className="cal-tdinput" type="time" value={tdEnd} onChange={e => setTdEnd(e.target.value)} />
                </label>
              </div>
              <label className="cal-tdfield">
                <span className="cal-tdlabel">Lieu (optionnel)</span>
                <input
                  className="cal-tdinput"
                  type="text"
                  placeholder="ex : amphi B, salle 204…"
                  value={tdLocation}
                  onChange={e => setTdLocation(e.target.value)}
                />
              </label>
              {tdModal === 'new' && (
                <label className="cal-tdfield">
                  <span className="cal-tdlabel">Répéter chaque semaine jusqu&apos;au (optionnel)</span>
                  <input
                    className="cal-tdinput"
                    type="date"
                    value={tdRepeatUntil}
                    min={tdDate}
                    onChange={e => setTdRepeatUntil(e.target.value)}
                  />
                  <span className="cal-tdhint">Crée une occurrence par semaine, modifiable une par une (30 max).</span>
                </label>
              )}
              {tdError && <div className="cal-tderror">{tdError}</div>}
              <div className="cal-tdactions">
                {tdModal !== 'new' && (
                  <button
                    className="cal-tdbtn cal-tdbtn-danger"
                    onClick={() => deleteTd(tdModal.id)}
                    disabled={tdSaving}
                  >
                    Supprimer
                  </button>
                )}
                <div className="cal-tdactions-right">
                  <button className="cal-tdbtn" onClick={() => setTdModal(null)} disabled={tdSaving}>Annuler</button>
                  <button
                    className="cal-tdbtn cal-tdbtn-primary"
                    onClick={saveTd}
                    disabled={!tdTitle.trim() || !tdDate || tdSaving}
                  >
                    {tdSaving ? 'Enregistrement…' : 'Enregistrer'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

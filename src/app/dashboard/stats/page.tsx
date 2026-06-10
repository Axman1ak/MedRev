'use client'
// src/app/dashboard/stats/page.tsx
//
// v5 — "le score à gauche, les trois moyens de le faire monter à droite".
// Colonne A : l'indice (anneau + sceau de rang + série) puis le plan jusqu'au
// concours (Premium). Colonne B : TROIS leviers, un par composante de
// l'indice, chacun avec son sous-score ET son action :
//   - MAÎTRISE (40%)  → remonter ses notes faibles
//   - COUVERTURE (25%) → faire les paliers J de ses fiches (≥3 paliers = couverte)
//   - ASSIDUITÉ (35%)  → valider sa journée, tenir la série
// Le rang est explicite ("Rang 3/6 — Scribe I") : pas de jargon gaming.
// Pas de sous-titres italiques ; une page, pas de scroll (desktop).

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { System, Lesson } from '@/types'
import SubjectIcon from '@/components/SubjectIcon'
import './styles.css'

const J = [0, 1, 3, 5, 7, 15, 21, 30, 45, 60, 75, 90, 105, 120]
const COVERED_AT = 3 // une fiche est "couverte" à partir de 3 paliers officiels

// ===================== TYPES =====================
type Score = 1 | 2 | 3 | 4 | 5
type Semestre = 1 | 2 | 'year'
type StepEntry = {
  score?: Score
  ok?: boolean       // legacy
  date?: string
  note?: string
  temp_score?: Score
  temp_date?: string
} | null

// ===================== STEP HELPERS =====================
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

function effectiveStepScore(s: StepEntry): Score | null {
  const off = stepScore(s)
  if (off) return off
  if (!s) return null
  const t = (s as { temp_score?: number }).temp_score
  if (typeof t === 'number' && t >= 1 && t <= 5) return t as Score
  return null
}

function stepPostedDate(s: StepEntry): string | null {
  if (!s) return null
  const off = (s as { date?: string }).date
  if (off) return off
  const tmp = (s as { temp_date?: string }).temp_date
  if (tmp) return tmp
  return null
}

function getLastEffScore(lesson: Lesson): Score | null {
  const steps = (lesson.steps as StepEntry[]) || []
  for (let i = J.length - 1; i >= 0; i--) {
    const sc = effectiveStepScore(steps[i])
    if (sc) return sc
  }
  return null
}

function officialCount(lesson: Lesson): number {
  const steps = (lesson.steps as StepEntry[]) || []
  let n = 0
  for (const s of steps) if (stepScore(s)) n++
  return n
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// ===================== DÛ AUJOURD'HUI =====================
function lessonSkips(l: Lesson): number[] {
  const s = (l as { skips?: unknown }).skips
  return Array.isArray(s) ? (s as number[]) : []
}
function lessonPostpones(l: Lesson): Record<string, string> {
  const p = (l as { postpones?: unknown }).postpones
  return p && typeof p === 'object' ? (p as Record<string, string>) : {}
}

function isDueToday(l: Lesson, today: string): boolean {
  if (!l.learn_date) return false
  const steps = (l.steps as StepEntry[]) || []
  const skips = lessonSkips(l)
  const postpones = lessonPostpones(l)
  for (let i = 0; i < J.length; i++) {
    if (stepScore(steps[i])) continue
    if (skips.includes(i)) continue
    const d = new Date(l.learn_date + 'T12:00:00')
    d.setDate(d.getDate() + J[i])
    const dd = postpones[String(i)] ?? d.toISOString().split('T')[0]
    return dd <= today
  }
  return false
}

// ===================== ACTIVITÉ =====================
function buildActivityIndex(lessons: Lesson[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const l of lessons) {
    const steps = (l.steps as StepEntry[]) || []
    for (const s of steps) {
      if (!s) continue
      if (effectiveStepScore(s) === null) continue
      const d = stepPostedDate(s)
      if (!d) continue
      m.set(d, (m.get(d) ?? 0) + 1)
    }
  }
  return m
}

// ===================== JOURS ACTIFS (règle des 10 minutes) =====================
// Un jour COMPTE (assiduité, série) à partir de 10 minutes de révision réelle
// sur l'appli (gardens.day_log, alimenté par la session Focus).
// Fallback historique : avant l'existence du suivi de temps, un jour avec au
// moins une révision notée compte — sinon tout l'historique s'éteindrait.
const TEN_MIN_MS = 10 * 60 * 1000

function buildActiveDays(activityIndex: Map<string, number>, dayLog: Record<string, number>): Set<string> {
  const firstLog = Object.keys(dayLog).sort()[0] ?? null
  const set = new Set<string>()
  for (const [d, ms] of Object.entries(dayLog)) {
    if (ms >= TEN_MIN_MS) set.add(d)
  }
  activityIndex.forEach((_, d) => {
    if (firstLog === null || d < firstLog) set.add(d)
  })
  return set
}

// ===================== HEATMAP ANNÉE (façon Anki) =====================
type HeatmapCell = { date: string; count: number; isToday: boolean; inFuture: boolean }

function buildYearHeatmap(activityIndex: Map<string, number>, today: string): HeatmapCell[][] {
  const todayD = new Date(today + 'T12:00:00')
  const dow = todayD.getDay()
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const thisMonday = new Date(todayD)
  thisMonday.setDate(todayD.getDate() + mondayOffset)

  const weeks: HeatmapCell[][] = []
  for (let w = 51; w >= 0; w--) {
    const week: HeatmapCell[] = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(thisMonday)
      date.setDate(thisMonday.getDate() - w * 7 + d)
      const ds = date.toISOString().split('T')[0]
      week.push({
        date: ds,
        count: activityIndex.get(ds) ?? 0,
        isToday: ds === today,
        inFuture: ds > today,
      })
    }
    weeks.push(week)
  }
  return weeks
}

function intensityClass(count: number, max: number): string {
  if (count === 0) return 'i0'
  const ratio = count / max
  if (ratio < 0.25) return 'i1'
  if (ratio < 0.5) return 'i2'
  if (ratio < 0.75) return 'i3'
  return 'i4'
}

function fmtMonth(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')
}

// ===================== INDICE (40 maîtrise / 25 couverture / 35 assiduité) =====================
function computeReadiness(
  lessons: Lesson[],
  activeDays: Set<string>,
  asOf: string
): number {
  if (lessons.length === 0) return 0
  let mSum = 0, mN = 0, covered = 0
  for (const l of lessons) {
    const steps = (l.steps as StepEntry[]) || []
    let sSum = 0, sN = 0, official = 0
    for (const s of steps) {
      if (!s) continue
      const d = stepPostedDate(s)
      if (!d || d > asOf) continue
      const eff = effectiveStepScore(s)
      if (eff) { sSum += eff; sN++ }
      if (stepScore(s)) official++
    }
    if (sN > 0) { mSum += sSum / sN; mN++ }
    if (official >= COVERED_AT) covered++
  }
  const mastery = mN > 0 ? (mSum / mN) / 5 : 0
  const coverage = covered / lessons.length
  let active14 = 0
  for (let k = 0; k < 14; k++) {
    if (activeDays.has(shiftDate(asOf, -k))) active14++
  }
  const assiduite = Math.min(1, active14 / 10)
  return Math.round(100 * (0.4 * mastery + 0.25 * coverage + 0.35 * assiduite))
}

function computeParts(lessons: Lesson[], activeDays: Set<string>, today: string) {
  let mSum = 0, mN = 0, covered = 0
  for (const l of lessons) {
    const steps = (l.steps as StepEntry[]) || []
    let sSum = 0, sN = 0, official = 0
    for (const s of steps) {
      if (!s) continue
      const eff = effectiveStepScore(s)
      if (eff) { sSum += eff; sN++ }
      if (stepScore(s)) official++
    }
    if (sN > 0) { mSum += sSum / sN; mN++ }
    if (official >= COVERED_AT) covered++
  }
  let active14 = 0
  for (let k = 0; k < 14; k++) {
    if (activeDays.has(shiftDate(today, -k))) active14++
  }
  return {
    mastery: mN > 0 ? (mSum / mN) / 5 : 0,
    coverage: lessons.length > 0 ? covered / lessons.length : 0,
    assiduite: Math.min(1, active14 / 10),
    coveredCount: covered,
  }
}

// ===================== RANGS =====================
const RANKS = [
  { at: 0, name: 'Apprenti', color: '#8CA4BC' },
  { at: 20, name: 'Copiste', color: '#B86448' },
  { at: 35, name: 'Scribe', color: '#7FB0D4' },
  { at: 50, name: 'Lettré', color: '#D9B24A' },
  { at: 65, name: 'Érudit', color: '#7AA56B' },
  { at: 80, name: 'Maître', color: '#15304E' },
]

function rankFor(v: number) {
  let idx = 0
  for (let i = 0; i < RANKS.length; i++) if (v >= RANKS[i].at) idx = i
  const rank = RANKS[idx]
  const next = RANKS[idx + 1] ?? null
  const span = (next ? next.at : 100) - rank.at
  const within = v - rank.at
  const tier = within < span / 3 ? 3 : within < (2 * span) / 3 ? 2 : 1
  const toNext = next ? next.at - v : null
  return { ...rank, level: idx + 1, tier, next, toNext, progress: span > 0 ? within / span : 1 }
}

function semLabel(s: Semestre): string {
  if (s === 'year') return 'Année complète'
  return `Semestre ${s}`
}

// ===================== EMBLÈME =====================
function RankSeal({ color, tier }: { color: string; tier: number }) {
  return (
    <svg viewBox="0 0 120 120" className="st4-seal" aria-hidden="true">
      <path d="M 22 48 L 8 60 L 22 72 L 28 66 L 21 60 L 28 54 Z" fill={color} opacity="0.55" />
      <path d="M 98 48 L 112 60 L 98 72 L 92 66 L 99 60 L 92 54 Z" fill={color} opacity="0.55" />
      <g transform="rotate(45 60 60)">
        <rect x="29" y="29" width="62" height="62" rx="7" fill={color} opacity="0.22" />
        <rect x="37" y="37" width="46" height="46" rx="6" fill={color} opacity="0.5" />
        <rect x="45" y="45" width="30" height="30" rx="5" fill={color} />
      </g>
      <path d="M 60 39 L 75 60 L 60 60 Z" fill="rgba(255,255,255,0.4)" />
      <path d="M 60 60 L 60 81 L 45 60 Z" fill="rgba(0,0,0,0.18)" />
      <g>
        {[0, 1, 2].map(i => (
          <circle
            key={i}
            cx={48 + i * 12}
            cy="106"
            r="3.4"
            fill={i < (4 - tier) ? color : 'none'}
            stroke={color}
            strokeWidth="1.2"
            opacity={i < (4 - tier) ? 1 : 0.45}
          />
        ))}
      </g>
    </svg>
  )
}

function RankRing({ value, color, children }: { value: number; color: string; children: React.ReactNode }) {
  const R = 88
  const C = 2 * Math.PI * R
  const filled = (Math.max(0, Math.min(100, value)) / 100) * C
  return (
    <div className="st4-ring-wrap">
      <svg viewBox="0 0 220 220" className="st4-ring">
        <circle cx="110" cy="110" r={R} fill="none" stroke="var(--soft)" strokeWidth="13" />
        <circle
          cx="110" cy="110" r={R}
          fill="none"
          stroke={color}
          strokeWidth="13"
          strokeLinecap="round"
          strokeDasharray={`${filled.toFixed(1)} ${C.toFixed(1)}`}
          transform="rotate(-90 110 110)"
          style={{ transition: 'stroke-dasharray .9s cubic-bezier(.4,0,.2,1), stroke .4s' }}
        />
      </svg>
      <div className="st4-ring-center">{children}</div>
    </div>
  )
}

// ===================== PAGE =====================
export default function StatsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [systems, setSystems] = useState<System[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [semestre, setSemestre] = useState<Semestre>(2)
  const [isPro, setIsPro] = useState(false)
  const [examDate, setExamDate] = useState('')
  // Temps de révision par jour (gardens.day_log) — règle des 10 minutes.
  const [dayLog, setDayLog] = useState<Record<string, number>>({})

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem('medrev-sem')
    const s: Semestre = raw === '1' ? 1 : raw === 'year' ? 'year' : 2
    setSemestre(s)
    setExamDate(localStorage.getItem('medrev-exam-date') ?? '')

    function onSemChange(e: Event) {
      const ce = e as CustomEvent<Semestre>
      if (ce.detail === 1 || ce.detail === 2 || ce.detail === 'year') {
        setSemestre(ce.detail)
      }
    }
    window.addEventListener('medrev-sem-change', onSemChange)
    return () => window.removeEventListener('medrev-sem-change', onSemChange)
  }, [])

  function chooseExamDate(d: string) {
    setExamDate(d)
    if (typeof window !== 'undefined') {
      if (d) localStorage.setItem('medrev-exam-date', d)
      else localStorage.removeItem('medrev-exam-date')
    }
  }

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const [{ data: sys }, { data: les }, { data: prof }, { data: garden }] = await Promise.all([
        supabase.from('systems').select('*').eq('user_id', user.id).order('semestre').order('created_at'),
        supabase.from('lessons').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('profiles').select('plan').eq('id', user.id).single(),
        supabase.from('gardens').select('day_log').eq('user_id', user.id).maybeSingle(),
      ])
      if (cancelled) return
      setSystems((sys as System[] | null) ?? [])
      setLessons((les as Lesson[] | null) ?? [])
      setIsPro((prof?.plan as string) === 'pro')
      {
        const raw = (garden as { day_log?: unknown } | null)?.day_log
        const log: Record<string, number> = {}
        if (raw && typeof raw === 'object') {
          for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
            if (typeof v === 'number' && v > 0) log[k] = v
          }
        }
        setDayLog(log)
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [supabase, router])

  const semSystems = useMemo(() => {
    if (semestre === 'year') return systems
    return systems.filter(s => s.semestre === semestre)
  }, [systems, semestre])
  const semSystemIds = useMemo(() => new Set(semSystems.map(s => s.id)), [semSystems])
  const semLessons = useMemo(() => lessons.filter(l => semSystemIds.has(l.system_id)), [lessons, semSystemIds])

  const activityIndex = useMemo(() => buildActivityIndex(semLessons), [semLessons])
  const activeDays = useMemo(() => buildActiveDays(activityIndex, dayLog), [activityIndex, dayLog])
  const heatmap = useMemo(() => buildYearHeatmap(activityIndex, today), [activityIndex, today])
  const heatmapMax = useMemo(() => {
    let max = 1
    activityIndex.forEach(v => { if (v > max) max = v })
    return max
  }, [activityIndex])
  const monthLabels = useMemo(() => {
    const out: { weekIdx: number; label: string }[] = []
    let lastMonth = -1
    heatmap.forEach((week, wi) => {
      const m = new Date(week[0].date + 'T12:00:00').getMonth()
      if (m !== lastMonth) {
        out.push({ weekIdx: wi, label: fmtMonth(week[0].date) })
        lastMonth = m
      }
    })
    return out.slice(1)
  }, [heatmap])

  const totalRevs = useMemo(() => {
    let n = 0
    activityIndex.forEach(v => { n += v })
    return n
  }, [activityIndex])

  // ===== INDICE + RANG =====
  const index = useMemo(() => computeReadiness(semLessons, activeDays, today), [semLessons, activeDays, today])
  const index7 = useMemo(() => computeReadiness(semLessons, activeDays, shiftDate(today, -7)), [semLessons, activeDays, today])
  const index30 = useMemo(() => computeReadiness(semLessons, activeDays, shiftDate(today, -30)), [semLessons, activeDays, today])
  const delta7 = index - index7
  const parts = useMemo(() => computeParts(semLessons, activeDays, today), [semLessons, activeDays, today])
  const rank = useMemo(() => rankFor(index), [index])

  // ===== SÉRIE =====
  const currentStreak = useMemo(() => {
    let n = 0
    let cursor = today
    if (!activeDays.has(cursor)) cursor = shiftDate(cursor, -1)
    while (activeDays.has(cursor)) {
      n++
      cursor = shiftDate(cursor, -1)
    }
    return n
  }, [activeDays, today])

  const recordStreak = useMemo(() => {
    if (activeDays.size === 0) return 0
    const dates = Array.from(activeDays).sort()
    let max = 1, cur = 1
    for (let i = 1; i < dates.length; i++) {
      const diff = Math.round(
        (new Date(dates[i] + 'T12:00:00').getTime() - new Date(dates[i - 1] + 'T12:00:00').getTime()) / 86400000
      )
      if (diff === 1) { cur++; if (cur > max) max = cur } else cur = 1
    }
    return max
  }, [activeDays])

  // ===== LEVIER MAÎTRISE : fiches aux dernières notes faibles =====
  const weakFiches = useMemo(() => {
    const out: { lesson: Lesson; sysName: string; last: Score }[] = []
    for (const l of semLessons) {
      const last = getLastEffScore(l)
      if (last === null || last > 2) continue
      out.push({
        lesson: l,
        last,
        sysName: semSystems.find(s => s.id === l.system_id)?.name ?? 'Matière',
      })
    }
    return out.sort((a, b) => a.last - b.last).slice(0, 3)
  }, [semLessons, semSystems])

  const weakHref = weakFiches.length > 0
    ? `/dashboard/focus?lessons=${weakFiches.map(f => f.lesson.id).join(',')}`
    : '/dashboard/focus'

  // ===== LEVIER COUVERTURE : fiches les moins avancées dans la courbe J =====
  const uncovered = useMemo(() => {
    const rows = semLessons
      .filter(l => l.learn_date)
      .map(l => ({ lesson: l, n: officialCount(l), sysName: semSystems.find(s => s.id === l.system_id)?.name ?? '' }))
      .filter(r => r.n < COVERED_AT)
      .sort((a, b) => a.n - b.n)
    return { count: rows.length, top: rows.slice(0, 3) }
  }, [semLessons, semSystems])

  // ===== LEVIER ASSIDUITÉ : journée + 14 jours =====
  const dueToday = useMemo(() => semLessons.filter(l => isDueToday(l, today)).length, [semLessons, today])
  const doneToday = activityIndex.get(today) ?? 0
  const dayValidated = doneToday > 0 && dueToday === 0

  // ===== TRAJECTOIRE (Premium) =====
  const daysToExam = useMemo(() => {
    if (!examDate || examDate <= today) return null
    return Math.round((new Date(examDate + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) / 86400000)
  }, [examDate, today])

  // Prévision : points gagnés la semaine prochaine au rythme des 30 derniers jours.
  const perWeek = useMemo(() => Math.round(((index - index30) / 30) * 7), [index, index30])

  const projected = useMemo(() => {
    if (daysToExam === null) return null
    const perDay = (index - index30) / 30
    return Math.max(0, Math.min(100, Math.round(index + perDay * daysToExam)))
  }, [daysToExam, index, index30])

  if (loading) {
    return (
      <div className="stats-page">
        <div className="stats-loading">Chargement…</div>
      </div>
    )
  }

  if (totalRevs === 0) {
    return (
      <div className="stats-page">
        <div className="stats-empty-global">
          <div className="stats-empty-global-icon" aria-hidden>◈</div>
          <h1 className="stats-empty-global-title">
            Ton indice de préparation t&apos;attend
          </h1>
          <p className="stats-empty-global-text">
            Note tes premières révisions au jour J : tu démarreras au rang
            Apprenti, et chaque jour de travail te rapprochera du rang Maître.
          </p>
          <Link href="/dashboard/fiches" className="stats-empty-global-btn">
            Créer ma première fiche →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="stats-page">
      <div className="stats-header st6-header">
        <h1 className="stats-title">
          Suis-je <em>prêt</em> ? <span className="st5-header-sem">· {semLabel(semestre)}</span>
        </h1>
        {isPro && (
          <label className="st6-examdate">
            <span className="st6-examdate-lbl">Concours</span>
            <input
              type="date"
              className="st-plan-date-input st6-examdate-input"
              value={examDate}
              min={today}
              onChange={e => chooseExamDate(e.target.value)}
            />
            {daysToExam !== null && <span className="st6-examdate-jd">J-{daysToExam}</span>}
          </label>
        )}
      </div>

      <div className="st-cols st5-cols">

        {/* ============ COLONNE A : LE SCORE ============ */}
        <div className="st-col st5-col">
          <div className="stats-card st5-hero">
            <RankRing value={index} color={rank.color}>
              <RankSeal color={rank.color} tier={rank.tier} />
            </RankRing>

            <div>
              <div className="st4-score">
                <span className="st4-score-num">{index}</span>
                <span className="st4-score-of">/ 100</span>
              </div>
              <div className="st4-rank" style={{ color: rank.color }}>
                {rank.name} {rank.tier === 3 ? 'III' : rank.tier === 2 ? 'II' : 'I'}
              </div>
              <div className="st5-rank-level">Rang {rank.level} / {RANKS.length}</div>
              <div className={`st4-delta ${delta7 > 0 ? 'up' : delta7 < 0 ? 'down' : ''}`}>
                {delta7 > 0 ? `▲ +${delta7} pts cette semaine` : delta7 < 0 ? `▼ ${delta7} pts cette semaine` : '= stable cette semaine'}
              </div>
              {isPro ? (
                <div className="st6-forecast">
                  prévision : <strong>{perWeek >= 0 ? `+${perWeek}` : perWeek} pts</strong> la semaine prochaine
                  {daysToExam !== null && projected !== null && (
                    <> · <strong style={{ color: rankFor(projected).color }}>{projected}/100</strong> le jour J</>
                  )}
                </div>
              ) : (
                <Link href="/dashboard/pricing" className="st6-forecast-teaser">
                  Projette ton score jusqu&apos;au concours — Premium →
                </Link>
              )}
            </div>

            {rank.next && (
              <div className="st4-nextrank">
                <div className="st4-nextrank-bar">
                  <i style={{ width: `${Math.round(rank.progress * 100)}%`, background: rank.color }} />
                </div>
                <div className="st4-nextrank-lbl">
                  Rang suivant : <strong>{rank.next.name}</strong> dans {rank.toNext} pt{(rank.toNext ?? 0) > 1 ? 's' : ''}
                </div>
              </div>
            )}

            <div className={`st4-streak${currentStreak > 0 ? ' lit' : ''}`}>
              <svg viewBox="0 0 24 24" className="st4-flame" aria-hidden="true">
                <path d="M12 2 C 13 7 17 8.5 17 13 a 5 5 0 0 1 -10 0 C 7 10 9.5 9 9.5 5.5 11 7 11.5 4.5 12 2 Z" fill={currentStreak > 0 ? '#E08B3C' : 'var(--dim)'} />
                <path d="M12 9 c .8 2.2 2.4 2.8 2.4 4.8 a 2.4 2.4 0 0 1 -4.8 0 c 0 -1.6 1.6 -2.4 2.4 -4.8 Z" fill={currentStreak > 0 ? '#F5D060' : 'var(--soft)'} />
              </svg>
              <span className="st4-streak-num">{currentStreak}</span>
              <span className="st4-streak-lbl">
                jour{currentStreak > 1 ? 's' : ''} d&apos;affilée
                {recordStreak > currentStreak && <> · record {recordStreak}</>}
              </span>
            </div>
          </div>

        </div>

        {/* ============ COLONNE B : LES 3 LEVIERS ============ */}
        <div className="st-col st5-col">

          {/* MAÎTRISE */}
          <div className="stats-card st5-lever">
            <div className="st5-lever-head">
              <span className="st5-lever-name">Maîtrise</span>
              <span className="st5-lever-how">remonte tes notes faibles</span>
              <span className="st5-lever-score">{Math.round(parts.mastery * 100)}</span>
            </div>
            <div className="st5-lever-bar"><i style={{ width: `${Math.round(parts.mastery * 100)}%`, background: rank.color }} /></div>
            <div className="st5-lever-body">
              {weakFiches.length > 0 ? (
                weakFiches.map(f => (
                  <div key={f.lesson.id} className="st5-fiche">
                    <span className="st5-fiche-ic"><SubjectIcon name={f.sysName} /></span>
                    <span className="st5-fiche-nm">{f.lesson.name}</span>
                    <span className="st5-fiche-sys">{f.sysName}</span>
                    <span className="st5-fiche-badge weak">notée {f.last}/5</span>
                  </div>
                ))
              ) : (
                <div className="st-empty">Aucune fiche en dessous de 3/5 — belle maîtrise.</div>
              )}
            </div>
            {weakFiches.length > 0 && (
              <Link href={weakHref} className="st-act st5-lever-cta">
                Retravailler ces {weakFiches.length} fiche{weakFiches.length > 1 ? 's' : ''} →
              </Link>
            )}
          </div>

          {/* COUVERTURE */}
          <div className="stats-card st5-lever">
            <div className="st5-lever-head">
              <span className="st5-lever-name">Couverture</span>
              <span className="st5-lever-how">avance dans les paliers J</span>
              <span className="st5-lever-score">{Math.round(parts.coverage * 100)}</span>
            </div>
            <div className="st5-lever-bar"><i style={{ width: `${Math.round(parts.coverage * 100)}%`, background: rank.color }} /></div>
            <div className="st5-lever-body">
              {uncovered.top.map(r => (
                <div key={r.lesson.id} className="st5-fiche">
                  <span className="st5-fiche-ic"><SubjectIcon name={r.sysName} /></span>
                  <span className="st5-fiche-nm">{r.lesson.name}</span>
                  <span className="st5-fiche-sys">{r.sysName}</span>
                  <span className="st5-fiche-badge">{r.n} / {COVERED_AT} paliers</span>
                </div>
              ))}
              {uncovered.count === 0 && (
                <div className="st-empty">Toutes tes fiches sont couvertes — continue les paliers.</div>
              )}
            </div>
            <Link href="/dashboard/focus" className="st-act st5-lever-cta">
              Faire les révisions du jour →
            </Link>
          </div>

          {/* ASSIDUITÉ */}
          <div className="stats-card st5-lever">
            <div className="st5-lever-head">
              <span className="st5-lever-name">Assiduité</span>
              <span className="st5-lever-how">révise un peu chaque jour</span>
              <span className="st5-lever-score">{Math.round(parts.assiduite * 100)}</span>
            </div>
            <div className="st5-lever-bar"><i style={{ width: `${Math.round(parts.assiduite * 100)}%`, background: rank.color }} /></div>
            <div className="st5-lever-body">
              <div className="st5-heat">
                <div className="st5-heat-months">
                  {monthLabels.map((m, idx) => (
                    <span key={idx} style={{ left: `${(m.weekIdx / 52) * 100}%` }}>{m.label}</span>
                  ))}
                </div>
                <div className="st5-heat-grid">
                  {heatmap.map((week, wi) => (
                    <div key={wi} className="st5-heat-week">
                      {week.map((cell, di) => {
                        const cls = ['st5-heat-cell',
                          cell.inFuture ? 'future' : intensityClass(cell.count, heatmapMax),
                          cell.isToday ? 'today' : '',
                        ].filter(Boolean).join(' ')
                        return <div key={di} className={cls} title={`${cell.date} · ${cell.count} révision${cell.count > 1 ? 's' : ''}`} />
                      })}
                    </div>
                  ))}
                </div>
              </div>
              {dayValidated && <div className="st4-day-ok">✓ journée validée</div>}
            </div>
            {!dayValidated && (
              <Link href="/dashboard/focus" className="st-act st5-lever-cta">
                {doneToday === 0 ? 'Allumer la flamme du jour →' : 'Valider ta journée →'}
              </Link>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

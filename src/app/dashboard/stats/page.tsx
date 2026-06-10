'use client'
// src/app/dashboard/stats/page.tsx
//
// v4 "Coach de rang" — l'indice de préparation devient un RANG à gravir
// (référence : les apps type Lock-In, score OVR + tier + série).
// Univers MedRev : des rangs d'érudit (Apprenti → Maître), un sceau-emblème
// au centre d'un anneau de progression, la série de jours en flamme, et une
// carte "Ta journée" qui coache l'assiduité au quotidien.
//
// Indice 0-100 = 40% maîtrise + 25% couverture + 35% assiduité (jours actifs
// sur 14, cible 10) — l'assiduité pèse volontairement lourd : réviser souvent
// fait monter le rang, pas seulement bien noter.
//
// Une page, pas de scroll (desktop) : colonne A = le rang (héros plein
// hauteur), colonne B = Ta journée + Par matière + Plan concours (Premium).

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { System, Lesson } from '@/types'
import './styles.css'

const J = [0, 1, 3, 5, 7, 15, 21, 30, 45, 60, 75, 90, 105, 120]
const TARGET_INDEX = 85

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

function lastActivityDate(l: Lesson): string {
  const steps = (l.steps as StepEntry[]) || []
  let best = l.learn_date ?? ''
  for (const s of steps) {
    if (!s) continue
    const d = (s as { date?: string }).date ?? ''
    const td = (s as { temp_date?: string }).temp_date ?? ''
    if (d > best) best = d
    if (td > best) best = td
  }
  return best
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// ===================== DÛ AUJOURD'HUI (objectif du jour) =====================
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

// ===================== INDICE (40 maîtrise / 25 couverture / 35 assiduité) =====================
function computeReadiness(
  lessons: Lesson[],
  activityIndex: Map<string, number>,
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
    if (official >= 3) covered++
  }
  const mastery = mN > 0 ? (mSum / mN) / 5 : 0
  const coverage = covered / lessons.length
  let active14 = 0
  for (let k = 0; k < 14; k++) {
    const ds = shiftDate(asOf, -k)
    if ((activityIndex.get(ds) ?? 0) > 0) active14++
  }
  const assiduite = Math.min(1, active14 / 10)
  return Math.round(100 * (0.4 * mastery + 0.25 * coverage + 0.35 * assiduite))
}

function computeParts(lessons: Lesson[], activityIndex: Map<string, number>, today: string) {
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
    if (official >= 3) covered++
  }
  let active14 = 0
  for (let k = 0; k < 14; k++) {
    const ds = shiftDate(today, -k)
    if ((activityIndex.get(ds) ?? 0) > 0) active14++
  }
  return {
    mastery: mN > 0 ? (mSum / mN) / 5 : 0,
    coverage: lessons.length > 0 ? covered / lessons.length : 0,
    assiduite: Math.min(1, active14 / 10),
  }
}

// ===================== RANGS D'ÉRUDIT =====================
// 6 rangs × 3 tiers (III → I). Le sceau change de couleur, le tier de pips.
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
  // Tier : III (début du rang) → II → I (proche du rang suivant)
  const tier = within < span / 3 ? 3 : within < (2 * span) / 3 ? 2 : 1
  const toNext = next ? next.at - v : null
  return { ...rank, tier, next, toNext, progress: span > 0 ? within / span : 1 }
}

// ===================== HEATMAP 12 SEMAINES =====================
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

function semLabel(s: Semestre): string {
  if (s === 'year') return 'Année complète'
  return `Semestre ${s}`
}

// ===================== EMBLÈME DE RANG (sceau facetté + ailes) =====================
function RankSeal({ color, tier }: { color: string; tier: number }) {
  return (
    <svg viewBox="0 0 120 120" className="st4-seal" aria-hidden="true">
      {/* ailes latérales */}
      <path d="M 22 48 L 8 60 L 22 72 L 28 66 L 21 60 L 28 54 Z" fill={color} opacity="0.55" />
      <path d="M 98 48 L 112 60 L 98 72 L 92 66 L 99 60 L 92 54 Z" fill={color} opacity="0.55" />
      {/* losanges concentriques */}
      <g transform="rotate(45 60 60)">
        <rect x="29" y="29" width="62" height="62" rx="7" fill={color} opacity="0.22" />
        <rect x="37" y="37" width="46" height="46" rx="6" fill={color} opacity="0.5" />
        <rect x="45" y="45" width="30" height="30" rx="5" fill={color} />
      </g>
      {/* facette lumineuse */}
      <path d="M 60 39 L 75 60 L 60 60 Z" fill="rgba(255,255,255,0.4)" />
      <path d="M 60 60 L 60 81 L 45 60 Z" fill="rgba(0,0,0,0.18)" />
      {/* pips de tier (III II I) */}
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

// ===================== ANNEAU 360° =====================
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
      const [{ data: sys }, { data: les }, { data: prof }] = await Promise.all([
        supabase.from('systems').select('*').eq('user_id', user.id).order('semestre').order('created_at'),
        supabase.from('lessons').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('profiles').select('plan').eq('id', user.id).single(),
      ])
      if (cancelled) return
      setSystems((sys as System[] | null) ?? [])
      setLessons((les as Lesson[] | null) ?? [])
      setIsPro((prof?.plan as string) === 'pro')
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
  const heatmap = useMemo(() => buildYearHeatmap(activityIndex, today), [activityIndex, today])
  const heatmapMax = useMemo(() => {
    let max = 1
    activityIndex.forEach(v => { if (v > max) max = v })
    return max
  }, [activityIndex])

  const totalRevs = useMemo(() => {
    let n = 0
    activityIndex.forEach(v => { n += v })
    return n
  }, [activityIndex])

  // ===== INDICE + RANG =====
  const index = useMemo(() => computeReadiness(semLessons, activityIndex, today), [semLessons, activityIndex, today])
  const index7 = useMemo(() => computeReadiness(semLessons, activityIndex, shiftDate(today, -7)), [semLessons, activityIndex, today])
  const index30 = useMemo(() => computeReadiness(semLessons, activityIndex, shiftDate(today, -30)), [semLessons, activityIndex, today])
  const delta7 = index - index7
  const parts = useMemo(() => computeParts(semLessons, activityIndex, today), [semLessons, activityIndex, today])
  const rank = useMemo(() => rankFor(index), [index])

  // ===== SÉRIE (assiduité) =====
  const currentStreak = useMemo(() => {
    let n = 0
    let cursor = today
    if ((activityIndex.get(cursor) ?? 0) === 0) cursor = shiftDate(cursor, -1)
    while ((activityIndex.get(cursor) ?? 0) > 0) {
      n++
      cursor = shiftDate(cursor, -1)
    }
    return n
  }, [activityIndex, today])

  const recordStreak = useMemo(() => {
    if (activityIndex.size === 0) return 0
    const dates = Array.from(activityIndex.keys()).sort()
    let max = 1, cur = 1
    for (let i = 1; i < dates.length; i++) {
      const diff = Math.round(
        (new Date(dates[i] + 'T12:00:00').getTime() - new Date(dates[i - 1] + 'T12:00:00').getTime()) / 86400000
      )
      if (diff === 1) { cur++; if (cur > max) max = cur } else cur = 1
    }
    return max
  }, [activityIndex])

  // ===== TA JOURNÉE =====
  const dueToday = useMemo(() => semLessons.filter(l => isDueToday(l, today)).length, [semLessons, today])
  const doneToday = activityIndex.get(today) ?? 0
  const dayGoal = Math.max(dueToday + doneToday, doneToday, 1)
  const dayPct = Math.min(100, Math.round((doneToday / dayGoal) * 100))
  const dayValidated = doneToday > 0 && dueToday === 0

  const coachMsg = dayValidated
    ? (currentStreak > 1 ? `Journée validée — ${currentStreak} jours d'affilée. La flamme tient.` : 'Journée validée. Reviens demain pour démarrer une série.')
    : doneToday === 0
      ? (dueToday > 0 ? `${dueToday} révision${dueToday > 1 ? 's' : ''} t'attend${dueToday > 1 ? 'ent' : ''} — une seule suffit à garder la flamme.` : 'Rien de dû aujourd’hui — une révision libre garde la flamme allumée.')
      : `Encore ${dueToday} révision${dueToday > 1 ? 's' : ''} pour valider ta journée.`

  // ===== PAR MATIÈRE =====
  const bySystem = useMemo(() => {
    return semSystems
      .map(sys => {
        const sysLessons = semLessons.filter(l => l.system_id === sys.id)
        if (sysLessons.length === 0) return null
        const idx = computeReadiness(sysLessons, activityIndex, today)
        const idx30 = computeReadiness(sysLessons, activityIndex, shiftDate(today, -30))
        return { system: sys, index: idx, delta30: idx - idx30 }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => a.index - b.index)
  }, [semSystems, semLessons, activityIndex, today])

  // ===== SUGGESTIONS (dans "Ta journée") =====
  const suggestions = useMemo(() => {
    const out: { lesson: Lesson; sysName: string; why: string; weak: boolean; w: number }[] = []
    for (const l of semLessons) {
      if (!l.learn_date) continue
      const last = getLastEffScore(l)
      const lastD = lastActivityDate(l)
      const days = lastD
        ? Math.max(0, Math.round((new Date(today).getTime() - new Date(lastD).getTime()) / 86400000))
        : 0
      if (last === null && days < 3) continue
      const weak = last !== null && last <= 2
      const w = (last === null ? 3 : 6 - last) * 10 + Math.min(days, 60) / 2
      const sysName = semSystems.find(s => s.id === l.system_id)?.name ?? 'Matière'
      out.push({
        lesson: l,
        sysName,
        weak,
        w,
        why: weak ? `notée ${last}/5` : days > 0 ? `pas revue depuis ${days} j` : 'à consolider',
      })
    }
    return out.sort((a, b) => b.w - a.w).slice(0, 3)
  }, [semLessons, semSystems, today])

  const suggestionsHref = suggestions.length > 0
    ? `/dashboard/focus?lessons=${suggestions.map(s => s.lesson.id).join(',')}`
    : '/dashboard/focus'

  // ===== TRAJECTOIRE (Premium) =====
  const daysToExam = useMemo(() => {
    if (!examDate || examDate <= today) return null
    return Math.round((new Date(examDate + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) / 86400000)
  }, [examDate, today])

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
            Ton rang d&apos;érudit t&apos;attend
          </h1>
          <p className="stats-empty-global-text">
            Note tes premières révisions au jour J : tu démarreras Apprenti III,
            et chaque jour de travail fera monter ton indice vers le rang suivant.
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
      {/* HEADER */}
      <div className="stats-header">
        <div>
          <h1 className="stats-title">
            Suis-je <em>prêt</em> ?
          </h1>
          <div className="stats-sub">
            {semLabel(semestre)} · maîtrise + couverture + assiduité — fais monter ton rang
          </div>
        </div>
      </div>

      <div className="st-cols st4-cols">

        {/* ============ COLONNE A : LE RANG (héros pleine hauteur) ============ */}
        <div className="st-col">
          <div className="stats-card st4-hero">
            <RankRing value={index} color={rank.color}>
              <RankSeal color={rank.color} tier={rank.tier} />
            </RankRing>

            <div className="st4-score">
              <span className="st4-score-num">{index}</span>
              <span className="st4-score-of">/ 100</span>
            </div>
            <div className="st4-rank" style={{ color: rank.color }}>
              {rank.name} {rank.tier === 3 ? 'III' : rank.tier === 2 ? 'II' : 'I'}
            </div>
            <div className={`st4-delta ${delta7 > 0 ? 'up' : delta7 < 0 ? 'down' : ''}`}>
              {delta7 > 0 ? `▲ +${delta7} pts cette semaine` : delta7 < 0 ? `▼ ${delta7} pts cette semaine` : '= stable cette semaine'}
            </div>

            {rank.next && (
              <div className="st4-nextrank">
                <div className="st4-nextrank-bar">
                  <i style={{ width: `${Math.round(rank.progress * 100)}%`, background: rank.color }} />
                </div>
                <div className="st4-nextrank-lbl">
                  <strong>{rank.next.name}</strong> dans {rank.toNext} pt{(rank.toNext ?? 0) > 1 ? 's' : ''}
                </div>
              </div>
            )}

            {/* Série */}
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

            {/* Composantes */}
            <div className="st-parts st4-parts">
              {[
                { lbl: 'Maîtrise', v: parts.mastery, hint: 'moyenne de tes notes (40%)' },
                { lbl: 'Couverture', v: parts.coverage, hint: 'fiches avec ≥3 paliers faits (25%)' },
                { lbl: 'Assiduité', v: parts.assiduite, hint: 'jours actifs sur 14 (35%)' },
              ].map(p => (
                <div key={p.lbl} className="st-part" title={p.hint}>
                  <span className="st-part-lbl">{p.lbl}</span>
                  <span className="st-part-bar"><i style={{ width: `${Math.round(p.v * 100)}%`, background: rank.color }} /></span>
                  <span className="st-part-val">{Math.round(p.v * 100)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ============ COLONNE B ============ */}
        <div className="st-col">

          {/* TA JOURNÉE — le coach d'assiduité */}
          <div className="stats-card st4-day">
            <div className="stats-card-title">
              Ta journée
              <span className="stats-card-sub">{coachMsg}</span>
            </div>
            <div className="st4-day-row">
              <div className="st4-day-count">
                <strong>{doneToday}</strong>
                <span> / {dayGoal} révision{dayGoal > 1 ? 's' : ''}</span>
              </div>
              <div className="st4-day-bar">
                <i style={{ width: `${dayPct}%`, background: dayValidated ? '#2D6A4F' : rank.color }} />
              </div>
              {dayValidated && <span className="st4-day-ok">✓ validée</span>}
            </div>

            {suggestions.length > 0 && (
              <>
                <div className="st4-day-sugg">
                  {suggestions.map(s => (
                    <div key={s.lesson.id} className="st-next-row">
                      <span className="st-next-nm">{s.lesson.name}</span>
                      <span className="st-next-sys">{s.sysName}</span>
                      <span className={`st-next-why${s.weak ? ' weak' : ''}`}>{s.why}</span>
                    </div>
                  ))}
                </div>
                <div className="st-next-ctas">
                  <Link href={suggestionsHref} className="st-cta-primary">
                    +{suggestions.length} livre{suggestions.length > 1 ? 's' : ''} à la bibliothèque →
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* PAR MATIÈRE */}
          <div className="stats-card st4-grow">
            <div className="stats-card-title">
              Par matière
              <span className="stats-card-sub">de la plus fragile à la plus solide</span>
            </div>
            <div className="st-sys-list st4-sys-list">
              {bySystem.map(r => {
                const rr = rankFor(r.index)
                return (
                  <div key={r.system.id} className="st-sys-row">
                    <span className="st-sys-name">{r.system.name}</span>
                    <span className="st-sys-bar"><i style={{ width: `${r.index}%`, background: rr.color }} /></span>
                    <span className="st-sys-avg">{r.index}</span>
                    {isPro && (
                      <span className={`st-sys-trend${r.delta30 > 0 ? ' up' : r.delta30 < 0 ? ' down' : ''}`}>
                        {r.delta30 > 0 ? `▲ +${r.delta30}` : r.delta30 < 0 ? `▼ ${r.delta30}` : '='}
                      </span>
                    )}
                    <Link href={`/dashboard/focus?system=${r.system.id}`} className="st-act">Réviser →</Link>
                  </div>
                )
              })}
              {bySystem.length === 0 && (
                <div className="st-empty">Note quelques fiches pour voir l&apos;état de tes matières.</div>
              )}
            </div>
          </div>

          {/* PLAN JUSQU'AU CONCOURS (Premium) */}
          {!isPro && (
            <div className="stats-card st-plan-teaser">
              <div className="st-plan-teaser-kicker">Premium</div>
              <div className="st-plan-teaser-title">Ton plan jusqu&apos;au concours</div>
              <p className="st-plan-teaser-text">
                Fixe ta date de concours : vois ton <strong>rang projeté le jour J</strong> au
                rythme actuel, les matières qui montent ou décrochent, et ta régularité.
              </p>
              <Link href="/dashboard/pricing" className="st-cta-primary">Débloquer mon plan →</Link>
            </div>
          )}

          {isPro && (
            <div className="stats-card st-plan">
              <div className="stats-card-title">
                Le plan jusqu&apos;au concours
                <span className="stats-card-sub">trajectoire au rythme des 30 derniers jours</span>
              </div>
              <div className="st-plan-row">
                <label className="st-plan-date">
                  <span className="st-plan-date-lbl">Date du concours</span>
                  <input
                    type="date"
                    className="st-plan-date-input"
                    value={examDate}
                    min={today}
                    onChange={e => chooseExamDate(e.target.value)}
                  />
                </label>
                {daysToExam !== null && projected !== null ? (
                  <div className="st-plan-proj">
                    <div className="st-plan-days">J-{daysToExam}</div>
                    <div className="st-plan-proj-main">
                      Au rythme actuel : <strong style={{ color: rankFor(projected).color }}>{projected}/100</strong>{' '}
                      ({rankFor(projected).name}) le jour J
                      {projected >= TARGET_INDEX
                        ? ' — rang Maître en vue. Tiens le cap.'
                        : ` — vise ${Math.max(1, Math.ceil(((TARGET_INDEX - index) / Math.max(1, daysToExam)) * 7))} pts de plus par semaine pour viser Maître.`}
                    </div>
                  </div>
                ) : (
                  <div className="st-plan-proj st-empty">
                    Choisis ta date de concours pour voir ta trajectoire.
                  </div>
                )}
              </div>
              <div className="st-mini-heat">
                <div className="st-mini-heat-grid">
                  {heatmap.slice(40).map((week, wi) => (
                    <div key={wi} className="stats-heatmap-week">
                      {week.map((cell, di) => {
                        const cls = ['stats-heatmap-cell',
                          cell.inFuture ? 'future' : intensityClass(cell.count, heatmapMax),
                          cell.isToday ? 'today' : '',
                        ].filter(Boolean).join(' ')
                        return <div key={di} className={cls} title={`${cell.date} · ${cell.count} révision${cell.count > 1 ? 's' : ''}`} />
                      })}
                    </div>
                  ))}
                </div>
                <div className="st-mini-heat-lbl">Régularité · 12 dernières semaines</div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

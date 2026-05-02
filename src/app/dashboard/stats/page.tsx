'use client'
// src/app/dashboard/stats/page.tsx
//
// Cockpit annuel + insights coaching.
// 4 KPIs, heatmap année, évolution 12 semaines, maîtrise par palier J,
// classement matières, top fragiles, et insights dynamiques en bas.
//
// Toutes les stats utilisent effectiveStepScore (officiel sinon temp_score).
// Le modèle binaire ok/miss n'est plus utilisé.

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { System, Lesson } from '@/types'
import './styles.css'

const J = [0, 1, 3, 5, 7, 15, 21, 30, 45, 60, 75, 90, 105, 120]
const FRAGILE_THRESHOLD = 3

// ===================== TYPES =====================
type Score = 1 | 2 | 3 | 4 | 5
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

// ===================== AGRÉGATIONS =====================
type LessonAgg = {
  lesson: Lesson
  avg: number | null
  scoredCount: number
  officialCount: number
  isMastered: boolean
  isFragile: boolean
}

function computeLessonAgg(lesson: Lesson): LessonAgg {
  const steps = (lesson.steps as StepEntry[]) || []
  let sum = 0, n = 0, official = 0
  for (let i = 0; i < J.length; i++) {
    const eff = effectiveStepScore(steps[i])
    if (eff) { sum += eff; n++ }
    if (stepScore(steps[i])) official++
  }
  const avg = n > 0 ? sum / n : null
  return {
    lesson,
    avg,
    scoredCount: n,
    officialCount: official,
    isMastered: official >= 5 && avg !== null && avg >= 4,
    isFragile: n >= 3 && avg !== null && avg < FRAGILE_THRESHOLD,
  }
}

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

function buildWeeklyAvg(lessons: Lesson[], today: string, weeks: number): { weekStart: string; avg: number | null; count: number }[] {
  const out: { weekStart: string; avg: number | null; count: number }[] = []
  const todayD = new Date(today + 'T12:00:00')
  const dow = todayD.getDay()
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const thisMonday = new Date(todayD)
  thisMonday.setDate(todayD.getDate() + mondayOffset)

  for (let w = weeks - 1; w >= 0; w--) {
    const weekStart = new Date(thisMonday)
    weekStart.setDate(thisMonday.getDate() - w * 7)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    const weekStartStr = weekStart.toISOString().split('T')[0]
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    let sum = 0, n = 0
    for (const l of lessons) {
      const steps = (l.steps as StepEntry[]) || []
      for (const s of steps) {
        if (!s) continue
        const eff = effectiveStepScore(s)
        if (!eff) continue
        const d = stepPostedDate(s)
        if (!d) continue
        if (d >= weekStartStr && d <= weekEndStr) { sum += eff; n++ }
      }
    }
    out.push({ weekStart: weekStartStr, avg: n > 0 ? sum / n : null, count: n })
  }
  return out
}

function buildJStats(lessons: Lesson[]): { jLabel: string; avg: number | null; count: number }[] {
  const out: { jLabel: string; avg: number | null; count: number }[] = []
  for (let i = 0; i < J.length; i++) {
    let sum = 0, n = 0
    for (const l of lessons) {
      const steps = (l.steps as StepEntry[]) || []
      const sc = stepScore(steps[i])
      if (sc) { sum += sc; n++ }
    }
    out.push({ jLabel: i === 0 ? 'J+0' : `J+${J[i]}`, avg: n > 0 ? sum / n : null, count: n })
  }
  return out
}

type MatiereStat = {
  system: System
  totalFiches: number
  scoredFiches: number
  avg: number | null
  fragileCount: number
  masteredCount: number
}

function computeMatiereStats(systems: System[], lessons: Lesson[]): MatiereStat[] {
  const out: MatiereStat[] = []
  for (const sys of systems) {
    const sysLessons = lessons.filter(l => l.system_id === sys.id)
    let sum = 0, n = 0, fragile = 0, mastered = 0
    for (const l of sysLessons) {
      const a = computeLessonAgg(l)
      if (a.avg !== null) { sum += a.avg; n++ }
      if (a.isFragile) fragile++
      if (a.isMastered) mastered++
    }
    out.push({
      system: sys,
      totalFiches: sysLessons.length,
      scoredFiches: n,
      avg: n > 0 ? sum / n : null,
      fragileCount: fragile,
      masteredCount: mastered,
    })
  }
  return out.filter(m => m.scoredFiches > 0).sort((a, b) => (a.avg ?? 999) - (b.avg ?? 999))
}

// ===================== HEATMAP =====================
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

// ===================== INSIGHTS =====================
type Insight = { kind: 'positive' | 'neutral' | 'warning'; text: string }

function generateInsights(
  matiereStats: MatiereStat[],
  weeklyAvg: { weekStart: string; avg: number | null; count: number }[]
): Insight[] {
  const out: Insight[] = []
  if (weeklyAvg.length < 2) return out

  const last = weeklyAvg[weeklyAvg.length - 1]
  const prev = weeklyAvg[weeklyAvg.length - 2]
  if (last.avg !== null && prev.avg !== null) {
    const delta = last.avg - prev.avg
    if (Math.abs(delta) >= 0.2) {
      const sign = delta > 0 ? '+' : ''
      out.push({
        kind: delta > 0 ? 'positive' : 'warning',
        text: `Ta moyenne est passée de ${prev.avg.toFixed(1)} à ${last.avg.toFixed(1)} cette semaine (${sign}${delta.toFixed(1)}).`,
      })
    }
  }

  if (last.count > 0 || prev.count > 0) {
    const delta = last.count - prev.count
    const pct = prev.count > 0 ? Math.round((delta / prev.count) * 100) : 100
    if (Math.abs(delta) >= 3) {
      out.push({
        kind: delta > 0 ? 'positive' : 'neutral',
        text: `${last.count} révisions cette semaine (${delta > 0 ? '+' : ''}${pct}% vs sem. précédente).`,
      })
    }
  }

  const weakest = matiereStats[0]
  if (weakest && weakest.avg !== null && weakest.avg < FRAGILE_THRESHOLD + 0.5) {
    out.push({
      kind: 'warning',
      text: `${weakest.system.name} reste ton point faible (avg ${weakest.avg.toFixed(1)}/5${weakest.fragileCount > 0 ? ` · ${weakest.fragileCount} fiche${weakest.fragileCount > 1 ? 's' : ''} fragile${weakest.fragileCount > 1 ? 's' : ''}` : ''}).`,
    })
  }

  const strongest = matiereStats[matiereStats.length - 1]
  if (strongest && weakest && strongest !== weakest && strongest.avg !== null && strongest.avg >= 4) {
    out.push({
      kind: 'positive',
      text: `${strongest.system.name} est ta matière la plus solide (avg ${strongest.avg.toFixed(1)}/5).`,
    })
  }

  const recentRate = weeklyAvg.slice(-4).reduce((s, w) => s + w.count, 0) / 4
  if (recentRate >= 1) {
    const projected8w = Math.round(recentRate * 8)
    out.push({
      kind: 'neutral',
      text: `À ton rythme actuel (${recentRate.toFixed(1)} révisions/sem.), tu en feras ~${projected8w} dans les 8 semaines à venir.`,
    })
  }

  if (last.count === 0 && prev.count > 0) {
    out.push({
      kind: 'warning',
      text: `Aucune révision cette semaine — reprends le rythme avant de perdre tes acquis.`,
    })
  }

  return out
}

function scoreClass(avg: number | null): string {
  if (avg === null) return 's3'
  if (avg < 2) return 's1'
  if (avg < 3) return 's2'
  if (avg < 3.7) return 's3'
  if (avg < 4.5) return 's4'
  return 's5'
}

function fmtMonth(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')
}

// ===================== PAGE =====================
export default function StatsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [systems, setSystems] = useState<System[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [semestre, setSemestre] = useState<1 | 2>(2)

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem('medrev-sem')
    setSemestre(raw === '1' ? 1 : 2)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const [{ data: sys }, { data: les }] = await Promise.all([
        supabase.from('systems').select('*').eq('user_id', user.id).order('semestre').order('created_at'),
        supabase.from('lessons').select('*').eq('user_id', user.id).order('created_at'),
      ])
      if (cancelled) return
      setSystems((sys as System[] | null) ?? [])
      setLessons((les as Lesson[] | null) ?? [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [supabase, router])

  const semSystems = useMemo(() => systems.filter(s => s.semestre === semestre), [systems, semestre])
  const semSystemIds = useMemo(() => new Set(semSystems.map(s => s.id)), [semSystems])
  const semLessons = useMemo(() => lessons.filter(l => semSystemIds.has(l.system_id)), [lessons, semSystemIds])

  const aggs = useMemo(() => semLessons.map(computeLessonAgg), [semLessons])
  const activityIndex = useMemo(() => buildActivityIndex(semLessons), [semLessons])
  const weeklyAvg = useMemo(() => buildWeeklyAvg(semLessons, today, 12), [semLessons, today])
  const jStats = useMemo(() => buildJStats(semLessons), [semLessons])
  const matiereStats = useMemo(() => computeMatiereStats(semSystems, semLessons), [semSystems, semLessons])
  const heatmap = useMemo(() => buildYearHeatmap(activityIndex, today), [activityIndex, today])
  const insights = useMemo(() => generateInsights(matiereStats, weeklyAvg), [matiereStats, weeklyAvg])

  const totalFiches = semLessons.length
  const scoredFiches = aggs.filter(a => a.avg !== null).length
  const masteredCount = aggs.filter(a => a.isMastered).length
  const fragileCount = aggs.filter(a => a.isFragile).length

  const globalAvg = useMemo(() => {
    const valid = aggs.filter(a => a.avg !== null)
    if (valid.length === 0) return null
    return valid.reduce((s, a) => s + (a.avg ?? 0), 0) / valid.length
  }, [aggs])

  const last7Count = weeklyAvg[weeklyAvg.length - 1]?.count ?? 0
  const prev7Count = weeklyAvg[weeklyAvg.length - 2]?.count ?? 0
  const week7Delta = last7Count - prev7Count

  const totalActivity = useMemo(() => {
    let sum = 0
    activityIndex.forEach(v => { sum += v })
    return sum
  }, [activityIndex])

  const recent4wRate = weeklyAvg.slice(-4).reduce((s, w) => s + w.count, 0) / 4
  const projection8w = Math.round(recent4wRate * 8)

  const heatmapMax = useMemo(() => {
    let max = 1
    activityIndex.forEach(v => { if (v > max) max = v })
    return max
  }, [activityIndex])

  if (loading) {
    return (
      <div className="stats-page">
        <div className="stats-loading">Chargement…</div>
      </div>
    )
  }

  const topFragiles = aggs
    .filter(a => a.avg !== null && a.scoredCount >= 2)
    .sort((a, b) => (a.avg ?? 999) - (b.avg ?? 999))
    .slice(0, 5)

  const monthLabels: { weekIdx: number; label: string }[] = []
  let lastMonth = ''
  heatmap.forEach((week, idx) => {
    const m = fmtMonth(week[0].date)
    if (m !== lastMonth) {
      monthLabels.push({ weekIdx: idx, label: m })
      lastMonth = m
    }
  })

  return (
    <div className="stats-page">

      <div className="stats-header">
        <div>
          <h1 className="stats-title">Statistiques</h1>
          <div className="stats-sub">Cockpit annuel · {totalFiches} fiches · {totalActivity} révisions cumulées</div>
        </div>
        <div className="stats-sem-toggle">
          <button className={semestre === 1 ? 'active' : ''} onClick={() => setSemestre(1)}>S1</button>
          <button className={semestre === 2 ? 'active' : ''} onClick={() => setSemestre(2)}>S2</button>
        </div>
      </div>

      <div className="stats-kpis">
        <div className="stats-kpi">
          <div className="stats-kpi-label">Maîtrise globale</div>
          <div className="stats-kpi-row">
            <span className={`stats-kpi-val ${scoreClass(globalAvg)}`}>{globalAvg !== null ? globalAvg.toFixed(1) : '—'}</span>
            <span className="stats-kpi-unit">/5</span>
          </div>
          <div className="stats-kpi-sub">{scoredFiches} fiches notées · {masteredCount} maîtrisée{masteredCount > 1 ? 's' : ''}</div>
        </div>
        <div className="stats-kpi">
          <div className="stats-kpi-label">Cette semaine</div>
          <div className="stats-kpi-row">
            <span className="stats-kpi-val">{last7Count}</span>
            <span className="stats-kpi-unit">révisions</span>
          </div>
          <div className={`stats-kpi-sub ${week7Delta > 0 ? 'pos' : week7Delta < 0 ? 'neg' : ''}`}>
            {prev7Count === 0 && last7Count === 0 ? 'Aucune activité' : `${week7Delta > 0 ? '+' : ''}${week7Delta} vs sem. précédente`}
          </div>
        </div>
        <div className="stats-kpi">
          <div className="stats-kpi-label">Fiches fragiles</div>
          <div className="stats-kpi-row">
            <span className={`stats-kpi-val ${fragileCount > 0 ? 's2' : 's4'}`}>{fragileCount}</span>
            <span className="stats-kpi-unit">à retravailler</span>
          </div>
          <div className="stats-kpi-sub">{fragileCount === 0 ? 'Aucune fragile · tu gères' : `avg < ${FRAGILE_THRESHOLD}`}</div>
        </div>
        <div className="stats-kpi">
          <div className="stats-kpi-label">Projection 8 sem.</div>
          <div className="stats-kpi-row">
            <span className="stats-kpi-val">{projection8w}</span>
            <span className="stats-kpi-unit">révisions</span>
          </div>
          <div className="stats-kpi-sub">à ton rythme actuel ({recent4wRate.toFixed(1)}/sem.)</div>
        </div>
      </div>

      <div className="stats-card">
        <div className="stats-card-title">Activité de l&apos;année <span className="stats-card-sub">52 dernières semaines</span></div>
        <div className="stats-heatmap-wrap">
          <div className="stats-heatmap-months">
            {monthLabels.map((m, idx) => (
              <span key={idx} className="stats-heatmap-month" style={{ left: `${(m.weekIdx / 52) * 100}%` }}>{m.label}</span>
            ))}
          </div>
          <div className="stats-heatmap">
            <div className="stats-heatmap-axis">
              <span>L</span><span></span><span>M</span><span></span><span>V</span><span></span><span>D</span>
            </div>
            <div className="stats-heatmap-grid">
              {heatmap.map((week, wi) => (
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
          </div>
          <div className="stats-heatmap-legend">
            <span>Moins</span>
            <span className="stats-heatmap-cell i0" />
            <span className="stats-heatmap-cell i1" />
            <span className="stats-heatmap-cell i2" />
            <span className="stats-heatmap-cell i3" />
            <span className="stats-heatmap-cell i4" />
            <span>Plus</span>
          </div>
        </div>
      </div>

      <div className="stats-row stats-row-2">
        <div className="stats-card">
          <div className="stats-card-title">Maîtrise par palier J <span className="stats-card-sub">officiel uniquement</span></div>
          <div className="stats-jbar">
            {jStats.map((j, i) => {
              const pct = j.avg !== null ? (j.avg / 5) * 100 : 0
              const cls = scoreClass(j.avg)
              return (
                <div key={i} className="stats-jbar-col">
                  <div className="stats-jbar-track">
                    <div className={`stats-jbar-fill ${cls}`} style={{ height: `${pct}%` }} title={j.avg !== null ? `${j.avg.toFixed(1)}/5 · ${j.count} note${j.count > 1 ? 's' : ''}` : 'aucune note'} />
                  </div>
                  <div className="stats-jbar-val">{j.avg !== null ? j.avg.toFixed(1) : '—'}</div>
                  <div className="stats-jbar-lbl">{j.jLabel}</div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-card-title">Évolution moyenne <span className="stats-card-sub">12 dernières semaines</span></div>
          <Sparkline data={weeklyAvg} />
        </div>
      </div>

      <div className="stats-row stats-row-2">
        <div className="stats-card">
          <div className="stats-card-title">Maîtrise par matière</div>
          {matiereStats.length === 0 ? (
            <div className="stats-empty">Pas encore de matière notée pour ce semestre.</div>
          ) : (
            <div className="stats-mat-list">
              {matiereStats.map(m => {
                const pct = m.avg !== null ? (m.avg / 5) * 100 : 0
                const cls = scoreClass(m.avg)
                return (
                  <div key={m.system.id} className="stats-mat">
                    <div className="stats-mat-name">{m.system.name}</div>
                    <div className="stats-mat-bar">
                      <div className={`stats-mat-fill ${cls}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className={`stats-mat-val ${cls}`}>{m.avg !== null ? m.avg.toFixed(1) : '—'}</div>
                    <div className="stats-mat-counts">
                      {m.scoredFiches}/{m.totalFiches} f.
                      {m.fragileCount > 0 && <span className="stats-mat-fragile"> · {m.fragileCount} fragile{m.fragileCount > 1 ? 's' : ''}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="stats-card">
          <div className="stats-card-title">Top fragiles <span className="stats-card-sub">{topFragiles.length > 0 ? '5 plus faibles' : ''}</span></div>
          {topFragiles.length === 0 ? (
            <div className="stats-empty">Aucune fiche notée 2+ fois.</div>
          ) : (
            <div className="stats-frag-list">
              {topFragiles.map(a => {
                const sys = systems.find(s => s.id === a.lesson.system_id)
                const cls = scoreClass(a.avg)
                return (
                  <Link key={a.lesson.id} href={`/dashboard/focus?lessons=${a.lesson.id}`} className="stats-frag">
                    <div className="stats-frag-info">
                      <div className="stats-frag-name">{a.lesson.name}</div>
                      <div className="stats-frag-sys">{sys?.name ?? '—'} · {a.scoredCount} révision{a.scoredCount > 1 ? 's' : ''}</div>
                    </div>
                    <div className={`stats-frag-chip ${cls}`}>{a.avg !== null ? a.avg.toFixed(1) : '—'}</div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {insights.length > 0 && (
        <div className="stats-card">
          <div className="stats-card-title">Insights</div>
          <ul className="stats-insights">
            {insights.map((ins, i) => (
              <li key={i} className={`stats-insight ${ins.kind}`}>{ins.text}</li>
            ))}
          </ul>
        </div>
      )}

    </div>
  )
}

// ===================== SPARKLINE =====================
function Sparkline({ data }: { data: { weekStart: string; avg: number | null; count: number }[] }) {
  const w = 320
  const h = 120
  const pad = 16
  const validIndices = data.map((d, i) => d.avg !== null ? i : -1).filter(i => i >= 0)
  if (validIndices.length < 2) {
    return <div className="stats-empty">Pas assez de données pour tracer une tendance.</div>
  }

  const xs = data.map((_, i) => pad + (i / Math.max(1, data.length - 1)) * (w - 2 * pad))
  const ys = data.map(d => d.avg === null ? null : h - pad - ((d.avg - 1) / 4) * (h - 2 * pad))

  // Construit un path linéaire en sautant les null
  const segments: string[] = []
  let current: string[] = []
  for (let i = 0; i < ys.length; i++) {
    if (ys[i] === null) {
      if (current.length > 0) { segments.push(current.join(' ')); current = [] }
    } else {
      current.push(`${current.length === 0 ? 'M' : 'L'} ${xs[i].toFixed(1)} ${(ys[i] as number).toFixed(1)}`)
    }
  }
  if (current.length > 0) segments.push(current.join(' '))

  return (
    <div className="stats-sparkline-wrap">
      <svg viewBox={`0 0 ${w} ${h}`} className="stats-sparkline">
        {[1, 2, 3, 4, 5].map(v => {
          const y = h - pad - ((v - 1) / 4) * (h - 2 * pad)
          return (
            <g key={v}>
              <line x1={pad} y1={y} x2={w - pad} y2={y} stroke="#E5E2DA" strokeWidth={0.5} strokeDasharray="2 3" />
              <text x={pad - 4} y={y + 3} textAnchor="end" fontSize={9} fill="#9CA09A">{v}</text>
            </g>
          )
        })}
        {segments.map((seg, i) => (
          <path key={i} d={seg} fill="none" stroke="#1B4332" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {data.map((d, i) => d.avg === null ? null : (
          <circle key={i} cx={xs[i]} cy={ys[i] as number} r={3} fill="#1B4332" stroke="white" strokeWidth={1.5}>
            <title>{d.weekStart} · {d.avg.toFixed(1)}/5 · {d.count} révision{d.count > 1 ? 's' : ''}</title>
          </circle>
        ))}
      </svg>
      <div className="stats-sparkline-meta">
        <span>S-12</span>
        <span>aujourd&apos;hui</span>
      </div>
    </div>
  )
}

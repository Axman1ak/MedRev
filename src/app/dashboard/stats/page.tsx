'use client'
// src/app/dashboard/stats/page.tsx
//
// Bilan annuel — page rétrospective.
// Hero "847 révisions" + 3 secondaires (jours actifs / série / maîtrisées),
// puis heatmap année, évolution 12 sem, palier J, dumbbell.
//
// Le filtre semestre est piloté par la sidebar globale (Sem 1 / Sem 2 / Année)
// via localStorage 'medrev-sem' et l'event 'medrev-sem-change'. Pas de toggle
// local — la duplication a été supprimée.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { System, Lesson } from '@/types'
import './styles.css'

const J = [0, 1, 3, 5, 7, 15, 21, 30, 45, 60, 75, 90, 105, 120]

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

// ===================== AGRÉGATIONS LESSON =====================
type LessonAgg = {
  lesson: Lesson
  avg: number | null
  scoredCount: number
  officialCount: number
  isMastered: boolean
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
  }
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

function totalRevisions(activityIndex: Map<string, number>): number {
  let n = 0
  activityIndex.forEach(v => { n += v })
  return n
}

function activeDaysCount(activityIndex: Map<string, number>): number {
  return activityIndex.size
}

type Streak = { length: number; start: string | null; end: string | null }

function computeLongestStreak(activityIndex: Map<string, number>): Streak {
  if (activityIndex.size === 0) return { length: 0, start: null, end: null }
  const dates = Array.from(activityIndex.keys()).sort()
  let maxLen = 1, maxStart = dates[0], maxEnd = dates[0]
  let curLen = 1, curStart = dates[0]
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + 'T12:00:00')
    const curr = new Date(dates[i] + 'T12:00:00')
    const diff = Math.round((curr.getTime() - prev.getTime()) / 86400000)
    if (diff === 1) {
      curLen++
      if (curLen > maxLen) { maxLen = curLen; maxStart = curStart; maxEnd = dates[i] }
    } else {
      curLen = 1
      curStart = dates[i]
    }
  }
  return { length: maxLen, start: maxStart, end: maxEnd }
}

function firstActivityDate(activityIndex: Map<string, number>): string | null {
  if (activityIndex.size === 0) return null
  return Array.from(activityIndex.keys()).sort()[0]
}

// ===================== ÉVOLUTION =====================
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

// ===================== COMPARAISON 1 MOIS → MAINTENANT =====================
type MatiereComparison = {
  system: System
  avgThen: number | null
  avgNow: number | null
  delta: number | null
}

function computeMatiereComparison(systems: System[], lessons: Lesson[], today: string): MatiereComparison[] {
  const todayD = new Date(today + 'T12:00:00')
  const monthAgo = new Date(todayD)
  monthAgo.setDate(todayD.getDate() - 30)
  const monthAgoStr = monthAgo.toISOString().split('T')[0]

  const out: MatiereComparison[] = []

  for (const sys of systems) {
    const sysLessons = lessons.filter(l => l.system_id === sys.id)
    let sumThen = 0, nThen = 0
    let sumNow = 0, nNow = 0

    for (const l of sysLessons) {
      const steps = (l.steps as StepEntry[]) || []
      let lThenSum = 0, lThenN = 0
      let lNowSum = 0, lNowN = 0
      for (const s of steps) {
        const eff = effectiveStepScore(s)
        if (!eff) continue
        const d = stepPostedDate(s)
        if (!d) continue
        lNowSum += eff; lNowN++
        if (d <= monthAgoStr) { lThenSum += eff; lThenN++ }
      }
      if (lNowN > 0) { sumNow += lNowSum / lNowN; nNow++ }
      if (lThenN > 0) { sumThen += lThenSum / lThenN; nThen++ }
    }

    const avgNow = nNow > 0 ? sumNow / nNow : null
    const avgThen = nThen > 0 ? sumThen / nThen : null
    const delta = avgNow !== null && avgThen !== null ? avgNow - avgThen : null
    out.push({ system: sys, avgThen, avgNow, delta })
  }

  return out
    .filter(m => m.avgNow !== null)
    .sort((a, b) => {
      if (a.delta === null && b.delta === null) return (b.avgNow ?? 0) - (a.avgNow ?? 0)
      if (a.delta === null) return 1
      if (b.delta === null) return -1
      return (b.delta ?? 0) - (a.delta ?? 0)
    })
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

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', '')
}

function semLabel(s: Semestre): string {
  if (s === 'year') return 'Année complète'
  return `Semestre ${s}`
}

// ===================== PAGE =====================
export default function StatsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [systems, setSystems] = useState<System[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [semestre, setSemestre] = useState<Semestre>(2)
  // Plan user — fetché en parallèle des données. Détermine si on affiche les
  // visualisations avancées (heatmap, sparkline, j-bar, dumbbell) ou le teaser
  // Premium qui les remplace pour les comptes Gratuit.
  const [isPro, setIsPro] = useState(false)

  const today = useMemo(() => new Date().toISOString().split('T')[0], [])

  // Load initial semester from localStorage + listen to sidebar event
  useEffect(() => {
    if (typeof window === 'undefined') return
    const raw = localStorage.getItem('medrev-sem')
    const s: Semestre = raw === '1' ? 1 : raw === 'year' ? 'year' : 2
    setSemestre(s)

    function onSemChange(e: Event) {
      const ce = e as CustomEvent<Semestre>
      if (ce.detail === 1 || ce.detail === 2 || ce.detail === 'year') {
        setSemestre(ce.detail)
      }
    }
    window.addEventListener('medrev-sem-change', onSemChange)
    return () => window.removeEventListener('medrev-sem-change', onSemChange)
  }, [])

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

  // En mode 'year' on prend tous les systèmes ; sinon on filtre par semestre.
  const semSystems = useMemo(() => {
    if (semestre === 'year') return systems
    return systems.filter(s => s.semestre === semestre)
  }, [systems, semestre])
  const semSystemIds = useMemo(() => new Set(semSystems.map(s => s.id)), [semSystems])
  const semLessons = useMemo(() => lessons.filter(l => semSystemIds.has(l.system_id)), [lessons, semSystemIds])

  const aggs = useMemo(() => semLessons.map(computeLessonAgg), [semLessons])
  const activityIndex = useMemo(() => buildActivityIndex(semLessons), [semLessons])
  const weeklyAvg = useMemo(() => buildWeeklyAvg(semLessons, today, 12), [semLessons, today])
  const jStats = useMemo(() => buildJStats(semLessons), [semLessons])
  const heatmap = useMemo(() => buildYearHeatmap(activityIndex, today), [activityIndex, today])
  const comparison = useMemo(() => computeMatiereComparison(semSystems, semLessons, today), [semSystems, semLessons, today])

  const heatmapMax = useMemo(() => {
    let max = 1
    activityIndex.forEach(v => { if (v > max) max = v })
    return max
  }, [activityIndex])

  const totalRevs = useMemo(() => totalRevisions(activityIndex), [activityIndex])
  const activeDays = useMemo(() => activeDaysCount(activityIndex), [activityIndex])
  const longestStreak = useMemo(() => computeLongestStreak(activityIndex), [activityIndex])
  const firstDay = useMemo(() => firstActivityDate(activityIndex), [activityIndex])
  const masteredCount = aggs.filter(a => a.isMastered).length
  const totalFiches = semLessons.length

  const daySpan = useMemo(() => {
    if (!firstDay) return 0
    const t = new Date(today + 'T12:00:00')
    const f = new Date(firstDay + 'T12:00:00')
    return Math.max(1, Math.round((t.getTime() - f.getTime()) / 86400000) + 1)
  }, [firstDay, today])

  const revsPerDay = activeDays > 0 ? totalRevs / activeDays : 0
  const activePct = daySpan > 0 ? Math.round((activeDays / daySpan) * 100) : 0

  if (loading) {
    return (
      <div className="stats-page">
        <div className="stats-loading">Chargement…</div>
      </div>
    )
  }

  // Empty state global : aucune révision notée du tout. On évite d'afficher
  // une heatmap, sparkline et dumbbell tous vides — qui donneraient l'impression
  // que l'app ne marche pas. On pousse plutôt l'action concrète (créer une
  // fiche puis la noter au jour J).
  if (totalRevs === 0) {
    return (
      <div className="stats-page">
        <div className="stats-empty-global">
          <div className="stats-empty-global-icon" aria-hidden>◈</div>
          <h1 className="stats-empty-global-title">
            Tes statistiques se construisent au fil des révisions
          </h1>
          <p className="stats-empty-global-text">
            Note ta première fiche au jour J pour activer ta heatmap, ton
            sparkline 12 semaines et tes dumbbells par matière. Les stats
            n&apos;ont de sens qu&apos;une fois que tu as 5-10 fiches notées,
            avant ça, elles sont vides.
          </p>
          <Link href="/dashboard/fiches" className="stats-empty-global-btn">
            Aller à mes cours →
          </Link>
        </div>
      </div>
    )
  }

  // mois pour la heatmap
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
          <h1 className="stats-title">
            Mon <em>année</em> en révisions
          </h1>
          <div className="stats-sub">
            {activeDays} jour{activeDays > 1 ? 's' : ''} actif{activeDays > 1 ? 's' : ''}
            {longestStreak.length >= 2 ? ` · plus longue série : ${longestStreak.length} jours` : ''}
            {' · '}{masteredCount} fiche{masteredCount > 1 ? 's' : ''} maîtrisée{masteredCount > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* HERO + 3 SECONDAIRES */}
      <div className="stats-totals-grid">
        <div className="stats-hero-card">
          <div className="stats-hero-label">
            Révisions cumulées · {semLabel(semestre)}
          </div>
          <div className="stats-hero-display">
            <span className="stats-hero-num">{totalRevs}</span>
            <span className="stats-hero-unit">
              révision{totalRevs > 1 ? 's' : ''}<br />
              {firstDay ? <em>depuis le {fmtDate(firstDay)}</em> : <em>aucune révision</em>}
            </span>
          </div>
          <div className="stats-hero-sub">
            {activeDays > 0 ? (
              <>Soit <strong>{revsPerDay.toFixed(1)} révisions/jour</strong> en moyenne sur tes {activeDays} jour{activeDays > 1 ? 's' : ''} actif{activeDays > 1 ? 's' : ''}{daySpan > 0 ? ` (${activePct}% des ${daySpan} jours écoulés)` : ''}.</>
            ) : (
              <>Pas encore de révisions enregistrées sur cette période.</>
            )}
          </div>
        </div>

        <div className="stats-secondary">
          <div className="stats-sec">
            <div className="stats-sec-num">{activeDays}</div>
            <div className="stats-sec-info">
              <div className="stats-sec-label">Jours actifs</div>
              <div className="stats-sec-sub">
                {daySpan > 0 ? `sur ${daySpan} jours · ${activePct}% de présence` : '·'}
              </div>
            </div>
          </div>
          <div className="stats-sec">
            <div className="stats-sec-num">{longestStreak.length}</div>
            <div className="stats-sec-info">
              <div className="stats-sec-label">Plus longue série</div>
              <div className="stats-sec-sub">
                {longestStreak.length >= 2 && longestStreak.start && longestStreak.end
                  ? `jours · ${fmtDate(longestStreak.start)} → ${fmtDate(longestStreak.end)}`
                  : 'jour'}
              </div>
            </div>
          </div>
          <div className="stats-sec">
            <div className="stats-sec-num">{masteredCount}</div>
            <div className="stats-sec-info">
              <div className="stats-sec-label">Fiches maîtrisées</div>
              <div className="stats-sec-sub">
                sur {totalFiches} · avg ≥ 4 sur 5+ J
              </div>
            </div>
          </div>
        </div>
      </div>

{/* === STATS AVANCÉES (Premium uniquement) === */}
      {!isPro && <PremiumStatsTeaser />}

      {isPro && <>
      {/* HEATMAP */}
      <div className="stats-card">
        <div className="stats-card-title">
          Activité de l&apos;année
          <span className="stats-card-sub">52 dernières semaines · plus la case est verte, plus tu as révisé</span>
        </div>
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
          <div className="stats-card-title">
            Évolution de ta moyenne
            <span className="stats-card-sub">12 dernières semaines</span>
          </div>
          <Sparkline data={weeklyAvg} />
        </div>

        <div className="stats-card">
          <div className="stats-card-title">
            Maîtrise par palier J
            <span className="stats-card-sub">officiel uniquement</span>
          </div>
          <div className="stats-jbar">
            {jStats.map((j, i) => {
              const pct = j.avg !== null ? (j.avg / 5) * 100 : 0
              const cls = scoreClass(j.avg)
              return (
                <div key={i} className="stats-jbar-col">
                  <div className="stats-jbar-track">
                    <div className={`stats-jbar-fill ${cls}`} style={{ height: `${pct}%` }} title={j.avg !== null ? `${j.avg.toFixed(1)}/5 · ${j.count} note${j.count > 1 ? 's' : ''}` : 'aucune note'} />
                  </div>
                  <div className="stats-jbar-val">{j.avg !== null ? j.avg.toFixed(1) : '·'}</div>
                  <div className="stats-jbar-lbl">{j.jLabel}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="stats-card">
        <div className="stats-card-title">
          Comparaison · il y a 1 mois → aujourd&apos;hui
          <span className="stats-card-sub">par matière · point gris = il y a 1 mois, point coloré = maintenant</span>
        </div>
        <DumbbellChart rows={comparison} />
      </div>
      </>}

    </div>
  )
}

// ===================== PREMIUM TEASER =====================
// Remplace les 4 visualisations avancées (heatmap, sparkline, j-bar, dumbbell)
// pour les comptes Gratuit. Présente ce qu'ils débloqueraient en Premium et
// renvoie sur la page Pricing.
function PremiumStatsTeaser() {
  return (
    <div className="stats-premium-teaser">
      <div className="stats-premium-teaser-kicker">Stats avancées · Premium</div>
      <h2 className="stats-premium-teaser-title">
        Vois <em>ton année</em> en un coup d&apos;œil
      </h2>
      <p className="stats-premium-teaser-sub">
        Quatre visualisations qui révèlent tes habitudes, tes progrès et
        tes points faibles.
      </p>

      <div className="stats-premium-teaser-grid">
        <div className="stats-premium-teaser-item">
          <div className="stats-premium-teaser-item-icon">▦</div>
          <div className="stats-premium-teaser-item-name">Heatmap année</div>
          <div className="stats-premium-teaser-item-desc">52 semaines d&apos;activité, jour par jour</div>
        </div>
        <div className="stats-premium-teaser-item">
          <div className="stats-premium-teaser-item-icon">∿</div>
          <div className="stats-premium-teaser-item-name">Sparkline 12 sem</div>
          <div className="stats-premium-teaser-item-desc">Évolution de ta moyenne semaine après semaine</div>
        </div>
        <div className="stats-premium-teaser-item">
          <div className="stats-premium-teaser-item-icon">▮▮▮</div>
          <div className="stats-premium-teaser-item-name">Maîtrise par palier J</div>
          <div className="stats-premium-teaser-item-desc">Vois où tu lâches sur la courbe d&apos;oubli</div>
        </div>
        <div className="stats-premium-teaser-item">
          <div className="stats-premium-teaser-item-icon">●─●</div>
          <div className="stats-premium-teaser-item-name">Comparaison 1 mois</div>
          <div className="stats-premium-teaser-item-desc">Quelles matières remontent, lesquelles décrochent</div>
        </div>
      </div>

      <Link href="/dashboard/pricing" className="stats-premium-teaser-cta">
        Débloquer ces stats avec Premium →
      </Link>
    </div>
  )
}

// ===================== DUMBBELL =====================
function DumbbellChart({ rows }: { rows: MatiereComparison[] }) {
  if (rows.length === 0) {
    return <div className="stats-empty">Pas encore assez de données pour comparer.</div>
  }

  return (
    <div className="stats-dumb">
      {rows.map(r => {
        if (r.avgNow === null) return null
        const nowPct = ((r.avgNow - 1) / 4) * 100
        const thenPct = r.avgThen !== null ? ((r.avgThen - 1) / 4) * 100 : null
        const delta = r.delta
        let trendCls: 'up' | 'down' | 'flat' = 'flat'
        if (delta !== null) {
          if (delta >= 0.15) trendCls = 'up'
          else if (delta <= -0.15) trendCls = 'down'
        }
        const lineLeft = thenPct !== null ? Math.min(thenPct, nowPct) : nowPct
        const lineWidth = thenPct !== null ? Math.abs(nowPct - thenPct) : 0
        const deltaLabel = delta !== null
          ? (delta > 0 ? `+${delta.toFixed(1)}` : delta < 0 ? delta.toFixed(1).replace('-', '−') : '0.0')
          : 'nouveau'

        return (
          <div key={r.system.id} className="stats-dumb-row">
            <div className="stats-dumb-name">{r.system.name}</div>
            <div className="stats-dumb-track">
              <div className="stats-dumb-axis" />
              <div className="stats-dumb-grid" style={{ left: '0%' }} />
              <div className="stats-dumb-grid" style={{ left: '25%' }} />
              <div className="stats-dumb-grid" style={{ left: '50%' }} />
              <div className="stats-dumb-grid" style={{ left: '75%' }} />
              <div className="stats-dumb-grid" style={{ left: '100%' }} />
              {thenPct !== null && lineWidth > 0 && (
                <div className={`stats-dumb-line ${trendCls}`} style={{ left: `${lineLeft}%`, width: `${lineWidth}%` }} />
              )}
              {thenPct !== null && (
                <div
                  className="stats-dumb-dot then"
                  style={{ left: `${thenPct}%` }}
                  title={`il y a 1 mois : ${r.avgThen!.toFixed(1)}/5`}
                />
              )}
              <div
                className={`stats-dumb-dot now ${trendCls}`}
                style={{ left: `${nowPct}%` }}
                title={`aujourd'hui : ${r.avgNow.toFixed(1)}/5`}
              />
            </div>
            <div className={`stats-dumb-delta ${trendCls}`}>{deltaLabel}</div>
          </div>
        )
      })}
      <div className="stats-dumb-scale">
        <div />
        <div className="stats-dumb-ticks">
          <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
        </div>
        <div />
      </div>
    </div>
  )
}

// ===================== SPARKLINE =====================
function Sparkline({ data }: { data: { weekStart: string; avg: number | null; count: number }[] }) {
  const w = 320
  const h = 160
  const pad = 18
  const validIndices = data.map((d, i) => d.avg !== null ? i : -1).filter(i => i >= 0)
  if (validIndices.length < 2) {
    return <div className="stats-empty">Pas assez de données pour tracer une tendance.</div>
  }

  const xs = data.map((_, i) => pad + (i / Math.max(1, data.length - 1)) * (w - 2 * pad))
  const ys = data.map(d => d.avg === null ? null : h - pad - ((d.avg - 1) / 4) * (h - 2 * pad))

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

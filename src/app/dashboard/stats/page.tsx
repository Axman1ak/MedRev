'use client'
// src/app/dashboard/stats/page.tsx
//
// Refonte 2026-06 "Indice de préparation" — la page répond à UNE question :
// « Suis-je prêt ? ». Quatre blocs, du plus global au plus actionnable :
//   1. LA JAUGE — indice de préparation 0-100 (maîtrise 50% + couverture 30%
//      + régularité 20%) avec son évolution sur 7 jours.
//   2. PAR MATIÈRE — le même indice décliné par matière (barres colorées).
//   3. QUOI RÉVISER MAINTENANT — 3 fiches concrètes + CTA Focus.
//   4. PREMIUM : LE PLAN JUSQU'AU CONCOURS — date du concours, trajectoire
//      au rythme actuel, évolution par matière sur 30 j, régularité annuelle.
//
// Le filtre semestre est piloté par la sidebar globale (localStorage
// 'medrev-sem' + event 'medrev-sem-change').

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { System, Lesson } from '@/types'
import './styles.css'

const J = [0, 1, 3, 5, 7, 15, 21, 30, 45, 60, 75, 90, 105, 120]

// Objectif affiché : la "zone verte" de l'indice.
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

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// ===================== INDICE DE PRÉPARATION =====================
// 0-100 = 50% maîtrise (moyenne des fiches notées, /5) + 30% couverture
// (fiches avec ≥3 paliers officiels) + 20% régularité (jours actifs sur les
// 14 derniers, cible 10). `asOf` permet de calculer l'indice "tel qu'il
// était" à une date passée (pour les deltas 7 j / 30 j) en ignorant les
// scores postés après.
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
  const regularity = Math.min(1, active14 / 10)
  return Math.round(100 * (0.5 * mastery + 0.3 * coverage + 0.2 * regularity))
}

// Sous-composantes pour les 3 mini-barres du héros (à la date du jour).
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
    regularity: Math.min(1, active14 / 10),
  }
}

// Zone de l'indice → couleur + libellé.
function indexZone(v: number): { color: string; label: string } {
  if (v < 40) return { color: '#C75050', label: 'fragile' }
  if (v < 60) return { color: '#E08B3C', label: 'en route' }
  if (v < 75) return { color: '#D9B24A', label: 'solide' }
  return { color: '#2D6A4F', label: 'prêt' }
}

// ===================== HEATMAP (conservée — la régularité se VOIT) =====================
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

function semLabel(s: Semestre): string {
  if (s === 'year') return 'Année complète'
  return `Semestre ${s}`
}

// ===================== JAUGE (SVG demi-cercle) =====================
function Gauge({ value }: { value: number }) {
  const zone = indexZone(value)
  // Arc : demi-cercle de rayon 84, circonférence/2 ≈ 264.
  const HALF = Math.PI * 84
  const filled = (Math.max(0, Math.min(100, value)) / 100) * HALF
  return (
    <svg viewBox="0 0 220 130" className="st-gauge" role="img" aria-label={`Indice de préparation : ${value} sur 100`}>
      <path
        d="M 26 114 A 84 84 0 0 1 194 114"
        fill="none"
        stroke="var(--bg-soft)"
        strokeWidth="16"
        strokeLinecap="round"
      />
      <path
        d="M 26 114 A 84 84 0 0 1 194 114"
        fill="none"
        stroke={zone.color}
        strokeWidth="16"
        strokeLinecap="round"
        strokeDasharray={`${filled.toFixed(1)} ${(HALF + 10).toFixed(1)}`}
        style={{ transition: 'stroke-dasharray .8s cubic-bezier(.4,0,.2,1), stroke .4s' }}
      />
      <text x="110" y="96" textAnchor="middle" className="st-gauge-num">{value}</text>
      <text x="110" y="116" textAnchor="middle" className="st-gauge-sub">/ 100 · {zone.label}</text>
    </svg>
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
  // Date du concours (Premium) — localStorage, pas de migration nécessaire.
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
    return out.slice(1) // saute le label collé au bord gauche
  }, [heatmap])

  const totalRevs = useMemo(() => {
    let n = 0
    activityIndex.forEach(v => { n += v })
    return n
  }, [activityIndex])

  // ===== L'INDICE =====
  const index = useMemo(() => computeReadiness(semLessons, activityIndex, today), [semLessons, activityIndex, today])
  const index7 = useMemo(() => computeReadiness(semLessons, activityIndex, shiftDate(today, -7)), [semLessons, activityIndex, today])
  const index30 = useMemo(() => computeReadiness(semLessons, activityIndex, shiftDate(today, -30)), [semLessons, activityIndex, today])
  const delta7 = index - index7
  const parts = useMemo(() => computeParts(semLessons, activityIndex, today), [semLessons, activityIndex, today])

  // ===== PAR MATIÈRE =====
  const bySystem = useMemo(() => {
    return semSystems
      .map(sys => {
        const sysLessons = semLessons.filter(l => l.system_id === sys.id)
        if (sysLessons.length === 0) return null
        const idx = computeReadiness(sysLessons, activityIndex, today)
        const idx30 = computeReadiness(sysLessons, activityIndex, shiftDate(today, -30))
        return { system: sys, index: idx, delta30: idx - idx30, total: sysLessons.length }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .sort((a, b) => a.index - b.index)
  }, [semSystems, semLessons, activityIndex, today])

  // ===== QUOI RÉVISER MAINTENANT =====
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

  // Empty state : aucune révision notée — on pousse l'action, pas des zéros.
  if (totalRevs === 0) {
    return (
      <div className="stats-page">
        <div className="stats-empty-global">
          <div className="stats-empty-global-icon" aria-hidden>◈</div>
          <h1 className="stats-empty-global-title">
            Ton indice de préparation t&apos;attend
          </h1>
          <p className="stats-empty-global-text">
            Note tes premières révisions au jour J : cette page calculera où tu
            en es (maîtrise, couverture, régularité) et ce qu&apos;il te reste à faire.
          </p>
          <Link href="/dashboard/fiches" className="stats-empty-global-btn">
            Créer ma première fiche →
          </Link>
        </div>
      </div>
    )
  }

  const zone = indexZone(index)

  return (
    <div className="stats-page">
      {/* HEADER */}
      <div className="stats-header">
        <div>
          <h1 className="stats-title">
            Suis-je <em>prêt</em> ?
          </h1>
          <div className="stats-sub">
            {semLabel(semestre)} · l&apos;indice combine maîtrise, couverture et régularité
          </div>
        </div>
      </div>

      {/* === 1. LA JAUGE === */}
      <div className="stats-card st-hero2">
        <div className="st-hero2-gauge">
          <Gauge value={index} />
        </div>
        <div className="st-hero2-side">
          <div className="st-hero2-kicker">Indice de préparation</div>
          <div className={`st-hero2-delta ${delta7 > 0 ? 'up' : delta7 < 0 ? 'down' : ''}`}>
            {delta7 > 0 ? `▲ +${delta7} pts cette semaine` : delta7 < 0 ? `▼ ${delta7} pts cette semaine` : '= stable cette semaine'}
          </div>
          <div className="st-parts">
            {[
              { lbl: 'Maîtrise', v: parts.mastery, hint: 'moyenne de tes notes' },
              { lbl: 'Couverture', v: parts.coverage, hint: 'fiches avec ≥3 paliers faits' },
              { lbl: 'Régularité', v: parts.regularity, hint: 'jours actifs sur 14' },
            ].map(p => (
              <div key={p.lbl} className="st-part" title={p.hint}>
                <span className="st-part-lbl">{p.lbl}</span>
                <span className="st-part-bar"><i style={{ width: `${Math.round(p.v * 100)}%`, background: zone.color }} /></span>
                <span className="st-part-val">{Math.round(p.v * 100)}</span>
              </div>
            ))}
          </div>
          <div className="st-hero2-target">
            Objectif : <strong>{TARGET_INDEX}/100</strong> — la zone {'«'} prêt {'»'}.
          </div>
        </div>
      </div>

      {/* === 2. PAR MATIÈRE === */}
      <div className="stats-card">
        <div className="stats-card-title">
          Par matière
          <span className="stats-card-sub">de la plus fragile à la plus solide</span>
        </div>
        <div className="st-sys-list">
          {bySystem.map(r => {
            const z = indexZone(r.index)
            return (
              <div key={r.system.id} className="st-sys-row">
                <span className="st-sys-name">{r.system.name}</span>
                <span className="st-sys-bar"><i style={{ width: `${r.index}%`, background: z.color }} /></span>
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

      {/* === 3. QUOI RÉVISER MAINTENANT === */}
      <div className="stats-card st-next">
        <div className="stats-card-title">
          Pour faire monter l&apos;indice maintenant
          <span className="stats-card-sub">notes faibles + fiches pas revues depuis longtemps</span>
        </div>
        <div className="st-next-list">
          {suggestions.map(s => (
            <div key={s.lesson.id} className="st-next-row">
              <span className="st-next-nm">{s.lesson.name}</span>
              <span className="st-next-sys">{s.sysName}</span>
              <span className={`st-next-why${s.weak ? ' weak' : ''}`}>{s.why}</span>
            </div>
          ))}
          {suggestions.length === 0 && (
            <div className="st-empty">Rien à signaler — continue comme ça.</div>
          )}
        </div>
        {suggestions.length > 0 && (
          <div className="st-next-ctas">
            <Link href={suggestionsHref} className="st-cta-primary">
              Réviser ces {suggestions.length} fiche{suggestions.length > 1 ? 's' : ''} →
            </Link>
          </div>
        )}
      </div>

      {/* === 4. PREMIUM : LE PLAN JUSQU'AU CONCOURS === */}
      {!isPro && (
        <div className="stats-card st-plan-teaser">
          <div className="st-plan-teaser-kicker">Premium</div>
          <div className="st-plan-teaser-title">Ton plan jusqu&apos;au concours</div>
          <p className="st-plan-teaser-text">
            Fixe ta date de concours et vois ta <strong>trajectoire</strong> :
            où ton indice sera le jour J à ton rythme actuel, quelles matières
            progressent ou décrochent (évolution sur 30 jours), et ta régularité
            sur l&apos;année entière.
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
                  Au rythme actuel, tu seras à{' '}
                  <strong style={{ color: indexZone(projected).color }}>{projected}/100</strong>{' '}
                  le jour J
                  {projected >= TARGET_INDEX
                    ? ' — en zone « prêt ». Tiens le cap.'
                    : ` — il manque ${TARGET_INDEX - projected} pts pour la zone « prêt ». Vise ${Math.max(1, Math.ceil(((TARGET_INDEX - index) / Math.max(1, daysToExam)) * 7))} pts de plus par semaine.`}
                </div>
              </div>
            ) : (
              <div className="st-plan-proj st-empty">
                Choisis ta date de concours pour voir ta trajectoire.
              </div>
            )}
          </div>

          {/* Régularité annuelle — la seule visualisation conservée : elle se lit d'un coup d'œil */}
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
      )}
    </div>
  )
}

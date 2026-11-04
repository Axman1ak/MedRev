'use client'
// src/app/dashboard/stats/page.tsx
//
// Statistiques : « Où tu en es ». Des chiffres honnêtes, sans jeu.
// Le rang et les livres ont déménagé dans l'onglet Bibliothèque.
//   - 4 chiffres : fiches maîtrisées, fiches en retard, temps cette semaine, réussite aux QCM
//   - une ligne par matière, de la plus faible à la plus forte
//   - les fiches à retravailler (dernière note 1 ou 2)
//   - le temps de travail des 8 dernières semaines (gardens.day_log)
// Une fiche est « maîtrisée » quand sa dernière note (officielle ou temporaire) vaut 4 ou 5.

import { reviewDate } from '@/lib/restDays'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { System, Lesson } from '@/types'
import { toDateStr, todayStr } from '@/types'
import { DEFAULT_J, makeScheduleResolver } from '@/lib/schedule'
import { buildSubjectColorMap } from '@/lib/subjectColors'
import { normalizeYear, scopeToYear } from '@/lib/year'
import { currentSemestre } from '@/lib/semestre'
import PageLoader from '@/components/PageLoader'
import './styles.css'

type Semestre = 1 | 2 | 'year'
type StepEntry = { score?: number; ok?: boolean; date?: string; temp_score?: number; temp_date?: string } | null

function stepScore(s: StepEntry): number | null {
  if (!s) return null
  if (typeof s.score === 'number' && s.score >= 1 && s.score <= 5) return s.score
  if (typeof s.ok === 'boolean') return s.ok ? 5 : 1
  return null
}
function effectiveScore(s: StepEntry): number | null {
  const off = stepScore(s)
  if (off) return off
  if (s && typeof s.temp_score === 'number' && s.temp_score >= 1 && s.temp_score <= 5) return s.temp_score
  return null
}
function stepDate(s: StepEntry): string | null {
  return s?.date ?? s?.temp_date ?? null
}
// Dernière note de la fiche (et sa date), en remontant les paliers.
function lastNote(l: Lesson): { score: number; date: string | null } | null {
  const steps = (Array.isArray(l.steps) ? l.steps : []) as StepEntry[]
  for (let i = steps.length - 1; i >= 0; i--) {
    const sc = effectiveScore(steps[i])
    if (sc) return { score: sc, date: stepDate(steps[i]) }
  }
  return null
}
function addDays(d: string, n: number): string {
  const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return toDateStr(x)
}
// Retard : le premier palier pas encore noté (ni annulé) tombait avant aujourd'hui.
function isLate(l: Lesson, today: string, j: number[]): boolean {
  if (!l.learn_date) return false
  const steps = (Array.isArray(l.steps) ? l.steps : []) as StepEntry[]
  const raw = l as unknown as { skips?: unknown; postpones?: unknown }
  const skips = Array.isArray(raw.skips) ? (raw.skips as number[]) : []
  const post = raw.postpones && typeof raw.postpones === 'object' ? (raw.postpones as Record<string, string>) : {}
  for (let i = 0; i < j.length; i++) {
    if (stepScore(steps[i]) || skips.includes(i)) continue
    const due = post[String(i)] ?? reviewDate(l.learn_date, j[i])
    return due < today
  }
  return false
}
function fmtDay(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', '')
}
function fmtHours(ms: number): { big: string; small: string } {
  const min = Math.round(ms / 60000)
  if (min < 60) return { big: `${min}`, small: 'min' }
  return { big: `${Math.floor(min / 60)} h`, small: String(min % 60).padStart(2, '0') }
}

const NOTE_COLORS = ['#B3423B', '#D9792F', '#D9A92E', '#6E9E5E', '#2F6A28']
const NOTE_NONE = 'var(--bg-muted)'

export default function StatsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [systems, setSystems] = useState<System[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [dayLog, setDayLog] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [semestre, setSemestre] = useState<Semestre>(currentSemestre)
  const today = useMemo(() => todayStr(), [])

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('medrev-sem') : null
    setSemestre(raw === '1' ? 1 : raw === '2' ? 2 : raw === 'year' ? 'year' : currentSemestre())
    function onSem(e: Event) {
      const d = (e as CustomEvent<Semestre>).detail
      if (d === 1 || d === 2 || d === 'year') setSemestre(d)
    }
    window.addEventListener('medrev-sem-change', onSem)
    return () => window.removeEventListener('medrev-sem-change', onSem)
  }, [])

  useEffect(() => {
    let off = false
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const [{ data: sys }, { data: les }, { data: prof }, { data: garden }] = await Promise.all([
        supabase.from('systems').select('*').eq('user_id', user.id).order('semestre').order('created_at'),
        supabase.from('lessons').select('*').eq('user_id', user.id).order('created_at'),
        supabase.from('profiles').select('current_year').eq('id', user.id).single(),
        supabase.from('gardens').select('day_log').eq('user_id', user.id).maybeSingle(),
      ])
      if (off) return
      // L'année en cours seulement : mélanger P1 et P2 ne voudrait rien dire.
      const year = normalizeYear((prof as { current_year?: string } | null)?.current_year)
      const scoped = scopeToYear((sys as System[] | null) ?? [], (les as Lesson[] | null) ?? [], year)
      setSystems(scoped.systems)
      setLessons(scoped.lessons)
      const raw = (garden as { day_log?: unknown } | null)?.day_log
      const log: Record<string, number> = {}
      if (raw && typeof raw === 'object') {
        for (const [k, v] of Object.entries(raw as Record<string, unknown>)) if (typeof v === 'number' && v > 0) log[k] = v
      }
      setDayLog(log)
      setLoading(false)
    })()
    return () => { off = true }
  }, [supabase, router])

  const semSystems = useMemo(() => semestre === 'year' ? systems : systems.filter(s => s.semestre === semestre), [systems, semestre])
  const semIds = useMemo(() => new Set(semSystems.map(s => s.id)), [semSystems])
  const semLessons = useMemo(() => lessons.filter(l => semIds.has(l.system_id)), [lessons, semIds])
  const schedOf = useMemo(() => makeScheduleResolver(systems), [systems])
  const colorOf = useMemo(() => buildSubjectColorMap(systems), [systems])

  // ===== Par matière =====
  const rows = useMemo(() => semSystems.map(sys => {
    const ls = semLessons.filter(l => l.system_id === sys.id)
    const dist = [0, 0, 0, 0, 0]
    let none = 0, late = 0, att = 0, ok = 0
    for (const l of ls) {
      const n = lastNote(l)
      if (n) dist[n.score - 1]++; else none++
      if (isLate(l, today, schedOf(l.system_id) ?? DEFAULT_J)) late++
      for (const q of l.ai_questions ?? []) { att += q.attempts ?? 0; ok += q.correct ?? 0 }
    }
    const rated = ls.length - none
    return {
      sys, color: colorOf.get(sys.id) || '#3E6F9C', n: ls.length, dist, none, late, att, ok,
      mastered: dist[3] + dist[4],
      mastery: ls.length > 0 ? (dist[3] + dist[4]) / ls.length : 0,
      rated,
    }
  }).filter(r => r.n > 0).sort((a, b) => a.mastery - b.mastery || b.late - a.late), [semSystems, semLessons, today, schedOf, colorOf])

  const totals = useMemo(() => {
    let n = 0, mastered = 0, late = 0, att = 0, ok = 0
    const lateSubs: string[] = []
    for (const r of rows) {
      n += r.n; mastered += r.mastered; late += r.late; att += r.att; ok += r.ok
      if (r.late > 0) lateSubs.push(r.sys.name)
    }
    return { n, mastered, late, att, ok, lateSubs }
  }, [rows])

  // ===== Cette semaine =====
  const week = useMemo(() => {
    const d = new Date(today + 'T12:00:00')
    const monday = addDays(today, -((d.getDay() + 6) % 7))
    let ms = 0
    for (let i = 0; i < 7; i++) ms += dayLog[addDays(monday, i)] ?? 0
    let notes = 0
    for (const l of semLessons) {
      for (const s of (Array.isArray(l.steps) ? l.steps : []) as StepEntry[]) {
        const dt = stepDate(s)
        if (effectiveScore(s) && dt && dt >= monday) notes++
      }
    }
    // 8 dernières semaines, lundi par lundi
    const bars = Array.from({ length: 8 }, (_, w) => {
      const start = addDays(monday, -7 * (7 - w))
      let t = 0
      for (let i = 0; i < 7; i++) t += dayLog[addDays(start, i)] ?? 0
      return { start, ms: t }
    })
    return { ms, notes, bars }
  }, [dayLog, today, semLessons])
  const maxBar = Math.max(...week.bars.map(b => b.ms), 3600000)
  const avgBar = week.bars.reduce((a, b) => a + b.ms, 0) / week.bars.length

  // ===== Vue explorable (nov. 2026) =====
  const [period, setPeriod] = useState<7 | 30 | 'sem'>(30)
  const [metric, setMetric] = useState<'time' | 'notes' | 'active'>('time')
  const [selDay, setSelDay] = useState<string | null>(null)
  const [openSys, setOpenSys] = useState<string | null>(null)
  const [noteSel, setNoteSel] = useState<number | null>(null)

  // Révisions notées par jour : { date: [{ lesson, score }] }
  const notesByDay = useMemo(() => {
    const m = new Map<string, { l: Lesson; score: number }[]>()
    for (const l of semLessons) {
      for (const st of (Array.isArray(l.steps) ? l.steps : []) as StepEntry[]) {
        const sc = effectiveScore(st); const dt = stepDate(st)
        if (!sc || !dt) continue
        const arr = m.get(dt) ?? []; arr.push({ l, score: sc }); m.set(dt, arr)
      }
    }
    return m
  }, [semLessons])

  const days = useMemo(() => {
    let n = period === 'sem' ? 0 : period
    if (period === 'sem') {
      // Depuis la plus ancienne date d'apprentissage du semestre (64 jours au plus).
      const first = semLessons.map(l => l.learn_date).filter(Boolean).sort()[0] as string | undefined
      const diff = first ? Math.round((new Date(today + 'T12:00:00').getTime() - new Date(first + 'T12:00:00').getTime()) / 86400000) + 1 : 30
      n = Math.max(14, Math.min(120, diff))
    }
    return Array.from({ length: n }, (_, i) => {
      const date = addDays(today, -(n - 1 - i))
      const ms = dayLog[date] ?? 0
      const notes = notesByDay.get(date) ?? []
      return { date, ms, notes, active: ms > 0 || notes.length > 0 }
    })
  }, [period, today, dayLog, notesByDay, semLessons])

  const prevDays = useMemo(() => {
    const n = days.length
    return Array.from({ length: n }, (_, i) => {
      const date = addDays(today, -(2 * n - 1 - i))
      const ms = dayLog[date] ?? 0
      const notes = notesByDay.get(date) ?? []
      return { ms, notes: notes.length, active: ms > 0 || notes.length > 0 }
    })
  }, [days.length, today, dayLog, notesByDay])

  // ===== À retravailler =====
  const weak = useMemo(() => semLessons
    .map(l => ({ l, note: lastNote(l), late: isLate(l, today, schedOf(l.system_id) ?? DEFAULT_J) }))
    .filter(x => x.note && x.note.score <= 2)
    .sort((a, b) => a.note!.score - b.note!.score || (a.note!.date ?? '').localeCompare(b.note!.date ?? '')),
  [semLessons, today, schedOf])

  if (loading) return <div className="stats-page"><PageLoader label="Calcul de tes statistiques…" /></div>

  if (totals.n === 0) {
    return (
      <div className="stats-page st6 st7">
        <header className="st7-head"><h1>Statistiques</h1></header>
        <div className="st6-empty">
          <p>Pas encore de fiche sur cette période. Crée tes fiches et note tes premières révisions : tes statistiques apparaîtront ici, matière par matière.</p>
          <Link href="/dashboard/fiches" className="st6-btn">Aller aux fiches</Link>
        </div>
      </div>
    )
  }

  const qcmPct = totals.att > 0 ? Math.round(100 * totals.ok / totals.att) : null
  const sumMs = days.reduce((a, d) => a + d.ms, 0)
  const sumNotes = days.reduce((a, d) => a + d.notes.length, 0)
  const sumActive = days.filter(d => d.active).length
  const pMs = prevDays.reduce((a, d) => a + d.ms, 0)
  const pNotes = prevDays.reduce((a, d) => a + d.notes, 0)
  const pActive = prevDays.filter(d => d.active).length
  const fmtMs = (ms: number) => { const h = fmtHours(ms); return h.small === 'min' ? `${h.big} min` : `${h.big} ${h.small}` }
  const delta = (a: number, b: number, unit: 'ms' | 'n') => {
    if (a === b) return { t: 'comme avant', c: '' }
    const d = a - b
    const t = unit === 'ms' ? fmtMs(Math.abs(d)) : String(Math.abs(d))
    return { t: `${d > 0 ? '+' : '−'}${t} vs avant`, c: d > 0 ? 'up' : 'down' }
  }
  const kpis = [
    { id: 'time' as const, label: 'Temps de révision', value: fmtMs(sumMs), d: delta(sumMs, pMs, 'ms') },
    { id: 'notes' as const, label: 'Révisions notées', value: String(sumNotes), d: delta(sumNotes, pNotes, 'n') },
    { id: 'active' as const, label: 'Jours actifs', value: `${sumActive} / ${days.length}`, d: delta(sumActive, pActive, 'n') },
  ]
  const val = (d: typeof days[number]) => metric === 'time' ? d.ms : metric === 'notes' ? d.notes.length : (d.active ? 1 : 0)
  const maxV = Math.max(1, ...days.map(val))
  const curDay = days.find(d => d.date === selDay) ?? days[days.length - 1]
  const chartLbl = metric === 'time' ? 'temps par jour' : metric === 'notes' ? 'révisions notées par jour' : 'jours actifs'
  const longDay = (d: string) => { const x = new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }); return x.charAt(0).toUpperCase() + x.slice(1) }

  // Fiches par dernière note (1 à 5), 0 = pas encore notée
  const byNote = [0, 1, 2, 3, 4, 5].map(k => semLessons.filter(l => (lastNote(l)?.score ?? 0) === k))
  const noteK = noteSel ?? ([1, 2, 3, 4, 5].find(k => byNote[k].length > 0) ?? 0)
  const NOTE_WORD = ['pas encore notées', 'à revoir', 'faibles', 'moyennes', 'bien', 'maîtrisées']
  const qcmOf = (l: Lesson) => {
    let a = 0, o = 0
    for (const q of l.ai_questions ?? []) { a += q.attempts ?? 0; o += q.correct ?? 0 }
    return a > 0 ? `${Math.round(100 * o / a)} %` : '—'
  }
  const nextOf = (l: Lesson) => {
    if (!l.learn_date) return { t: 'pas planifiée', late: false }
    const j = schedOf(l.system_id) ?? DEFAULT_J
    const steps = (Array.isArray(l.steps) ? l.steps : []) as StepEntry[]
    const raw = l as unknown as { skips?: unknown; postpones?: unknown }
    const skips = Array.isArray(raw.skips) ? (raw.skips as number[]) : []
    const post = raw.postpones && typeof raw.postpones === 'object' ? (raw.postpones as Record<string, string>) : {}
    for (let i = 0; i < j.length; i++) {
      if (stepScore(steps[i]) || skips.includes(i)) continue
      const due = post[String(i)] ?? reviewDate(l.learn_date, j[i])
      if (due < today) return { t: `${Math.round((new Date(today + 'T12:00:00').getTime() - new Date(due + 'T12:00:00').getTime()) / 86400000)} j de retard`, late: true }
      if (due === today) return { t: "aujourd'hui", late: false }
      return { t: fmtDay(due), late: false }
    }
    return { t: 'terminée', late: false }
  }

  return (
    <div className="stats-page st6 st7">
      <header className="st7-head">
        <h1>Statistiques</h1>
        <div className="st7-seg" role="group" aria-label="Période">
          {([[7, '7 jours'], [30, '30 jours'], ['sem', 'Semestre']] as const).map(([v, l]) => (
            <button key={String(v)} type="button" aria-pressed={period === v} className={period === v ? 'on' : ''} onClick={() => { setPeriod(v); setSelDay(null) }}>{l}</button>
          ))}
        </div>
      </header>

      <section className="st7-kpis" aria-label="Chiffres clés">
        {kpis.map(k => (
          <button key={k.id} type="button" className={`st7-kpi${metric === k.id ? ' on' : ''}`} aria-pressed={metric === k.id} onClick={() => setMetric(k.id)}>
            <span className="st7-kpi-l">{k.label}</span>
            <b>{k.value}</b>
            <span className={`st7-kpi-d ${k.d.c}`}>{k.d.t}</span>
          </button>
        ))}
        <div className="st7-kpi static">
          <span className="st7-kpi-l">Réussite aux QCM</span>
          <b>{qcmPct === null ? '—' : `${qcmPct} %`}</b>
          <span className="st7-kpi-d">{totals.att > 0 ? `sur ${totals.att} réponses` : 'aucun QCM fait'}</span>
        </div>
      </section>

      <section className="st7-chart" aria-label={chartLbl}>
        <div className="st7-bars" style={{ gap: days.length > 40 ? 2 : days.length > 10 ? 4 : 12 }}>
          {days.map(d => (
            <button key={d.date} type="button" aria-label={longDay(d.date)} aria-pressed={d.date === curDay.date}
              className={`st7-bar${d.date === curDay.date ? ' on' : ''}${d.active ? ' act' : ''}`}
              style={{ height: `${Math.max(3, Math.round(100 * val(d) / maxV))}%` }}
              onClick={() => setSelDay(d.date)} />
          ))}
        </div>
        <div className="st7-axis"><span>{fmtDay(days[0].date)}</span><span>{chartLbl}</span><span>aujourd&apos;hui</span></div>

        <div className="st7-day">
          <div className="st7-day-h">
            <b>{longDay(curDay.date)}</b>
            <span>{curDay.active ? `${fmtMs(curDay.ms)}, ${curDay.notes.length} révision${curDay.notes.length > 1 ? 's' : ''} notée${curDay.notes.length > 1 ? 's' : ''}` : 'Aucune activité'}</span>
          </div>
          <div className="st7-day-list">
            {curDay.notes.length === 0
              ? <span className="st7-muted">{curDay.ms > 0 ? 'Du temps en session, sans note posée ce jour-là.' : 'Pas de révision ce jour-là.'}</span>
              : curDay.notes.map((n, i) => (
                <Link key={`${n.l.id}-${i}`} href={`/dashboard/fiches?matiere=${n.l.system_id}&fiche=${n.l.id}`} className="st7-row">
                  <i style={{ background: colorOf.get(n.l.system_id) || '#3E6F9C' }} />
                  <span className="st7-row-t">{n.l.name}</span>
                  <span className={`st7-note n${n.score}`}>{n.score}</span>
                  <span className="st7-muted">{qcmOf(n.l)} QCM</span>
                </Link>
              ))}
          </div>
        </div>
      </section>

      <div className="st7-grid">
        <section className="st7-subs" aria-label="Par matière">
          <div className="st7-th"><span /><span>Maîtrise</span><span>QCM</span><span>Retard</span></div>
          {rows.map(r => {
            const open = openSys === r.sys.id
            const ls = semLessons.filter(l => l.system_id === r.sys.id)
            return (
              <div key={r.sys.id} className={`st7-sub${open ? ' open' : ''}`}>
                <button type="button" className="st7-tr" aria-expanded={open} onClick={() => setOpenSys(open ? null : r.sys.id)}>
                  <span className="st7-name"><i style={{ background: r.color }} /><b>{r.sys.name}</b><small>{r.n}</small></span>
                  <span className="st7-mbar"><span><i style={{ width: `${Math.round(r.mastery * 100)}%`, background: r.color }} /></span><em>{Math.round(r.mastery * 100)} %</em></span>
                  <span className="st7-num">{r.att > 0 ? `${Math.round(100 * r.ok / r.att)} %` : '—'}</span>
                  <span className={`st7-num${r.late > 0 ? ' late' : ''}`}>{r.late > 0 ? r.late : '—'}</span>
                </button>
                {open && (
                  <div className="st7-fiches">
                    {ls.map(l => {
                      const nt = lastNote(l); const nx = nextOf(l)
                      return (
                        <Link key={l.id} href={`/dashboard/fiches?matiere=${l.system_id}&fiche=${l.id}`} className="st7-tr st7-fiche">
                          <span className="st7-name"><span className={`st7-note n${nt?.score ?? 0}`}>{nt?.score ?? '·'}</span>{l.name}</span>
                          <span className={nx.late ? 'late' : 'st7-muted'}>{nx.t}</span>
                          <span className="st7-num">{qcmOf(l)}</span>
                          <span />
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </section>

        <aside className="st7-side">
          <span className="st7-muted">Dernière note de chaque fiche</span>
          <div className="st7-dist">
            {[1, 2, 3, 4, 5, 0].map(k => byNote[k].length > 0 && (
              <button key={k} type="button" aria-pressed={noteK === k} aria-label={`${byNote[k].length} fiches ${NOTE_WORD[k]}`}
                className={noteK === k ? 'on' : ''} style={{ flexGrow: byNote[k].length, background: k === 0 ? NOTE_NONE : NOTE_COLORS[k - 1] }}
                onClick={() => setNoteSel(k)} />
            ))}
          </div>
          <div className="st7-legend">
            {[1, 2, 3, 4, 5].map(k => <span key={k}><i style={{ background: NOTE_COLORS[k - 1] }} />{k} ({byNote[k].length})</span>)}
          </div>
          <div className="st7-notelist">
            <div className="st7-notelist-h">
              <b>{byNote[noteK].length} fiche{byNote[noteK].length > 1 ? 's' : ''} {NOTE_WORD[noteK]}</b>
              {byNote[noteK].length > 0 && <Link href={`/dashboard/focus?lessons=${byNote[noteK].slice(0, 30).map(l => l.id).join(',')}`}>Réviser</Link>}
            </div>
            {byNote[noteK].slice(0, 8).map(l => (
              <Link key={l.id} href={`/dashboard/fiches?matiere=${l.system_id}&fiche=${l.id}`} className="st7-row">
                <i style={{ background: colorOf.get(l.system_id) || '#3E6F9C' }} />
                <span className="st7-row-t">{l.name}</span>
                <span className="st7-muted">{qcmOf(l)} QCM</span>
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </div>
  )
}

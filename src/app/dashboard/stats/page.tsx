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

  // ===== À retravailler =====
  const weak = useMemo(() => semLessons
    .map(l => ({ l, note: lastNote(l), late: isLate(l, today, schedOf(l.system_id) ?? DEFAULT_J) }))
    .filter(x => x.note && x.note.score <= 2)
    .sort((a, b) => a.note!.score - b.note!.score || (a.note!.date ?? '').localeCompare(b.note!.date ?? '')),
  [semLessons, today, schedOf])

  if (loading) return <div className="stats-page"><PageLoader label="Calcul de tes statistiques…" /></div>

  const semName = semestre === 'year' ? "Toute l'année" : `Semestre ${semestre}`

  if (totals.n === 0) {
    return (
      <div className="stats-page st6">
        <header className="st6-head">
          <h1>Où tu en es</h1>
          <p>{semName}</p>
        </header>
        <div className="st6-empty">
          <p>Pas encore de fiche sur cette période. Crée tes fiches et note tes premières révisions : tes statistiques apparaîtront ici, matière par matière.</p>
          <Link href="/dashboard/fiches" className="st6-btn">Aller aux fiches</Link>
        </div>
      </div>
    )
  }

  const hours = fmtHours(week.ms)
  const qcmPct = totals.att > 0 ? Math.round(100 * totals.ok / totals.att) : null
  const lateSub = totals.late === 0
    ? 'Tout est à jour'
    : totals.lateSubs.length <= 2
      ? totals.lateSubs.join(' et ')
      : `${totals.lateSubs.slice(0, 2).join(', ')} et ${totals.lateSubs.length - 2} autre${totals.lateSubs.length - 2 > 1 ? 's' : ''}`
  const weakIds = weak.slice(0, 30).map(w => w.l.id).join(',')

  return (
    <div className="stats-page st6">
      <header className="st6-head">
        <h1>Où tu en es</h1>
        <p>{semName}, {totals.n} fiche{totals.n > 1 ? 's' : ''}, mis à jour à chaque note.</p>
      </header>

      <section className="st6-kpis" aria-label="Chiffres clés">
        <div className="st6-kpi">
          <div className="st6-kicker">Fiches maîtrisées</div>
          <div className="st6-kpi-v"><b>{totals.mastered}</b><span>/ {totals.n}</span></div>
          <div className="st6-kpi-s">dernière note 4 ou 5</div>
        </div>
        <div className="st6-kpi">
          <div className="st6-kicker">En retard</div>
          <div className="st6-kpi-v"><b className={totals.late > 0 ? 'late' : ''}>{totals.late}</b><span>fiche{totals.late > 1 ? 's' : ''}</span></div>
          <div className="st6-kpi-s">{lateSub}</div>
        </div>
        <div className="st6-kpi">
          <div className="st6-kicker">Cette semaine</div>
          <div className="st6-kpi-v"><b>{hours.big}</b><span>{hours.small}</span></div>
          <div className="st6-kpi-s">{week.notes} révision{week.notes > 1 ? 's' : ''} notée{week.notes > 1 ? 's' : ''}</div>
        </div>
        <div className="st6-kpi">
          <div className="st6-kicker">Réussite aux QCM</div>
          <div className="st6-kpi-v">{qcmPct === null ? <b className="dim">0</b> : <b>{qcmPct}</b>}<span>%</span></div>
          <div className="st6-kpi-s">{totals.att > 0 ? `sur ${totals.att} réponse${totals.att > 1 ? 's' : ''}` : 'Aucun QCM fait pour le moment'}</div>
        </div>
      </section>

      <div className="st6-grid">
        <section className="st6-subs" aria-label="Par matière">
          <div className="st6-sec-head">
            <h2>Par matière</h2>
            <span>De la plus faible à la plus forte</span>
          </div>
          <div className="st6-table">
            <div className="st6-tr st6-th">
              <span>Matière</span><span>Dernière note de chaque fiche</span><span>Maîtrise</span><span>Retard</span><span>QCM</span><span />
            </div>
            {rows.map((r, i) => (
              <Link key={r.sys.id} href={`/dashboard/fiches?matiere=${r.sys.id}`} className="st6-tr st6-row" style={{ animationDelay: `${60 + i * 50}ms` }}>
                <span className="st6-sub"><i style={{ background: r.color }} /><b>{r.sys.name}</b><small>{r.n}</small></span>
                <span className="st6-dist" style={{ animationDelay: `${60 + i * 50}ms` }}>
                  {r.dist.map((v, k) => v > 0 && (
                    <span key={k} style={{ flexGrow: v, background: NOTE_COLORS[k] }} title={`${v} fiche${v > 1 ? 's' : ''} : dernière note ${k + 1}/5`} />
                  ))}
                  {r.none > 0 && <span style={{ flexGrow: r.none, background: NOTE_NONE }} title={`${r.none} fiche${r.none > 1 ? 's' : ''} pas encore notée${r.none > 1 ? 's' : ''}`} />}
                </span>
                <span className="st6-num">{r.rated > 0 ? `${Math.round(r.mastery * 100)} %` : '0 %'}</span>
                <span className={`st6-num ${r.late > 0 ? 'late' : 'dim'}`}>{r.late > 0 ? `${r.late} fiche${r.late > 1 ? 's' : ''}` : 'à jour'}</span>
                <span className="st6-num">{r.att > 0 ? `${Math.round(100 * r.ok / r.att)} %` : <em>pas de QCM</em>}</span>
                <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
              </Link>
            ))}
          </div>
          <div className="st6-legend">
            {NOTE_COLORS.map((c, k) => <span key={k}><i style={{ background: c }} />{k + 1}/5</span>)}
            <span><i style={{ background: NOTE_NONE }} />pas encore notée</span>
            <span className="st6-legend-r">Maîtrisée = dernière note 4 ou 5</span>
          </div>
        </section>

        <aside className="st6-side">
          <section aria-label="À retravailler">
            <div className="st6-sec-head">
              <h2>À retravailler</h2>
              {weak.length > 5 && <Link href={`/dashboard/focus?lessons=${weakIds}`}>Tout revoir ({weak.length})</Link>}
            </div>
            {weak.length === 0
              ? <p className="st6-none">Aucune fiche notée 1 ou 2 sur cette période.</p>
              : (
                <ul className="st6-weak">
                  {weak.slice(0, 5).map(({ l, note, late }) => {
                    const sys = semSystems.find(s => s.id === l.system_id)
                    return (
                      <li key={l.id}>
                        <span className={`st6-note n${note!.score}`}>{note!.score}/5</span>
                        <span className="st6-weak-t">
                          <b>{l.name}</b>
                          <small>{sys?.name ?? 'Matière'}{late ? ', en retard' : note!.date ? `, notée le ${fmtDay(note!.date)}` : ''}</small>
                        </span>
                        <Link href={`/dashboard/focus?lessons=${l.id}`} className="st6-mini">Réviser</Link>
                      </li>
                    )
                  })}
                </ul>
              )}
          </section>

          <section aria-label="Temps de travail">
            <div className="st6-sec-head">
              <h2>Temps par semaine</h2>
              <span>moyenne {fmtHours(avgBar).big}{fmtHours(avgBar).small !== 'min' ? ` ${fmtHours(avgBar).small}` : ' min'}</span>
            </div>
            <div className="st6-bars" role="img" aria-label="Temps de travail des 8 dernières semaines">
              {week.bars.map((b, i) => {
                const h = Math.floor(b.ms / 3600000)
                const last = i === week.bars.length - 1
                return (
                  <div key={b.start} className="st6-bar-col">
                    <span className={last ? 'cur' : ''}>{b.ms > 0 ? (h > 0 ? `${h} h` : `${Math.round(b.ms / 60000)} min`) : ''}</span>
                    <i className={last ? 'cur' : ''} style={{ height: `${Math.max(b.ms > 0 ? 4 : 0, Math.round(100 * b.ms / maxBar))}px`, animationDelay: `${200 + i * 60}ms` }} />
                  </div>
                )
              })}
            </div>
            <div className="st6-bars-lbl">
              {week.bars.map(b => <span key={b.start}>{fmtDay(b.start)}</span>)}
            </div>
            <p className="st6-foot">Temps passé en session de travail sur MedRev.</p>
          </section>
        </aside>
      </div>
    </div>
  )
}

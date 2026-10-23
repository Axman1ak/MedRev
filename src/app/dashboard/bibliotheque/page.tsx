'use client'
// src/app/dashboard/bibliotheque/page.tsx
//
// Bibliothèque : le côté jeu de MedRev.
// 1 révision notée = 1 livre, rangé sur l'étagère de sa matière, à sa couleur.
// Les livres sont comptés directement depuis les notes des fiches (lessons.steps) :
// rien d'autre à tenir à jour, et rien ne peut se désynchroniser.
// Le rang suit le nombre de livres de l'année : il ne redescend jamais.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { System, Lesson } from '@/types'
import { toDateStr, todayStr } from '@/types'
import { makeScheduleResolver } from '@/lib/schedule'
import { buildSubjectColorMap } from '@/lib/subjectColors'
import { normalizeYear, scopeToYear } from '@/lib/year'
import { currentSemestre } from '@/lib/semestre'
import PageLoader from '@/components/PageLoader'
import './styles.css'

type Semestre = 1 | 2 | 'year'
type Step = { score?: number; ok?: boolean; date?: string } | null

// Une note officielle (la note posée au jour J), comme dans le reste de l'app.
function officialScore(s: Step): number | null {
  if (!s) return null
  if (typeof s.score === 'number' && s.score >= 1 && s.score <= 5) return s.score
  if (typeof s.ok === 'boolean') return s.ok ? 5 : 1
  return null
}

const RANKS = [
  { name: 'Apprenti', at: 0, treasure: 'Ta première étagère' },
  { name: 'Copiste', at: 30, treasure: 'Débloque le sablier' },
  { name: 'Scribe', at: 100, treasure: 'Débloque le chandelier' },
  { name: 'Lettré', at: 250, treasure: 'Débloque le globe' },
  { name: 'Érudit', at: 500, treasure: "Débloque le buste d'Hippocrate" },
  { name: 'Maître', at: 1000, treasure: 'Débloque le codex sur lutrin' },
]

// Petit hachage stable : chaque livre garde sa taille et sa teinte d'une visite à l'autre.
function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0) / 4294967295
}
function shade(hex: string, f: number): string {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16)
  if (Number.isNaN(n)) return hex
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map(c =>
    Math.max(0, Math.min(255, Math.round(f > 0 ? c + (255 - c) * f : c * (1 + f)))))
  return `rgb(${ch[0]},${ch[1]},${ch[2]})`
}
function fmtDay(d: string): string {
  return new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }).replace('.', '')
}
function mondayOf(today: string): string {
  const d = new Date(today + 'T12:00:00')
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return toDateStr(d)
}

type Book = { key: string; w: number; h: number; c: string; gold: boolean; tip: string; date: string | null; score: number }

const PER_ROW = 110 // au-delà, l'étagère passe sur une deuxième planche

export default function BibliothequePage() {
  const supabase = createClient()
  const router = useRouter()
  const [systems, setSystems] = useState<System[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
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
      const [{ data: sys }, { data: les }, { data: prof }] = await Promise.all([
        supabase.from('systems').select('*').eq('user_id', user.id).order('semestre').order('created_at'),
        supabase.from('lessons').select('id, name, system_id, steps, created_at').eq('user_id', user.id),
        supabase.from('profiles').select('current_year').eq('id', user.id).single(),
      ])
      if (off) return
      const year = normalizeYear((prof as { current_year?: string } | null)?.current_year)
      const scoped = scopeToYear((sys as System[] | null) ?? [], (les as Lesson[] | null) ?? [], year)
      setSystems(scoped.systems)
      setLessons(scoped.lessons)
      setLoading(false)
    })()
    return () => { off = true }
  }, [supabase, router])

  const schedOf = useMemo(() => makeScheduleResolver(systems), [systems])
  const colorOf = useMemo(() => buildSubjectColorMap(systems), [systems])

  // Tous les livres de l'année, par matière.
  const booksBySys = useMemo(() => {
    const m = new Map<string, Book[]>()
    for (const l of lessons) {
      const steps = (Array.isArray(l.steps) ? l.steps : []) as Step[]
      const j = schedOf(l.system_id)
      const base = colorOf.get(l.system_id) || '#3E6F9C'
      steps.forEach((s, i) => {
        const score = officialScore(s)
        if (!score) return
        const r = hash(`${l.id}:${i}`)
        const r2 = hash(`${i}:${l.id}`)
        const date = s?.date ?? null
        const arr = m.get(l.system_id) ?? []
        arr.push({
          key: `${l.id}-${i}`,
          w: 8 + Math.round(r * 4),
          h: 46 + Math.round(r2 * 20),
          c: shade(base, (r - 0.55) * 0.5),
          gold: score === 5,
          score,
          date,
          tip: `${l.name}, J+${j[i] ?? i}, ${score}/5${date ? `, ${fmtDay(date)}` : ''}`,
        })
        m.set(l.system_id, arr)
      })
    }
    // Ordre de pose : du plus ancien au plus récent.
    m.forEach(arr => arr.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')))
    return m
  }, [lessons, schedOf, colorOf])

  const total = useMemo(() => { let n = 0; booksBySys.forEach(a => { n += a.length }); return n }, [booksBySys])
  const week = useMemo(() => {
    const mon = mondayOf(today)
    let n = 0, five = 0
    booksBySys.forEach(a => a.forEach(b => { if (b.date && b.date >= mon) { n++; if (b.score === 5) five++ } }))
    return { n, five }
  }, [booksBySys, today])

  const shelves = useMemo(() => {
    const list = semestre === 'year' ? systems : systems.filter(s => s.semestre === semestre)
    return list
      .map(s => ({ sys: s, color: colorOf.get(s.id) || '#3E6F9C', books: booksBySys.get(s.id) ?? [] }))
      .sort((a, b) => b.books.length - a.books.length)
  }, [systems, semestre, booksBySys, colorOf])

  const rankIdx = RANKS.reduce((acc, r, i) => (total >= r.at ? i : acc), 0)
  const rank = RANKS[rankIdx]
  const next = RANKS[rankIdx + 1] ?? null
  const progress = next ? (total - rank.at) / (next.at - rank.at) : 1

  if (loading) return <div className="bib-page"><PageLoader label="Ouverture de ta bibliothèque…" /></div>

  let delay = 0
  return (
    <div className="bib-page">
      <header className="bib-head">
        <h1>Ta bibliothèque</h1>
        <p>Chaque révision notée ajoute un livre sur l&apos;étagère de sa matière. Les livres ne partent jamais.</p>
      </header>

      <div className="bib-grid">
        <section className="bib-case" aria-label="Étagères">
          {shelves.length === 0 && (
            <div className="bib-case-empty">
              Crée tes matières et tes fiches : chaque révision notée posera un livre ici.
              <Link href="/dashboard/fiches">Aller aux fiches</Link>
            </div>
          )}
          {shelves.map(({ sys, color, books }) => {
            const rows: Book[][] = []
            for (let i = 0; i < books.length; i += PER_ROW) rows.push(books.slice(i, i + PER_ROW))
            if (rows.length === 0) rows.push([])
            return (
              <div className="bib-shelf" key={sys.id}>
                <div className="bib-shelf-lbl">
                  <div className="bib-shelf-name"><i style={{ background: color }} />{sys.name}</div>
                  <div className="bib-shelf-n">{books.length === 0 ? 'aucun livre' : `${books.length} livre${books.length > 1 ? 's' : ''}`}</div>
                </div>
                <div className="bib-shelf-rows">
                  {rows.map((row, ri) => (
                    <div key={ri}>
                      <div className="bib-books">
                        {row.map(b => {
                          const d = Math.min(delay, 1400); delay += 3
                          return (
                            <span key={b.key} className="bib-book" title={b.tip}
                              style={{ width: b.w, height: b.h, background: b.c, animationDelay: `${d}ms` }}>
                              {b.gold && <span className="bib-gold" />}
                            </span>
                          )
                        })}
                      </div>
                      <div className="bib-board" />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
          <div className="bib-legend">
            <span><i className="bib-legend-gold" />Révision notée 5/5</span>
            <span>Survole un livre pour voir la fiche et la date</span>
          </div>
        </section>

        <aside className="bib-side">
          <div className="bib-rank">
            <div className="bib-rank-top">
              <div className="bib-seal" aria-hidden>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.5 2.2 3.5 5 3.5 8s-1 5.8-3.5 8c-2.5-2.2-3.5-5-3.5-8s1-5.8 3.5-8z"/></svg>
              </div>
              <div>
                <div className="bib-kicker">Ton rang</div>
                <div className="bib-rank-name">{rank.name}</div>
                <div className="bib-rank-n">{total} livre{total > 1 ? 's' : ''}</div>
              </div>
            </div>
            <div className="bib-bar"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
            <div className="bib-bar-lbl">
              {next
                ? <><span>Encore <strong>{next.at - total} livre{next.at - total > 1 ? 's' : ''}</strong> avant {next.name}</span><span>{next.at}</span></>
                : <span>Dernier rang atteint.</span>}
            </div>
          </div>

          <div>
            <div className="bib-kicker">Les rangs</div>
            <ol className="bib-ranks">
              {RANKS.map((r, i) => {
                const st = i < rankIdx ? 'done' : i === rankIdx ? 'cur' : 'todo'
                return (
                  <li key={r.name} className={`bib-r ${st}`}>
                    <span className="bib-r-dot">
                      {st !== 'todo' && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>}
                    </span>
                    <span className="bib-r-txt"><b>{r.name}</b><small>{r.treasure}</small></span>
                    <span className="bib-r-at">{r.at}</span>
                  </li>
                )
              })}
            </ol>
          </div>

          <div className="bib-week">
            <div><b>+{week.n}</b><span>livre{week.n > 1 ? 's' : ''} cette semaine</span></div>
            <div><b>{week.five}</b><span>noté{week.five > 1 ? 's' : ''} 5/5 cette semaine</span></div>
          </div>
        </aside>
      </div>
    </div>
  )
}

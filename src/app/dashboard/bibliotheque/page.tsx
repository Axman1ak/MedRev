'use client'
// src/app/dashboard/bibliotheque/page.tsx
//
// Bibliothèque : le côté jeu de MedRev, et une carte de ce qu'il faut revoir.
// 1 fiche = 1 livre, rangé sur l'étagère de sa matière, à sa couleur.
//   · il s'épaissit à chaque révision notée ;
//   · il prend la poussière quand la fiche est en retard (plus le retard est
//     long, plus il y en a) ; le réviser le fait briller à nouveau ;
//   · une tranche dorée quand la dernière note est 5/5.
// Un clic sur un livre ouvre le détail de la fiche à droite.
// Le rang suit le nombre de révisions notées de l'année : il ne redescend jamais.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { System, Lesson } from '@/types'
import { toDateStr, todayStr } from '@/types'
import { makeScheduleResolver } from '@/lib/schedule'
import { buildSubjectColorMap } from '@/lib/subjectColors'
import { normalizeYear, scopeToYear } from '@/lib/year'
import { currentSemestre } from '@/lib/semestre'
import { reviewDate } from '@/lib/restDays'
import PageLoader from '@/components/PageLoader'
import './styles.css'

type Semestre = 1 | 2 | 'year'
type Step = { score?: number; ok?: boolean; date?: string } | null

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
function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86400000)
}
function mondayOf(today: string): string {
  const d = new Date(today + 'T12:00:00')
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return toDateStr(d)
}

// État d'un livre : propre, à revoir aujourd'hui, ou poussiéreux (1 à 3).
type Dust = 0 | 1 | 2 | 3
type BookStep = { j: number; score: number | null; date: string | null; skipped: boolean }
type Book = {
  id: string; name: string; sysId: string
  w: number; h: number; c: string
  done: number; last: number | null
  next: string | null; late: number; dueToday: boolean; dust: Dust; fresh: boolean
  steps: BookStep[]
}

const BOOK_GAP = 3
const D = { padX: 52, padY: 38, label: 158, rowsPad: 12, rowH: 82, rowGap: 6, shelfPad: 8, shelfGap: 6, legend: 44, minLabelH: 52 }
const bookWidth = (done: number) => 11 + Math.min(done, 6) * 2

function rowsOf(books: Book[], innerW: number, gap: number): Book[][] {
  const rows: Book[][] = []
  let cur: Book[] = [], w = 0
  for (const b of books) {
    if (cur.length && w + b.w > innerW) { rows.push(cur); cur = []; w = 0 }
    cur.push(b); w += b.w + gap
  }
  if (cur.length || rows.length === 0) rows.push(cur)
  return rows
}

function fitScale(cw: number, ch: number, shelves: Book[][]): number {
  if (cw <= 0 || ch <= 0) return 1
  const heightAt = (s: number) => {
    const avail = cw / s - D.label - D.rowsPad
    let h = D.legend
    shelves.forEach((books, i) => {
      const rows = rowsOf(books, avail, BOOK_GAP).length
      h += Math.max(rows * D.rowH + (rows - 1) * D.rowGap, D.minLabelH) + D.shelfPad + (i ? D.shelfGap : 0)
    })
    return h * s
  }
  if (heightAt(1) <= ch) return 1
  let lo = 0.15, hi = 1
  for (let k = 0; k < 22; k++) { const m = (lo + hi) / 2; if (heightAt(m) <= ch) lo = m; else hi = m }
  return lo
}

const SCORE_COL: Record<number, string> = { 1: '#C0564B', 2: '#D98A3A', 3: '#D9B24A', 4: '#7AA56B', 5: '#2F7A55' }

export default function BibliothequePage() {
  const supabase = createClient()
  const router = useRouter()
  const [systems, setSystems] = useState<System[]>([])
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [loading, setLoading] = useState(true)
  const [semestre, setSemestre] = useState<Semestre>(currentSemestre)
  const [selId, setSelId] = useState<string | null>(null)
  const today = useMemo(() => todayStr(), [])
  const [box, setBox] = useState({ w: 0, h: 0, phone: false })
  const roRef = useRef<ResizeObserver | null>(null)
  const caseRef = useCallback((el: HTMLElement | null) => {
    if (!el) return
    roRef.current?.disconnect()
    const sync = () => setBox({ w: el.clientWidth, h: el.clientHeight, phone: window.matchMedia('(max-width: 768px)').matches })
    sync()
    roRef.current = new ResizeObserver(sync)
    roRef.current.observe(el)
  }, [])

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
    if (!selId) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelId(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selId])

  useEffect(() => {
    let off = false
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const [{ data: sys }, { data: les }, { data: prof }] = await Promise.all([
        supabase.from('systems').select('*').eq('user_id', user.id).order('semestre').order('created_at'),
        supabase.from('lessons').select('id, name, system_id, steps, learn_date, skips, postpones, created_at').eq('user_id', user.id),
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

  // Un livre par fiche, avec son état.
  const books = useMemo(() => {
    const out: Book[] = []
    for (const l of lessons) {
      const raw = (Array.isArray(l.steps) ? l.steps : []) as Step[]
      const j = schedOf(l.system_id)
      const skips = Array.isArray(l.skips) ? l.skips : []
      const post = (l.postpones && typeof l.postpones === 'object') ? l.postpones as Record<string, string> : {}
      const steps: BookStep[] = j.map((off, i) => {
        const sc = officialScore(raw[i])
        const planned = post[String(i)] ?? (l.learn_date ? reviewDate(l.learn_date, off) : null)
        return { j: off, score: sc, date: sc ? (raw[i]?.date ?? planned) : planned, skipped: skips.includes(i) }
      })
      const done = steps.filter(s => s.score).length
      let last: number | null = null
      steps.forEach(s => { if (s.score) last = s.score })
      const nextStep = steps.find(s => !s.score && !s.skipped)
      const next = nextStep?.date ?? null
      const late = next && next < today ? daysBetween(next, today) : 0
      const dust: Dust = late === 0 ? 0 : late <= 3 ? 1 : late <= 10 ? 2 : 3
      // Fraîchement révisé (aujourd'hui ou hier) : il brille.
      const lastDate = steps.filter(s => s.score && s.date).map(s => s.date as string).sort().pop() ?? null
      const fresh = !!lastDate && daysBetween(lastDate, today) <= 1
      const base = colorOf.get(l.system_id) || '#3E6F9C'
      const r = hash(l.id)
      out.push({
        id: l.id, name: l.name, sysId: l.system_id,
        w: bookWidth(done), h: 52 + Math.round(hash(l.id + 'h') * 14),
        c: done === 0 ? shade(base, 0.45) : shade(base, (r - 0.55) * 0.45),
        done, last, next, late, dueToday: next === today, dust, fresh, steps,
      })
    }
    return out
  }, [lessons, schedOf, colorOf, today])

  // Révisions notées (pour le rang, la série et la semaine)
  const revDates = useMemo(() => {
    const ds: string[] = []
    books.forEach(b => b.steps.forEach(s => { if (s.score) ds.push(s.date ?? '') }))
    return ds
  }, [books])
  const totalRev = revDates.length

  const streak = useMemo(() => {
    const set = new Set(revDates.filter(Boolean))
    let n = 0
    const d = new Date(today + 'T12:00:00')
    if (!set.has(today)) d.setDate(d.getDate() - 1) // la série tient jusqu'à ce soir
    while (set.has(toDateStr(d))) { n++; d.setDate(d.getDate() - 1) }
    const sorted = Array.from(set).sort()
    let best = 0, run = 0, prev = ''
    for (const x of sorted) { run = prev && daysBetween(prev, x) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = x }
    return { n, best, today: set.has(today) }
  }, [revDates, today])

  const weekN = useMemo(() => { const mon = mondayOf(today); return revDates.filter(d => d && d >= mon).length }, [revDates, today])

  const shelves = useMemo(() => {
    const list = semestre === 'year' ? systems : systems.filter(s => s.semestre === semestre)
    return list.map(s => {
      const bs = books.filter(b => b.sysId === s.id).sort((a, b) => b.done - a.done || a.name.localeCompare(b.name))
      const dusty = bs.filter(b => b.dust > 0 || b.dueToday)
      return { sys: s, color: colorOf.get(s.id) || '#3E6F9C', books: bs, dusty }
    }).sort((a, b) => b.books.length - a.books.length)
  }, [systems, semestre, books, colorOf])

  const dustyTotal = shelves.reduce((n, s) => n + s.dusty.length, 0)
  const sel = selId ? books.find(b => b.id === selId) ?? null : null
  const selSys = sel ? systems.find(s => s.id === sel.sysId) : null

  const rankIdx = RANKS.reduce((acc, r, i) => (totalRev >= r.at ? i : acc), 0)
  const rank = RANKS[rankIdx]
  const next = RANKS[rankIdx + 1] ?? null
  const progress = next ? (totalRev - rank.at) / (next.at - rank.at) : 1

  const gap = box.phone ? 2 : BOOK_GAP
  const scale = box.phone ? 1 : fitScale(box.w - D.padX, box.h - D.padY, shelves.map(s => s.books))
  const innerW = box.phone ? box.w - 24 : (box.w - D.padX) / scale
  const rowW = innerW - (box.phone ? 0 : D.label) - D.rowsPad
  const fitStyle: React.CSSProperties = box.phone || !box.w ? {} : { width: innerW, transform: `scale(${scale})`, transformOrigin: 'top left' }

  if (loading) return <div className="bib-page"><PageLoader label="Ouverture de ta bibliothèque…" /></div>

  let delay = 0
  const dustTxt = (b: Book) => b.dueToday ? "À réviser aujourd'hui"
    : b.late > 0 ? `Poussiéreux depuis ${b.late} jour${b.late > 1 ? 's' : ''}`
    : !b.next ? 'Toutes les révisions faites'
    : `Prochaine révision ${daysBetween(today, b.next) === 1 ? 'demain' : `dans ${daysBetween(today, b.next)} jours`}`

  return (
    <div className="bib-page">
      <header className="bib-head">
        <div>
          <h1>Ta bibliothèque</h1>
          <p>Chaque fiche est un livre. Il prend la poussière quand tu le laisses en retard, une révision le fait briller.</p>
        </div>
        {dustyTotal > 0 && (
          <Link className="bib-dust-all" href={`/dashboard/focus?lessons=${shelves.flatMap(s => s.dusty.map(b => b.id)).join(',')}`}>
            Dépoussiérer {dustyTotal} livre{dustyTotal > 1 ? 's' : ''}
          </Link>
        )}
      </header>

      <div className="bib-grid">
        <section className="bib-case" aria-label="Étagères" ref={caseRef} onClick={() => setSelId(null)}>
          <div className="bib-fit" style={fitStyle}>
            {shelves.length === 0 && (
              <div className="bib-case-empty">
                Crée tes matières et tes fiches, chaque fiche posera un livre ici.
                <Link href="/dashboard/fiches">Aller aux fiches</Link>
              </div>
            )}
            {shelves.map(({ sys, color, books: bs, dusty }) => {
              const rows = rowsOf(bs, rowW, gap)
              return (
                <div className="bib-shelf" key={sys.id}>
                  <div className="bib-shelf-lbl">
                    <div className="bib-shelf-name"><i style={{ background: color }} /><span>{sys.name}</span></div>
                    <div className="bib-shelf-n">
                      {bs.length === 0 ? 'aucun livre' : `${bs.length} livre${bs.length > 1 ? 's' : ''}`}
                      {dusty.length > 0 && <><br /><b className="bib-shelf-dusty">{dusty.length} poussiéreux</b></>}
                    </div>
                    {dusty.length > 0 && (
                      <Link className="bib-shelf-go" href={`/dashboard/focus?lessons=${dusty.map(b => b.id).join(',')}`} onClick={e => e.stopPropagation()}>
                        Dépoussiérer
                      </Link>
                    )}
                  </div>
                  <div className="bib-shelf-rows">
                    {rows.map((row, ri) => (
                      <div key={ri}>
                        <div className="bib-books">
                          {row.map(b => {
                            const d = Math.min(delay, 1200); delay += 8
                            const cls = `bib-book dust-${b.dust}${b.dueToday ? ' due' : ''}${b.fresh ? ' fresh' : ''}${b.done === 0 ? ' blank' : ''}${selId === b.id ? ' on' : ''}`
                            return (
                              <button key={b.id} type="button" className={cls} title={b.name}
                                aria-label={`${b.name}, ${dustTxt(b)}`}
                                onClick={e => { e.stopPropagation(); setSelId(selId === b.id ? null : b.id) }}
                                style={{ width: box.phone ? Math.max(6, Math.round(b.w * .7)) : b.w, height: box.phone ? Math.round(b.h * .68) : b.h, background: b.c, animationDelay: `${d}ms` }}>
                                {b.last === 5 && <span className="bib-gold" />}
                                <span className="bib-bands" />
                                {b.dust > 0 && <span className="bib-dust" />}
                              </button>
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
              <span><i className="lg-book" /><i className="lg-book lg-thick" />Plus il est épais, plus tu l&apos;as révisé</span>
              <span><i className="lg-book lg-dust" />En retard, il prend la poussière</span>
              <span><i className="lg-book lg-gold" />Dernière note 5/5</span>
              <span className="bib-legend-hint">Clique sur un livre</span>
            </div>
          </div>
        </section>

        <aside className="bib-side">
          {sel && selSys ? (
            <div className="bib-detail" key={sel.id}>
              <button type="button" className="bib-detail-x" aria-label="Fermer" onClick={() => setSelId(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" strokeLinecap="round"/></svg>
              </button>
              <div className="bib-detail-sys"><i style={{ background: colorOf.get(sel.sysId) || '#3E6F9C' }} />{selSys.name}</div>
              <h2 className="bib-detail-title">{sel.name}</h2>
              <div className={`bib-detail-state${sel.dust > 0 ? ' late' : sel.dueToday ? ' due' : ''}`}>{dustTxt(sel)}</div>

              <div className="bib-detail-stats">
                <div><b>{sel.done}</b><span>révision{sel.done > 1 ? 's' : ''}</span></div>
                <div><b>{sel.last ? `${sel.last}/5` : '-'}</b><span>dernière note</span></div>
                <div><b>{sel.next ? fmtDay(sel.next) : '-'}</b><span>{sel.late > 0 ? 'était prévue' : 'prochaine'}</span></div>
              </div>

              <div className="bib-kicker">Paliers</div>
              <ol className="bib-steps">
                {sel.steps.map((s, i) => {
                  const isNext = !s.score && !s.skipped && sel.steps.findIndex(x => !x.score && !x.skipped) === i
                  return (
                    <li key={i} className={`${s.score ? 'ok' : s.skipped ? 'skip' : isNext ? 'next' : 'todo'}`}
                      title={s.date ? fmtDay(s.date) : undefined}>
                      <span className="bib-step-dot" style={s.score ? { background: SCORE_COL[s.score] } : undefined}>{s.score ?? ''}</span>
                      <span className="bib-step-j">J+{s.j}</span>
                    </li>
                  )
                })}
              </ol>

              <div className="bib-detail-actions">
                {sel.next && (
                  <Link className="bib-btn bib-btn-main" href={`/dashboard/focus?lesson=${sel.id}`}>
                    {sel.dust > 0 ? 'Dépoussiérer maintenant' : sel.dueToday ? 'Réviser maintenant' : 'Réviser en avance'}
                  </Link>
                )}
                <Link className="bib-btn" href={`/dashboard/fiches?matiere=${sel.sysId}`}>Voir la matière</Link>
              </div>
            </div>
          ) : (
            <>
              <div className="bib-rank">
                <div className="bib-rank-top">
                  <div className="bib-seal" aria-hidden>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="9" r="6"/><path d="M8.5 14 7 22l5-3 5 3-1.5-8"/></svg>
                  </div>
                  <div>
                    <div className="bib-kicker">Ton rang</div>
                    <div className="bib-rank-name">{rank.name}</div>
                    <div className="bib-rank-n">{totalRev} révision{totalRev > 1 ? 's' : ''} notée{totalRev > 1 ? 's' : ''}</div>
                  </div>
                </div>
                <div className="bib-bar"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
                <div className="bib-bar-lbl">
                  {next
                    ? <><span>Encore <strong>{next.at - totalRev}</strong> avant {next.name}</span><span>{next.at}</span></>
                    : <span>Dernier rang atteint.</span>}
                </div>
              </div>

              <div className="bib-week">
                <div className={`bib-streak${streak.today ? ' lit' : ''}`}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 3.5 5 5.5 5 11a5 5 0 0 1-10 0c0-2.5 1.2-4 2.5-5.2.3 1.6 1.2 2.6 2.3 3C11.2 8 11 5 12 2z" fill="currentColor"/></svg>
                  <b>{streak.n}</b>
                  <span>jour{streak.n > 1 ? 's' : ''} d&apos;affilée{streak.n > 0 && !streak.today ? ', révise aujourd’hui pour la garder' : ''}</span>
                  {streak.best > 1 && <small>Record {streak.best} jours</small>}
                </div>
                <div>
                  <b>+{weekN}</b>
                  <span>révision{weekN > 1 ? 's' : ''} cette semaine</span>
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
                          {st !== 'todo' && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>}
                        </span>
                        <span className="bib-r-txt"><b>{r.name}</b><small>{r.treasure}</small></span>
                        <span className="bib-r-at">{r.at}</span>
                      </li>
                    )
                  })}
                </ol>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

'use client'
// src/app/dashboard/page.tsx
//
// Page d'accueil du dashboard. NE CONTIENT PAS le rail ni la tabbar :
// ils vivent dans dashboard/layout.tsx et sont partagés avec les sous-routes.
// Cette page ne rend QUE le contenu spécifique au dashboard 
// - header (greeting + search + bell)
// - content grid (focal + queue + biblio panel avec étagère 3 rangées)
// - stat-strip

import Link from 'next/link'
import { useEffect, useRef } from 'react'

// ============================================================
// MOCK DATA — TODO: remplacer par les vraies requêtes Supabase
// ============================================================
type Rev = { name: string; mat: string; status: 'overdue' | 'due'; due: string; note: number; state: 's1' | 's2' | 's4' | 's5'; stateLabel: string; step: string; flag?: boolean }
const REVISIONS: Rev[] = [
  { name: 'Glycolyse', mat: 'BIOCHIMIE', status: 'overdue', due: 'EN RETARD 5J', note: 2, state: 's1', stateLabel: 'Fragile', step: 'J+3', flag: true },
  { name: 'Cycle de Krebs', mat: 'BIOCHIMIE', status: 'due', due: "DÛ AUJOURD'HUI", note: 3, state: 's2', stateLabel: 'À consolider', step: 'J+8' },
  { name: 'Système nerveux autonome', mat: 'PHYSIOLOGIE', status: 'due', due: "DÛ AUJOURD'HUI", note: 4, state: 's4', stateLabel: 'Consolidation', step: 'J+5' },
  { name: 'Anatomie générale', mat: 'ANATOMIE', status: 'due', due: "DÛ AUJOURD'HUI", note: 4, state: 's4', stateLabel: 'Consolidation', step: 'J+5' },
  { name: 'Acides aminés', mat: 'BIOCHIMIE', status: 'due', due: "DÛ AUJOURD'HUI", note: 5, state: 's5', stateLabel: 'Maîtrisée', step: 'J+13' },
  { name: 'Biophysique des fluides', mat: 'BIOPHYSIQUE', status: 'due', due: "DÛ AUJOURD'HUI", note: 3, state: 's2', stateLabel: 'À consolider', step: 'J+8' },
]
const TODAY = { count: REVISIONS.length, lateCount: 1, minutes: 48, biochimie: 2 }
const STREAK = { days: 12, trend: 2, record: 18 }
const WEAK_POINT = { score: 2.9, subject: 'Biochimie', count: 2 }
const LOAD = { fiches: 23, bars: [40, 80, 25, 55] }
const LIBRARY = { count: 147, total: 2000, treasures: 1, nextTreasure: 300 }

const STATE_TO_LABEL_CLASS: Record<Rev['state'], string> = {
  s1: 'fragile', s2: 'medium', s4: 'consol', s5: 'maitr',
}

// Icônes utilisées par CETTE page (le rail a les siennes dans layout.tsx)
const ICONS = {
  bell: <><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>,
  pulse: <path d="M3 12h4l2 6 4-14 2 8h6" />,
  alert: <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></>,
} as const
type IconKey = keyof typeof ICONS

// ============================================================
// BIBLIOTHÈQUE — étagère 3 rangées × 22 livres
// Rendu en JSX statique : pas de measurement DOM, ça marche toujours.
// Distribution : majorité vert (palette), quelques crème pour le contraste,
// 3 trésors or répartis dans la collection.
// ============================================================
const SHELF_ROWS = 3
const BOOKS_PER_ROW = 22
const TOTAL_SLOTS = SHELF_ROWS * BOOKS_PER_ROW  // 66

const SPINES = ['#1E7A50', '#2E9E6B', '#15573A', '#0F5132', '#247A55', '#3AA06B', '#114A33', '#1B6E49', '#43B57F', '#176E47']

// Pseudo-random déterministe pour des hauteurs/couleurs stables au re-rendu
const rand = (s: number) => { const x = Math.sin(s + 1) * 10000; return x - Math.floor(x) }

type Book = { color: string; height: number; isTreasure: boolean }
const BOOKS: Book[] = Array.from({ length: TOTAL_SLOTS }, (_, idx) => {
  const isTreasure = idx === 8 || idx === 25 || idx === 47   // 3 trésors visibles
  const isCream = !isTreasure && idx % 11 === 5
  const height = 78 + Math.floor(rand(idx * 1.7) * 20)        // 78-98% du row_h
  let color: string
  if (isTreasure) color = 'linear-gradient(180deg,#EBCF80,#C2912F)'
  else if (isCream) color = '#E8E2CF'
  else color = SPINES[idx % SPINES.length]
  return { color, height, isTreasure }
})

export default function Dashboard() {
  const biblioFillRef = useRef<HTMLDivElement>(null)
  const barsRef = useRef<HTMLDivElement>(null)

  // Count-up au mount
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.dash-root .count')
    els.forEach(el => {
      const to = parseFloat(el.dataset.target || '0')
      const isFloat = String(to).includes('.')
      const dur = 1100
      const st = performance.now()
      const tick = (now: number) => {
        const p = Math.min((now - st) / dur, 1)
        const ease = 1 - Math.pow(1 - p, 3)
        const v = to * ease
        el.textContent = isFloat ? v.toFixed(1) : Math.round(v).toLocaleString('fr-FR')
        if (p < 1) requestAnimationFrame(tick)
      }
      setTimeout(() => requestAnimationFrame(tick), 320)
    })
  }, [])

  // Biblio fill bar
  useEffect(() => {
    const pct = Math.min(100, (LIBRARY.count / LIBRARY.total) * 100)
    setTimeout(() => { if (biblioFillRef.current) biblioFillRef.current.style.width = pct + '%' }, 600)
  }, [])

  // Charge-à-venir bars
  useEffect(() => {
    const bars = barsRef.current?.querySelectorAll<HTMLDivElement>('.stat-bar')
    if (!bars) return
    bars.forEach((b, i) => {
      const h = LOAD.bars[i] + '%'
      b.style.height = '5px'
      setTimeout(() => { b.style.height = h }, 480)
    })
  }, [])

  const Icon = (k: IconKey) => <svg viewBox="0 0 24 24" aria-hidden>{ICONS[k]}</svg>

  return (
    <>
      {/* HEADER */}
      <header className="head reveal r1">
        <div className="head-l">
          <div className="head-eyebrow">
            <span className="live" />Mer. 20 mai 2026 · Sorbonne S1 · {STREAK.days} jours d'affilée
          </div>
          {/* TODO: prénom depuis le profil */}
          <h1 className="head-h1">Bonjour <em>lou</em></h1>
        </div>
        <div className="head-r">
          <button className="cmd" type="button" aria-label="Rechercher">⌕ Rechercher <kbd>⌘K</kbd></button>
          <button className="icon-btn" type="button" aria-label="Notifications">{Icon('bell')}</button>
        </div>
      </header>

      <div className="content">
        {/* COLONNE GAUCHE — Focal + Queue */}
        <div className="col-l">
          {/* FOCAL */}
          <section className="focal reveal r2">
            <svg className="focal-ekg" viewBox="0 0 760 70" preserveAspectRatio="none" aria-hidden>
              <path d="M0,44 L200,44 L214,44 L223,12 L237,66 L249,30 L260,44 L440,44 L454,44 L463,16 L476,64 L489,32 L500,44 L660,44 L673,44 L682,8 L695,68 L708,36 L720,44 L760,44" />
            </svg>
            <div className="focal-row">
              <div>
                <div className="focal-k">Aujourd'hui · ta prochaine action</div>
                <div className="focal-line">
                  <span className="focal-num"><span className="count" data-target={String(TODAY.count)}>0</span></span>
                  <span className="focal-txt">révisions à faire</span>
                </div>
                <div className="focal-meta">
                  <span className="hot">{TODAY.lateCount} EN RETARD</span>
                  <span className="sep">·</span>~{TODAY.minutes} MIN
                  <span className="sep">·</span>{TODAY.biochimie} BIOCHIMIE
                </div>
              </div>
              <div className="focal-actions">
                <Link href="/dashboard/focus" className="btn-go">Démarrer la session <span className="arrow">→</span></Link>
                <Link href="/dashboard/calendar" className="link-soft">Réorganiser ma file</Link>
              </div>
            </div>
          </section>

          {/* QUEUE */}
          <section className="qblock reveal r3">
            <div className="sec-head">
              <div className="sec-label">Ta file du jour</div>
              <Link href="/dashboard/calendar" className="sec-link">TOUT VOIR →</Link>
            </div>
            <div className="rev-list">
              {REVISIONS.map((r, i) => (
                <Link href={`/dashboard/fiches?focus=${encodeURIComponent(r.name)}`} key={i} className="rev">
                  <div className={'rev-bar ' + r.state} />
                  <div>
                    <div className="rev-name">
                      {r.flag && <span className="flag">!</span>}
                      {r.name}
                    </div>
                    <div className="rev-meta">
                      {r.mat} · <span className={r.status}>{r.due}</span> · {r.note}/5
                    </div>
                  </div>
                  <div className={'rev-state ' + STATE_TO_LABEL_CLASS[r.state]}>{r.stateLabel}</div>
                  <div className="rev-step">{r.step}</div>
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* COLONNE DROITE — Biblio (étagère 3 rangées, JSX statique fiable) */}
        <div className="col-r reveal r3">
          <section className="biblio">
            <div className="biblio-head">
              <div className="biblio-title">Ta bibliothèque</div>
              <Link href="/library" className="biblio-link">LE MEUBLE →</Link>
            </div>
            <div className="biblio-stage">
              <div className="bookcase">
                {Array.from({ length: SHELF_ROWS }).map((_, r) => (
                  <div key={r} className="shelf-row">
                    {Array.from({ length: BOOKS_PER_ROW }).map((_, c) => {
                      const idx = r * BOOKS_PER_ROW + c
                      const b = BOOKS[idx]
                      return (
                        <div
                          key={c}
                          className={'bk' + (b.isTreasure ? ' treasure' : '')}
                          style={{
                            background: b.color,
                            height: b.height + '%',
                            animationDelay: 200 + idx * 12 + 'ms',
                          }}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="biblio-foot">
              <div className="biblio-row">
                <span className="biblio-num"><span className="count" data-target={String(LIBRARY.count)}>0</span></span>
                <span className="biblio-suffix">/ {LIBRARY.total} ouvrages</span>
                <span className="biblio-treasures">
                  <strong>{LIBRARY.treasures}/6 TRÉSORS</strong> · prochain au {LIBRARY.nextTreasure}
                </span>
              </div>
              <div className="biblio-bar">
                <div className="biblio-fill" ref={biblioFillRef} />
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* STAT STRIP */}
      <div className="stat-strip reveal r4" ref={barsRef}>
        <div className="stat">
          <div className="stat-icon teal">{Icon('pulse')}</div>
          <div>
            <div className="stat-label">Régularité</div>
            <div className="stat-value">
              <span className="stat-num teal"><span className="count" data-target={String(STREAK.days)}>0</span></span>
              <span className="stat-unit">jours d'affilée</span>
              <span className="stat-trend">↑ +{STREAK.trend}</span>
            </div>
            <div className="stat-sub">Record : {STREAK.record} jours</div>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icon coral">{Icon('alert')}</div>
          <div>
            <div className="stat-label">Point faible</div>
            <div className="stat-value">
              <span className="stat-num coral">{WEAK_POINT.score.toFixed(1)}</span>
              <span className="stat-unit">/5 · {WEAK_POINT.subject}</span>
            </div>
            <div className="stat-sub"><span className="frag">Fragile</span> — {WEAK_POINT.count} fiches à retravailler</div>
          </div>
          <Link href="/dashboard/stats" className="stat-link">VOIR →</Link>
        </div>
        <div className="stat">
          <div>
            <div className="stat-label">Charge à venir · 4 sem.</div>
            <div className="stat-value">
              <span className="stat-num">{LOAD.fiches}</span>
              <span className="stat-unit">fiches programmées</span>
            </div>
            <div className="stat-sub">Charge équilibrée</div>
          </div>
          <div className="stat-bars">
            {LOAD.bars.map((h, i) => (
              <div className="stat-bar-col" key={i}>
                <div className={'stat-bar' + (h < 60 ? ' dim' : '')} />
                <span className="stat-bar-lbl">S{i + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

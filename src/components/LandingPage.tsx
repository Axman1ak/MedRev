'use client'
// src/components/LandingPage.tsx
//
// Landing "Bibliothèque de nuit" — refonte juin 2026.
// Narration : chaque soir de travail devient un livre dans ta bibliothèque.
// - Héro immersif : la vraie bibliothèque (BibliothecaSvg) en fond de nuit,
//   entrée séquencée en CSS pur.
// - Bandeau réforme 2027 : voie unique + contrôle continu → la régularité
//   devient LE levier, et MedRev la mesure (indice, rang, série).
// - La méthode en 3 actes (reveal au scroll, visuels SVG animés).
// - Les 6 rangs d'érudit (sceaux qui se révèlent en cascade).
// - Features compactes, pricing teaser, CTA final.
//
// ⚠ landing-styles.css reste importé (la nav/footer marketing et /auth
// l'utilisent) mais N'EST PAS modifié. Tout le nouveau style vit dans
// landing-night.css (classes ln-*), avec quelques overrides SCOPÉS .ln-page.

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import MarketingNav from '@/components/MarketingNav'
import MarketingFooter from '@/components/MarketingFooter'
import BibliothecaSvg from '@/components/BibliothecaSvg'
import './landing-styles.css'
import './landing-night.css'

// ============ Reveal au scroll (IntersectionObserver → classe .in) ============
function useReveal() {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const root = ref.current
    if (!root || typeof IntersectionObserver === 'undefined') return
    const els = Array.from(root.querySelectorAll('.rv'))
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        }
      },
      { threshold: 0.18 }
    )
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])
  return ref
}

// ============ Sceau de rang (copie locale, autonome) ============
function Seal({ color, tier }: { color: string; tier: number }) {
  return (
    <svg viewBox="0 0 120 120" className="ln-seal" aria-hidden="true">
      <path d="M 22 48 L 8 60 L 22 72 L 28 66 L 21 60 L 28 54 Z" fill={color} opacity="0.55" />
      <path d="M 98 48 L 112 60 L 98 72 L 92 66 L 99 60 L 92 54 Z" fill={color} opacity="0.55" />
      <g transform="rotate(45 60 60)">
        <rect x="29" y="29" width="62" height="62" rx="7" fill={color} opacity="0.22" />
        <rect x="37" y="37" width="46" height="46" rx="6" fill={color} opacity="0.5" />
        <rect x="45" y="45" width="30" height="30" rx="5" fill={color} />
      </g>
      <path d="M 60 39 L 75 60 L 60 60 Z" fill="rgba(255,255,255,0.4)" />
      <path d="M 60 60 L 60 81 L 45 60 Z" fill="rgba(0,0,0,0.18)" />
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
    </svg>
  )
}

const RANKS = [
  { name: 'Apprenti', color: '#8CA4BC', tier: 3 },
  { name: 'Copiste', color: '#B86448', tier: 3 },
  { name: 'Scribe', color: '#7FB0D4', tier: 2 },
  { name: 'Lettré', color: '#D9B24A', tier: 2 },
  { name: 'Érudit', color: '#7AA56B', tier: 1 },
  { name: 'Maître', color: '#15304E', tier: 1 },
]

export default function LandingPage() {
  const pageRef = useReveal()

  return (
    <div className="lp-page ln-page" ref={pageRef}>
      <MarketingNav current="home" />

      {/* ============ HÉRO : LA BIBLIOTHÈQUE DE NUIT ============ */}
      <section className="ln-hero">
        <div className="ln-hero-bib" aria-hidden="true">
          <BibliothecaSvg fichesCount={760} preserveAspectRatio="xMidYMid slice" className="ln-hero-svg" />
        </div>
        <div className="ln-hero-veil" aria-hidden="true" />
        <div className="ln-hero-glow" aria-hidden="true" />

        <div className="ln-hero-inner">
          <span className="ln-kicker ln-h1a">
            1re année santé · prêt pour la réforme 2027
          </span>
          <h1 className="ln-h1 ln-h1b">
            Chaque soir de travail
            <span className="ln-h1-line2">devient <em>un livre</em>.</span>
          </h1>
          <p className="ln-sub ln-h1c">
            Importe tes cours : MedRev écrit tes <strong>30 QCM</strong>, programme
            tes <strong>14 paliers de révision</strong> et mesure ta régularité —
            le levier qui compte avec le contrôle continu.
          </p>
          <div className="ln-ctas ln-h1d">
            <Link href="/auth" className="ln-btn-primary">Commencer gratuit →</Link>
            <Link href="/methode" className="ln-btn-ghost">La méthode</Link>
          </div>
          <div className="ln-scrollhint ln-h1e" aria-hidden="true">
            <span className="ln-scrollhint-dot" />
          </div>
        </div>
      </section>

      {/* ============ BANDEAU RÉFORME 2027 ============ */}
      <section className="ln-reform">
        <div className="ln-reform-inner">
          <div className="ln-reform-item rv">
            <div className="ln-reform-h">Fin du PASS/LAS en 2027</div>
            <p>Une <strong>voie unique</strong> pour toutes les filières santé,
            harmonisée au niveau national.</p>
          </div>
          <div className="ln-reform-item rv rv-d1">
            <div className="ln-reform-h">Plus de concours unique</div>
            <p>Le classement se joue sur <strong>tout le parcours</strong> :
            chaque semaine de travail compte.</p>
          </div>
          <div className="ln-reform-item rv rv-d2">
            <div className="ln-reform-h">La régularité devient le levier</div>
            <p>MedRev la <strong>mesure et la construit</strong> : indice de
            préparation, série de jours, plan jusqu&apos;aux examens.</p>
          </div>
        </div>
      </section>

      {/* ============ LA MÉTHODE EN 3 ACTES ============ */}
      <section className="ln-acts">
        <h2 className="ln-h2 rv">Trois gestes, <em>chaque jour</em></h2>

        {/* Acte 1 — l'IA écrit tes QCM */}
        <div className="ln-act rv">
          <div className="ln-act-visual" aria-hidden="true">
            <svg viewBox="0 0 280 170" className="ln-act-svg">
              <rect x="20" y="18" width="240" height="134" rx="10" fill="#E9EFF5" />
              <rect x="20" y="18" width="240" height="134" rx="10" fill="none" stroke="#7FB0D4" strokeWidth="1.4" opacity="0.5" />
              {[0, 1, 2, 3, 4].map(i => (
                <rect
                  key={i}
                  className={`ln-ink ln-ink-${i}`}
                  x="44"
                  y={44 + i * 22}
                  width={150 - i * 12}
                  height="5"
                  rx="2.5"
                  fill="#2E5570"
                />
              ))}
              <g className="ln-actquill" transform="translate(214 118)">
                <path d="M 0 0 Q 5 -14 2 -34 Q 14 -44 22 -39 Q 12 -24 7 -7 Z" fill="#C8DCEC" stroke="#7FB0D4" strokeWidth="1" />
              </g>
            </svg>
          </div>
          <div className="ln-act-copy">
            <span className="ln-act-num">01</span>
            <h3>Importe ton cours, l&apos;IA écrit tes QCM</h3>
            <p>
              Vidéo de la rediffusion + poly PDF → <strong>30 QCM type
              examen</strong>, tirés de <em>tes</em> supports. Chaque question
              pointe vers le timestamp de la vidéo ou la page du PDF.
            </p>
          </div>
        </div>

        {/* Acte 2 — la courbe J planifie */}
        <div className="ln-act ln-act-rev rv">
          <div className="ln-act-visual" aria-hidden="true">
            <svg viewBox="0 0 280 170" className="ln-act-svg">
              <line x1="28" y1="92" x2="252" y2="92" stroke="#3E6E96" strokeWidth="2" opacity="0.5" />
              {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                <g key={i} className={`ln-jdot ln-jdot-${i}`}>
                  <circle cx={36 + i * 30} cy="92" r="8" fill="#7FB0D4" />
                  <text x={36 + i * 30} y="122" textAnchor="middle" fontSize="10" fill="#8FB8D8" fontFamily="var(--font-hanken), sans-serif">
                    {['J0', 'J1', 'J3', 'J7', 'J15', 'J30', 'J60', 'J120'][i]}
                  </text>
                </g>
              ))}
            </svg>
          </div>
          <div className="ln-act-copy">
            <span className="ln-act-num">02</span>
            <h3>La courbe J planifie tes révisions</h3>
            <p>
              À partir du jour où tu apprends une fiche, <strong>14
              paliers</strong> se programment seuls — J1, J3, J7… jusqu&apos;à
              J+120. Le calendrier accueille aussi tes <strong>TD de fac</strong>{' '}
              et s&apos;imprime d&apos;un clic.
            </p>
          </div>
        </div>

        {/* Acte 3 — le sceau et le livre */}
        <div className="ln-act rv">
          <div className="ln-act-visual" aria-hidden="true">
            <svg viewBox="0 0 280 170" className="ln-act-svg">
              <path d="M 60 40 L 60 130 Q 100 138 140 132 Q 180 138 220 130 L 220 40 Q 180 32 140 38 Q 100 32 60 40 Z" fill="#1B2C40" stroke="#7FB0D4" strokeWidth="1" opacity="0.95" />
              <path d="M 68 46 Q 104 39 138 44 L 138 124 Q 104 130 68 122 Z" fill="#E9EFF5" />
              <path d="M 142 44 Q 176 39 212 46 L 212 122 Q 176 130 142 124 Z" fill="#E2EAF2" />
              <g className="ln-stamp">
                <circle cx="178" cy="84" r="20" fill="#7AA56B" stroke="rgba(0,0,0,0.3)" strokeWidth="1" />
                <text x="178" y="91" textAnchor="middle" fontSize="18" fontWeight="700" fill="rgba(8,14,24,0.6)" fontFamily="var(--font-bricolage), serif">5</text>
              </g>
            </svg>
          </div>
          <div className="ln-act-copy">
            <span className="ln-act-num">03</span>
            <h3>Note d&apos;un sceau, range le livre</h3>
            <p>
              En session Focus, un livre <strong>s&apos;écrit pendant que tu
              révises</strong>. Tu notes la fiche en apposant un sceau de cire,
              et le livre vole se ranger dans ta <strong>bibliothèque</strong> —
              2000 livres pour boucler l&apos;année, 6 trésors à débloquer.
            </p>
          </div>
        </div>
      </section>

      {/* ============ LES RANGS ============ */}
      <section className="ln-ranks">
        <h2 className="ln-h2 ln-h2-light rv">D&apos;Apprenti à <em>Maître</em></h2>
        <p className="ln-ranks-sub rv">
          Ton indice de préparation combine maîtrise, couverture et assiduité.
          Un jour compte à partir de <strong>10 minutes</strong> de révision —
          tiens ta série, fais monter ton rang.
        </p>
        <div className="ln-ranks-row">
          {RANKS.map((r, i) => (
            <div key={r.name} className={`ln-rank rv rv-d${i % 4}`}>
              <Seal color={r.color} tier={r.tier} />
              <span className="ln-rank-name">{r.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ============ FEATURES COMPACTES ============ */}
      <section className="ln-features">
        <h2 className="ln-h2 rv">Tout ce qu&apos;il faut, <em>rien de plus</em></h2>
        <div className="ln-features-grid">
          {[
            { h: 'Simulateur d’examen', p: 'QCM générés, « Ce que j’ai raté », ou tes annales importées — barème officiel, multi-coche, chrono.' },
            { h: 'Annales en un glisser', p: 'Importe un vrai sujet PDF : les questions et le corrigé en sont extraits automatiquement.' },
            { h: 'Flashcards recto/verso', p: 'Tes propres cartes pour les définitions et valeurs seuils, avec session de révision intégrée.' },
            { h: 'Retour à la source', p: 'Une question ratée ? Saute au timestamp exact de la vidéo ou à la page du PDF.' },
            { h: 'Chapitres libres', p: 'Organise tes fiches selon le découpage de ta fac ou de ta prépa — pas l’inverse.' },
            { h: 'Plan jusqu’aux examens', p: 'Fixe ta date : MedRev projette ton score le jour J au rythme actuel.' },
          ].map((f, i) => (
            <div key={f.h} className={`ln-feature rv rv-d${i % 3}`}>
              <h3>{f.h}</h3>
              <p>{f.p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ PRICING TEASER ============ */}
      <section className="ln-pricing">
        <div className="ln-pricing-card rv">
          <div className="ln-pricing-col">
            <div className="ln-pricing-name">Gratuit</div>
            <div className="ln-pricing-price">0 €</div>
            <p>Fiches et planning illimités · 10 générations IA · 3 sessions simulateur</p>
          </div>
          <div className="ln-pricing-sep" aria-hidden="true" />
          <div className="ln-pricing-col">
            <div className="ln-pricing-name">Premium</div>
            <div className="ln-pricing-price">69 €<small>/an</small></div>
            <p>IA illimitée · examens blancs · plan jusqu&apos;aux examens · vidéos longues</p>
          </div>
          <Link href="/pricing" className="ln-btn-ghost ln-pricing-cta">Comparer →</Link>
        </div>
      </section>

      {/* ============ CTA FINAL ============ */}
      <section className="ln-final">
        <div className="ln-final-inner rv">
          <h2 className="ln-h2 ln-h2-light">Ta bibliothèque <em>t&apos;attend</em>.</h2>
          <p className="ln-final-sub">
            Gratuit pour commencer. Deux minutes pour créer ta première fiche.
          </p>
          <Link href="/auth" className="ln-btn-primary ln-btn-big">Commencer gratuit →</Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}

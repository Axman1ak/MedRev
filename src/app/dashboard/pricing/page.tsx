'use client'
// src/app/dashboard/pricing/page.tsx
//
// Page Pricing — Free vs Premium (Annuel 69 € recommandé / Mensuel 9,99 €).
// Branche /api/stripe/checkout existant qui sait maintenant router vers le
// bon price ID via le param `plan`. Le webhook /api/stripe/webhook flippe
// profile.plan à 'pro' après checkout réussi.

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types'
import {
  FREE_AI_GENERATIONS_LIMIT,
  FREE_SIMULATOR_SESSIONS_LIMIT,
  FREE_VIDEO_SIZE_MB,
  FREE_PDF_SIZE_MB,
} from '@/types'
import './styles.css'

// Wrapper exporté par défaut : enveloppe le contenu dans <Suspense> pour
// satisfaire la contrainte Next.js 14 App Router quand on utilise
// useSearchParams() (lecture de ?success=true / ?cancelled=true post-Stripe).
export default function PricingPage() {
  return (
    <Suspense fallback={<div className="pri-page"><div className="pri-loading">Chargement…</div></div>}>
      <PricingContent />
    </Suspense>
  )
}

type StripePlan = 'monthly' | 'yearly'

function PricingContent() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState<StripePlan | null>(null)
  const [banner, setBanner] = useState<{ kind: 'ok' | 'info'; text: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (cancelled) return
      if (data) setProfile(data as Profile)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [supabase, router])

  // Bannières post-Stripe (?success=true ou ?cancelled=true)
  useEffect(() => {
    if (!searchParams) return
    if (searchParams.get('success') === 'true') {
      setBanner({ kind: 'ok', text: 'Paiement réussi. Ton plan Premium est activé — bienvenue.' })
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/dashboard/pricing')
      }
    } else if (searchParams.get('cancelled') === 'true') {
      setBanner({ kind: 'info', text: 'Paiement annulé. Tu peux réessayer quand tu veux.' })
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/dashboard/pricing')
      }
    }
  }, [searchParams])

  async function handleUpgrade(plan: StripePlan) {
    setCheckoutLoading(plan)
    setBanner(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.url) {
        setBanner({ kind: 'info', text: json?.error || 'Impossible d\'ouvrir le paiement. Réessaie dans un instant.' })
        setCheckoutLoading(null)
        return
      }
      window.location.href = json.url as string
    } catch {
      setBanner({ kind: 'info', text: 'Connexion impossible. Vérifie ta connexion et réessaie.' })
      setCheckoutLoading(null)
    }
  }

  const isPro = profile?.plan === 'pro'

  if (loading) {
    return (
      <div className="pri-page">
        <div className="pri-loading">Chargement…</div>
      </div>
    )
  }

  return (
    <div className="pri-page">
      <div className="pri-wrap">
        {/* HEADER */}
        <header className="pri-head">
          <div className="pri-kicker">Tarifs</div>
          <h1 className="pri-h1">
            Choisis le plan <em>qui te porte</em> jusqu&apos;au concours
          </h1>
          <p className="pri-sub">
            La P1 est une année difficile. MedRev t&apos;accompagne avec un
            plan gratuit pour découvrir, et du Premium pour libérer toute
            l&apos;IA quand tu en as besoin.
          </p>
        </header>

        {/* BANNER — feedback post-Stripe */}
        {banner && (
          <div className={`pri-banner pri-banner-${banner.kind}`} role="status">
            {banner.text}
          </div>
        )}

        {/* === CARDS (3 plans : Gratuit / Annuel recommandé / Mensuel) === */}
        <div className="pri-cards">
          {/* GRATUIT */}
          <article className={`pri-card${!isPro ? ' pri-card-current' : ''}`}>
            <div className="pri-card-h">
              <div className="pri-card-tag">Pour découvrir</div>
              <h2 className="pri-card-name">Gratuit</h2>
              <div className="pri-card-price">
                <span className="pri-price-num">0</span>
                <span className="pri-price-cur">€</span>
                <span className="pri-price-period">à vie</span>
              </div>
              <p className="pri-card-desc">
                Les bases pour démarrer la P1 sans s&apos;engager. Idéal pour
                voir si MedRev te convient.
              </p>
            </div>
            <ul className="pri-card-list">
              <li><span className="pri-mark ok">✓</span>Matières et fiches illimitées</li>
              <li><span className="pri-mark ok">✓</span>Courbe J + notation 1-5</li>
              <li><span className="pri-mark ok">✓</span>Bibliothèque + sessions Focus illimitées</li>
              <li><span className="pri-mark dim">·</span>{FREE_AI_GENERATIONS_LIMIT} générations QCM IA <em>au total</em></li>
              <li><span className="pri-mark dim">·</span>{FREE_SIMULATOR_SESSIONS_LIMIT} sessions simulateur</li>
              <li><span className="pri-mark dim">·</span>Vidéos jusqu&apos;à {FREE_VIDEO_SIZE_MB} Mo (~30 min)</li>
              <li><span className="pri-mark dim">·</span>PDF jusqu&apos;à {FREE_PDF_SIZE_MB} Mo</li>
            </ul>
            <div className="pri-card-cta">
              {isPro ? (
                <span className="pri-btn pri-btn-disabled">Plan d&apos;essai</span>
              ) : (
                <span className="pri-btn pri-btn-current">Plan actuel</span>
              )}
            </div>
          </article>

          {/* ANNUEL — RECOMMANDÉ */}
          <article className="pri-card pri-card-featured">
            <div className="pri-card-badge">Recommandé</div>
            <div className="pri-card-h">
              <div className="pri-card-tag">Économise 3 mois</div>
              <h2 className="pri-card-name">Annuel</h2>
              <div className="pri-card-price">
                <span className="pri-price-num">69</span>
                <span className="pri-price-cur">€</span>
                <span className="pri-price-period">par an</span>
              </div>
              <div className="pri-card-monthly">
                Soit <strong>5,75 €</strong> par mois.
              </div>
              <p className="pri-card-desc">
                Pour les <em>P1</em> qui s&apos;engagent toute l&apos;année.
                Mêmes fonctionnalités que le Mensuel.
              </p>
            </div>
            <ul className="pri-card-list">
              <li><span className="pri-mark gold">✦</span><strong>Tout du Premium</strong> :</li>
              <li><span className="pri-mark ok">✓</span>Générations QCM IA illimitées</li>
              <li><span className="pri-mark ok">✓</span>Simulateur illimité + Examen blanc</li>
              <li><span className="pri-mark ok">✓</span>Vidéos 250 Mo, PDF sans limite</li>
              <li><span className="pri-mark ok">✓</span>Stats avancées</li>
              <li><span className="pri-mark dim">·</span>Économise 30 € vs Mensuel</li>
            </ul>
            <div className="pri-card-cta">
              {isPro ? (
                <span className="pri-btn pri-btn-current">Plan actuel</span>
              ) : (
                <button
                  type="button"
                  className="pri-btn pri-btn-primary"
                  onClick={() => handleUpgrade('yearly')}
                  disabled={checkoutLoading !== null}
                >
                  {checkoutLoading === 'yearly' ? 'Redirection…' : 'Passer Annuel →'}
                </button>
              )}
            </div>
          </article>

          {/* MENSUEL */}
          <article className="pri-card">
            <div className="pri-card-h">
              <div className="pri-card-tag">Sans engagement</div>
              <h2 className="pri-card-name">Mensuel</h2>
              <div className="pri-card-price">
                <span className="pri-price-num">9,99</span>
                <span className="pri-price-cur">€</span>
                <span className="pri-price-period">par mois</span>
              </div>
              <div className="pri-card-monthly">
                Résiliable à tout moment.
              </div>
              <p className="pri-card-desc">
                Pour tester un mois ou rester flexible. Mêmes fonctionnalités
                que l&apos;Annuel.
              </p>
            </div>
            <ul className="pri-card-list">
              <li><span className="pri-mark gold">✦</span><strong>Tout du Premium</strong> :</li>
              <li><span className="pri-mark ok">✓</span>Générations QCM IA illimitées</li>
              <li><span className="pri-mark ok">✓</span>Simulateur illimité + Examen blanc</li>
              <li><span className="pri-mark ok">✓</span>Vidéos 250 Mo, PDF sans limite</li>
              <li><span className="pri-mark ok">✓</span>Stats avancées</li>
              <li><span className="pri-mark dim">·</span>Sans engagement (résiliable)</li>
            </ul>
            <div className="pri-card-cta">
              {isPro ? (
                <span className="pri-btn pri-btn-current">Plan actuel</span>
              ) : (
                <button
                  type="button"
                  className="pri-btn pri-btn-secondary"
                  onClick={() => handleUpgrade('monthly')}
                  disabled={checkoutLoading !== null}
                >
                  {checkoutLoading === 'monthly' ? 'Redirection…' : 'Passer Mensuel →'}
                </button>
              )}
            </div>
          </article>
        </div>

        {/* === COMPARATIF DÉTAILLÉ === */}
        <section className="pri-compare">
          <h2 className="pri-compare-h">Comparatif détaillé</h2>
          <div className="pri-compare-table">
            <div className="pri-compare-row pri-compare-head">
              <div className="pri-compare-feat">Fonctionnalité</div>
              <div className="pri-compare-cell">Gratuit</div>
              <div className="pri-compare-cell pri-compare-cell-pro">Premium</div>
            </div>

            <CompareGroup label="Organisation" />
            <CompareRow feat="Matières et fiches" free="Illimité" pro="Illimité" />
            <CompareRow feat="Courbe J + notation 1-5" free="Illimité" pro="Illimité" />
            <CompareRow feat="Calendrier de révisions" free="Oui" pro="Oui" />
            <CompareRow feat="Bibliothèque + Focus" free="Illimité" pro="Illimité" />

            <CompareGroup label="IA" />
            <CompareRow feat="Générations QCM IA" free={`${FREE_AI_GENERATIONS_LIMIT} au total`} pro="Illimité" />
            <CompareRow feat="Transcription vidéo" free={`${FREE_VIDEO_SIZE_MB} Mo max (~30 min)`} pro="Jusqu'à 250 Mo (~1h)" />
            <CompareRow feat="Taille PDF" free={`${FREE_PDF_SIZE_MB} Mo max`} pro="Sans limite" />

            <CompareGroup label="Simulateur d'examen" />
            <CompareRow feat="Sessions" free={`${FREE_SIMULATOR_SESSIONS_LIMIT} au total`} pro="Illimité" />
            <CompareRow feat="Mode Apprentissage" free="Oui" pro="Oui" />
            <CompareRow feat="Mode Examen blanc" free="—" pro="Oui" />

            <CompareGroup label="Statistiques" />
            <CompareRow feat="Stats de base" free="Oui" pro="Oui" />
            <CompareRow feat="Heatmap année" free="—" pro="Oui" />
            <CompareRow feat="Sparkline 12 semaines" free="—" pro="Oui" />
            <CompareRow feat="Dumbbell par matière" free="—" pro="Oui" />

            <CompareGroup label="Support" />
            <CompareRow feat="Email" free="—" pro="Prioritaire" />
            <CompareRow feat="Nouvelles features" free="Selon planning" pro="En avant-première" />
          </div>
        </section>

        {/* === FAQ === */}
        <section className="pri-faq">
          <h2 className="pri-faq-h">Questions fréquentes</h2>

          <details className="pri-faq-item">
            <summary>Quelle est la différence entre Annuel et Mensuel ?</summary>
            <p>
              Aucune, en termes de fonctionnalités. L&apos;Annuel revient
              à 5,75 €/mois (économise 3 mois sur l&apos;année), et c&apos;est
              un seul paiement à gérer. Le Mensuel à 9,99 € est plus flexible
              si tu préfères tester un mois ou résilier à tout moment.
            </p>
          </details>

          <details className="pri-faq-item">
            <summary>Puis-je résilier à tout moment ?</summary>
            <p>
              Oui, sur les deux plans. Tu gères ton abonnement depuis ton
              espace client Stripe. Sur l&apos;Annuel, tu gardes Premium
              jusqu&apos;à la fin de la période payée puis repasses en Gratuit.
            </p>
          </details>

          <details className="pri-faq-item">
            <summary>Que se passe-t-il pour mes données si je résilie ?</summary>
            <p>
              Rien ne disparaît. Tes fiches, tes notes et ton historique
              restent accessibles en mode Gratuit. Tu retrouves juste les
              quotas de base sur les fonctionnalités IA.
            </p>
          </details>

          <details className="pri-faq-item">
            <summary>Pourquoi limiter l&apos;IA en mode Gratuit ?</summary>
            <p>
              Chaque génération coûte de l&apos;argent côté Gemini (l&apos;IA
              utilisée). MedRev est développé par un étudiant qui veut garder
              le projet viable sans pubs. Le plan Premium finance les coûts
              d&apos;infrastructure et de développement.
            </p>
          </details>

          <details className="pri-faq-item">
            <summary>Le paiement est-il sécurisé ?</summary>
            <p>
              Oui — le paiement passe par Stripe, leader européen de
              l&apos;encaissement en ligne. MedRev ne stocke jamais tes
              données bancaires.
            </p>
          </details>
        </section>

        {/* === FOOTER NAV === */}
        <div className="pri-footer">
          <Link href="/dashboard" className="pri-footer-link">← Retour au dashboard</Link>
          <Link href="/dashboard/settings" className="pri-footer-link">Paramètres du compte</Link>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Sous-composants table comparatif
// ============================================================
function CompareGroup({ label }: { label: string }) {
  return (
    <div className="pri-compare-row pri-compare-group">
      <div className="pri-compare-feat">{label}</div>
      <div className="pri-compare-cell" />
      <div className="pri-compare-cell pri-compare-cell-pro" />
    </div>
  )
}

function CompareRow({ feat, free, pro }: { feat: string; free: string; pro: string }) {
  const freeIsDash = free === '—'
  return (
    <div className="pri-compare-row">
      <div className="pri-compare-feat">{feat}</div>
      <div className={`pri-compare-cell${freeIsDash ? ' pri-compare-dash' : ''}`}>{free}</div>
      <div className="pri-compare-cell pri-compare-cell-pro">{pro}</div>
    </div>
  )
}

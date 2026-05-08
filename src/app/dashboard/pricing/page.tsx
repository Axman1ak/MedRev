'use client'
// src/app/dashboard/pricing/page.tsx
//
// Page Pricing — Free vs Premium (9,99 €/mois).
// Branche /api/stripe/checkout existant (qui ouvre une session Stripe avec
// le price ID fixé côté serveur). Le webhook /api/stripe/webhook flippe
// profile.plan à 'pro' après checkout réussi.
//
// Pour ajouter le plan annuel 69 € (validé en mémoire), il faudra :
//   1. Créer le product/prix dans Stripe dashboard
//   2. Modifier /api/stripe/checkout pour accepter un param priceId
//   3. Ajouter une 3e card côté UI

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
// Sans ce wrapper, le build Vercel échoue avec "useSearchParams() should be
// wrapped in a suspense boundary".
export default function PricingPage() {
  return (
    <Suspense fallback={<div className="pri-page"><div className="pri-loading">Chargement…</div></div>}>
      <PricingContent />
    </Suspense>
  )
}

function PricingContent() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
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
      // Nettoie les query params sans recharger (replace state HTML5)
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

  async function handleUpgrade() {
    setCheckoutLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.url) {
        setBanner({ kind: 'info', text: json?.error || 'Impossible d\'ouvrir le paiement. Réessaie dans un instant.' })
        setCheckoutLoading(false)
        return
      }
      window.location.href = json.url as string
    } catch {
      setBanner({ kind: 'info', text: 'Connexion impossible. Vérifie ta connexion et réessaie.' })
      setCheckoutLoading(false)
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

        {/* === CARDS (2 plans : Gratuit + Premium mensuel) === */}
        <div className="pri-cards pri-cards-2">
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
              <li><span className="pri-mark dim">·</span>{FREE_SIMULATOR_SESSIONS_LIMIT} session simulateur</li>
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

          {/* PREMIUM — RECOMMANDÉ */}
          <article className="pri-card pri-card-featured">
            <div className="pri-card-badge">Recommandé</div>
            <div className="pri-card-h">
              <div className="pri-card-tag">Le plan complet</div>
              <h2 className="pri-card-name">Premium</h2>
              <div className="pri-card-price">
                <span className="pri-price-num">9,99</span>
                <span className="pri-price-cur">€</span>
                <span className="pri-price-period">par mois</span>
              </div>
              <div className="pri-card-monthly">
                Sans engagement, résiliable à tout moment.
              </div>
              <p className="pri-card-desc">
                Pour les <em>P1</em> qui veulent un outil complet sur toute
                l&apos;année. L&apos;IA et le simulateur deviennent illimités.
              </p>
            </div>
            <ul className="pri-card-list">
              <li><span className="pri-mark gold">✦</span><strong>Tout du Gratuit</strong>, plus :</li>
              <li><span className="pri-mark ok">✓</span>Générations QCM IA <strong>illimitées</strong></li>
              <li><span className="pri-mark ok">✓</span>Sessions simulateur illimitées + <strong>mode Examen blanc</strong></li>
              <li><span className="pri-mark ok">✓</span>Vidéos jusqu&apos;à 250 Mo, PDF sans limite</li>
              <li><span className="pri-mark ok">✓</span>Stats avancées (heatmap année, sparkline 12 sem, dumbbell)</li>
              <li><span className="pri-mark ok">✓</span>Support par email prioritaire</li>
            </ul>
            <div className="pri-card-cta">
              {isPro ? (
                <span className="pri-btn pri-btn-current">Plan actuel</span>
              ) : (
                <button
                  type="button"
                  className="pri-btn pri-btn-primary"
                  onClick={handleUpgrade}
                  disabled={checkoutLoading}
                >
                  {checkoutLoading ? 'Redirection…' : 'Passer Premium →'}
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
            <summary>Puis-je résilier à tout moment ?</summary>
            <p>
              Oui. Le plan Premium est sans engagement — tu peux résilier
              depuis ton espace client Stripe à tout moment. Tu gardes
              l&apos;accès Premium jusqu&apos;à la fin du mois en cours, puis
              tu repasses automatiquement en Gratuit.
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

          <details className="pri-faq-item">
            <summary>Y a-t-il une période d&apos;essai ?</summary>
            <p>
              Le plan Gratuit te permet déjà de tester toutes les
              fonctionnalités principales. Tu n&apos;as pas besoin de payer
              pour découvrir si MedRev te correspond.
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

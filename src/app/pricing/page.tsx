// src/app/pricing/page.tsx
//
// Page Tarifs PUBLIQUE — accessible sans authentification.
// La version interne (/dashboard/pricing) reste branchée sur Stripe pour
// les users connectés. Cette page-ci est faite pour les visiteurs qui
// arrivent depuis Google ou un partage de lien.
//
// Server component (pas de hooks interactifs), donc plus rapide à first-paint.
// Les CTAs renvoient vers /auth pour pousser à l'inscription d'abord.

import Link from 'next/link'
import MarketingNav from '@/components/MarketingNav'
import MarketingFooter from '@/components/MarketingFooter'
import {
  FREE_AI_GENERATIONS_LIMIT,
  FREE_SIMULATOR_SESSIONS_LIMIT,
  FREE_VIDEO_SIZE_MB,
  FREE_PDF_SIZE_MB,
} from '@/types'
import '@/components/landing-styles.css'

export const metadata = {
  title: 'Tarifs — MedRev',
  description: 'Choisis le plan qui te porte jusqu\'au concours. Gratuit pour démarrer, Premium à 69 €/an.',
}

export default function PricingPublicPage() {
  return (
    <div className="lp-page">
      <MarketingNav current="pricing" />

      {/* Hero pricing */}
      <section className="lp-hero" style={{ paddingBottom: 40 }}>
        <span className="lp-hero-kicker">Tarifs · Rentrée 2026</span>
        <h1 className="lp-hero-h1" style={{ fontSize: 'clamp(40px, 6vw, 72px)' }}>
          Ton niveau ne devrait pas
          <span className="line2"><em>dépendre de ton budget.</em></span>
        </h1>
        <p className="lp-hero-sub">
          Commence gratuit. Passe Premium quand tu en as vraiment besoin —
          ou jamais. <strong>C&apos;est ton choix.</strong>
        </p>
      </section>

      {/* Cards */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-pricing-teaser">
          <div className="lp-pt-card">
            <div className="lp-pt-tag">Pour découvrir</div>
            <h3 className="lp-pt-name">Gratuit</h3>
            <div className="lp-pt-price">0<em>€</em></div>
            <div className="lp-pt-period">à vie</div>
            <p className="lp-pt-desc">
              Les bases pour démarrer la P1 sans s&apos;engager. Idéal pour
              voir si MedRev te convient.
            </p>
            <ul className="lp-pt-list">
              <li>Matières et fiches illimitées</li>
              <li>Courbe J + notation 1-5</li>
              <li>Bibliothèque + Focus illimités</li>
              <li>{FREE_AI_GENERATIONS_LIMIT} générations QCM IA</li>
              <li>{FREE_SIMULATOR_SESSIONS_LIMIT} sessions simulateur</li>
              <li>Vidéos jusqu&apos;à {FREE_VIDEO_SIZE_MB} Mo, PDF jusqu&apos;à {FREE_PDF_SIZE_MB} Mo</li>
            </ul>
            <Link href="/auth" className="lp-btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
              Commencer gratuit →
            </Link>
          </div>

          <div className="lp-pt-card featured">
            <div className="lp-pt-tag">Recommandé · Économise 3 mois</div>
            <h3 className="lp-pt-name">Annuel</h3>
            <div className="lp-pt-price">69<em>€/an</em></div>
            <div className="lp-pt-period">soit 5,75 € par mois</div>
            <p className="lp-pt-desc">
              Pour les P1 qui s&apos;engagent toute l&apos;année. Mêmes
              fonctionnalités que le Mensuel.
            </p>
            <ul className="lp-pt-list">
              <li><strong>Tout du Premium</strong>, plus :</li>
              <li>Générations QCM IA illimitées</li>
              <li>Simulateur illimité + Examen blanc</li>
              <li>Vidéos 250 Mo, PDF sans limite</li>
              <li>Stats avancées</li>
              <li>Économise 30 € vs Mensuel</li>
            </ul>
            <Link href="/auth" className="lp-btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              Passer Annuel →
            </Link>
          </div>

          <div className="lp-pt-card">
            <div className="lp-pt-tag">Sans engagement</div>
            <h3 className="lp-pt-name">Mensuel</h3>
            <div className="lp-pt-price">9,99<em>€/mois</em></div>
            <div className="lp-pt-period">résiliable à tout moment</div>
            <p className="lp-pt-desc">
              Pour tester un mois ou rester flexible. Mêmes fonctionnalités
              que l&apos;Annuel.
            </p>
            <ul className="lp-pt-list">
              <li><strong>Tout du Premium</strong> :</li>
              <li>Générations QCM IA illimitées</li>
              <li>Simulateur illimité + Examen blanc</li>
              <li>Vidéos 250 Mo, PDF sans limite</li>
              <li>Stats avancées</li>
              <li>Sans engagement</li>
            </ul>
            <Link href="/auth" className="lp-btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
              Passer Mensuel →
            </Link>
          </div>
        </div>
      </section>

      {/* Comparatif détaillé */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-section-head" style={{ marginBottom: 32 }}>
          <h2 className="lp-section-h2" style={{ fontSize: 'clamp(26px, 3.5vw, 36px)' }}>
            Comparatif <em>détaillé</em>
          </h2>
        </div>
        <div className="lp-compare">
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
        </div>
      </section>

      {/* FAQ */}
      <section className="lp-section" style={{ paddingTop: 0 }}>
        <div className="lp-section-head">
          <div className="lp-section-kicker">Questions</div>
          <h2 className="lp-section-h2">Souvent demandées.</h2>
        </div>
        <div className="lp-faq">
          <details className="lp-faq-item">
            <summary>Quelle est la différence entre Annuel et Mensuel ?</summary>
            <p>
              Aucune en termes de fonctionnalités. L&apos;Annuel revient à
              5,75 €/mois (économise 3 mois sur l&apos;année). Le Mensuel à
              9,99 € est plus flexible si tu préfères tester ou résilier à
              tout moment.
            </p>
          </details>
          <details className="lp-faq-item">
            <summary>Puis-je résilier à tout moment ?</summary>
            <p>
              Oui, sur les deux plans. Tu gères ton abonnement depuis ton
              espace client Stripe. Sur l&apos;Annuel, tu gardes Premium
              jusqu&apos;à la fin de la période payée puis repasses en Gratuit.
            </p>
          </details>
          <details className="lp-faq-item">
            <summary>Que se passe-t-il pour mes données si je résilie ?</summary>
            <p>
              Rien ne disparaît. Tes fiches, tes notes et ton historique
              restent accessibles en mode Gratuit. Tu retrouves juste les
              quotas de base sur l&apos;IA et le simulateur.
            </p>
          </details>
          <details className="lp-faq-item">
            <summary>Le paiement est-il sécurisé ?</summary>
            <p>
              Oui — le paiement passe par Stripe, leader européen de
              l&apos;encaissement en ligne. MedRev ne stocke jamais tes
              données bancaires.
            </p>
          </details>
          <details className="lp-faq-item">
            <summary>Y a-t-il une période d&apos;essai gratuite ?</summary>
            <p>
              Le plan Gratuit te permet de tester toutes les fonctionnalités
              principales sans engagement. C&apos;est mieux qu&apos;une période
              d&apos;essai à durée limitée — tu utilises l&apos;app à ton
              rythme.
            </p>
          </details>
        </div>
      </section>

      {/* CTA final */}
      <section className="lp-cta">
        <h2 className="lp-cta-h2">
          Prêt à <em>commencer ?</em>
        </h2>
        <p className="lp-cta-sub">
          Pré-configure ton compte en 2 minutes. Tes matières sont déjà prêtes
          selon ta fac.
        </p>
        <div className="lp-cta-buttons">
          <Link href="/auth" className="lp-btn-primary">Créer mon compte →</Link>
          <Link href="/methode" className="lp-btn-secondary">Voir la méthode</Link>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}

function CompareGroup({ label }: { label: string }) {
  return (
    <div className="lp-compare-row lp-compare-group">
      <div className="lp-compare-feat">{label}</div>
      <div className="lp-compare-cell" />
      <div className="lp-compare-cell" />
    </div>
  )
}

function CompareRow({ feat, free, pro }: { feat: string; free: string; pro: string }) {
  const dash = free === '—'
  return (
    <div className="lp-compare-row">
      <div className="lp-compare-feat">{feat}</div>
      <div className={`lp-compare-cell${dash ? ' dash' : ''}`}>{free}</div>
      <div className="lp-compare-cell pro">{pro}</div>
    </div>
  )
}

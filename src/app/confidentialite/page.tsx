// src/app/confidentialite/page.tsx
//
// Politique de confidentialité — RGPD compliant.
// Template de base. À faire relire par un juriste pour validation.

import Link from 'next/link'
import MarketingNav from '@/components/MarketingNav'
import MarketingFooter from '@/components/MarketingFooter'
import '@/components/landing-styles.css'
import '@/components/landing-night.css'

export const metadata = {
  title: 'Politique de Confidentialité · MedRev',
  description: 'Politique de confidentialité de MedRev, conforme RGPD. Données collectées, finalités, sous-traitants, droits de l\'utilisateur.',
}

export default function ConfidentialitePage() {
  return (
    <div className="lp-page">
      <MarketingNav />

      <div className="legal-wrap">
        <div className="legal-header ln-subhero">
          <span className="ln-kicker">Confidentialité</span>
          <h1 className="ln-subhero-h1">Politique de <em>Confidentialité</em></h1>
          <p className="ln-subhero-meta">Conforme RGPD · En vigueur depuis le 8 mai 2026</p>
        </div>

        <section className="legal-section">
          <h2 className="legal-h2">1. Responsable du traitement</h2>
          <p>Le responsable du traitement des données collectées via MedRev est Lou Bonnefoy, joignable à <a href="mailto:loubonnefoypc@gmail.com">loubonnefoypc@gmail.com</a>.</p>
        </section>

        <section className="legal-section">
          <h2 className="legal-h2">2. Données collectées</h2>
          <p>MedRev collecte uniquement les données nécessaires au bon fonctionnement du Service :</p>
          <ul className="legal-list">
            <li><strong>À l&apos;inscription</strong> : adresse email, nom d&apos;utilisateur, faculté d&apos;inscription.</li>
            <li><strong>Pendant l&apos;utilisation</strong> : matières créées, fiches, notes attribuées, QCM générés, sessions de simulateur, statistiques d&apos;utilisation.</li>
            <li><strong>Pour les abonnés Premium</strong> : identifiant client Stripe (pas les coordonnées bancaires, qui restent chez Stripe).</li>
            <li><strong>Techniques</strong> : adresse IP au moment des requêtes (pour la sécurité, log Vercel et Supabase).</li>
          </ul>
          <p>MedRev ne collecte <strong>aucune donnée de tracking publicitaire</strong>. Pas de Google Analytics, pas de Facebook Pixel, pas de cookies tiers.</p>
        </section>

        <section className="legal-section">
          <h2 className="legal-h2">3. Finalités et bases légales</h2>
          <p>Les données sont traitées pour les finalités suivantes :</p>
          <ul className="legal-list">
            <li><strong>Fourniture du Service</strong> (base légale : exécution du contrat, art. 6.1.b RGPD).</li>
            <li><strong>Génération des QCM par IA</strong> : envoi des sources (vidéo, PDF) à Google Gemini pour traitement (sous-traitant). Base légale : exécution du contrat.</li>
            <li><strong>Facturation et paiement</strong> via Stripe (base légale : exécution du contrat).</li>
            <li><strong>Communication transactionnelle</strong> (email de bienvenue, confirmations) : intérêt légitime.</li>
            <li><strong>Sécurité</strong> (logs IP) : intérêt légitime à protéger le Service contre les abus.</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2 className="legal-h2">4. Destinataires et sous-traitants</h2>
          <p>Les données peuvent être transmises aux sous-traitants suivants, tous liés par accord de confidentialité :</p>
          <ul className="legal-list">
            <li><strong>Supabase</strong> (Europe, Paris) : hébergement de la base de données et des fichiers uploadés.</li>
            <li><strong>Vercel</strong> (États-Unis) : hébergement de l&apos;application web. Transferts couverts par les Standard Contractual Clauses de la Commission européenne.</li>
            <li><strong>Stripe</strong> (Irlande) : traitement des paiements pour les abonnements Premium.</li>
            <li><strong>Google (Gemini API)</strong> (États-Unis) : traitement des cours uploadés pour la génération de QCM. Transferts couverts par les SCC.</li>
            <li><strong>Resend</strong> (États-Unis) : envoi des emails transactionnels.</li>
          </ul>
          <p>Aucune donnée n&apos;est revendue à des tiers à des fins commerciales ou publicitaires.</p>
        </section>

        <section className="legal-section">
          <h2 className="legal-h2">5. Durée de conservation</h2>
          <p>Les données du compte sont conservées tant que le compte est actif. Après suppression du compte par l&apos;utilisateur, les données sont effacées sous 30 jours. Les logs techniques (IP) sont conservés 12 mois.</p>
        </section>

        <section className="legal-section">
          <h2 className="legal-h2">6. Tes droits (RGPD)</h2>
          <p>Conformément au Règlement Général sur la Protection des Données, tu disposes des droits suivants :</p>
          <ul className="legal-list">
            <li><strong>Accès</strong> : obtenir copie de tes données.</li>
            <li><strong>Rectification</strong> : corriger des données erronées.</li>
            <li><strong>Suppression</strong> (« droit à l&apos;oubli ») : effacer ton compte et toutes tes données.</li>
            <li><strong>Portabilité</strong> : exporter tes données dans un format structuré.</li>
            <li><strong>Opposition</strong> : t&apos;opposer au traitement pour motif légitime.</li>
            <li><strong>Limitation</strong> : geler temporairement le traitement.</li>
          </ul>
          <p>Pour exercer un de ces droits, écris à <a href="mailto:loubonnefoypc@gmail.com">loubonnefoypc@gmail.com</a>. Une réponse te parvient sous 30 jours maximum.</p>
          <p>En cas de désaccord, tu peux saisir la <strong>CNIL</strong> sur cnil.fr.</p>
        </section>

        <section className="legal-section">
          <h2 className="legal-h2">7. Cookies</h2>
          <p>MedRev utilise uniquement les cookies <strong>strictement nécessaires</strong> au fonctionnement du Service (session d&apos;authentification Supabase, préférence de thème clair/sombre). Aucun cookie de tracking ou de publicité n&apos;est déposé.</p>
        </section>

        <section className="legal-section">
          <h2 className="legal-h2">8. Sécurité</h2>
          <p>Les mots de passe sont hashés (bcrypt) avant stockage. Les communications sont chiffrées en transit (HTTPS / TLS). L&apos;accès à la base de données est restreint par Row Level Security : aucun utilisateur ne peut accéder aux données d&apos;un autre.</p>
        </section>

        <section className="legal-section">
          <h2 className="legal-h2">9. Modifications</h2>
          <p>Cette politique peut être modifiée. Les changements substantiels sont notifiés par email au moins 30 jours avant leur entrée en vigueur.</p>
        </section>

        <p className="legal-back"><Link href="/">← Retour à l&apos;accueil</Link></p>
      </div>

      <MarketingFooter />
    </div>
  )
}

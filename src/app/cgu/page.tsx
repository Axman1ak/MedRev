// src/app/cgu/page.tsx
//
// Conditions Générales d'Utilisation. Page statique, légalement requise.
// ATTENTION : ce contenu est un template de base. Pour une vraie utilisation
// commerciale, faire relire par un juriste (LegalPlace, Captain Contrat).

import Link from 'next/link'
import MarketingNav from '@/components/MarketingNav'
import MarketingFooter from '@/components/MarketingFooter'
import '@/components/landing-styles.css'
import '@/components/landing-night.css'

export const metadata = {
  title: 'Conditions Générales d\'Utilisation · MedRev',
  description: 'CGU de MedRev : éditeur, objet, inscription, tarifs, résiliation, propriété intellectuelle, responsabilité, droit applicable.',
}

export default function CguPage() {
  return (
    <div className="lp-page">
      <MarketingNav />

      <div className="legal-wrap">
        <div className="legal-header ln-subhero">
          <span className="ln-kicker">Conditions générales</span>
          <h1 className="ln-subhero-h1">Conditions Générales d&apos;<em>Utilisation</em></h1>
          <p className="ln-subhero-meta">En vigueur depuis le 8 mai 2026</p>
        </div>

        <section className="legal-section">
          <h2 className="legal-h2">1. Éditeur</h2>
          <p>Le service MedRev (ci-après « le Service ») est édité par Lou Bonnefoy, étudiant, contact : <a href="mailto:medrev.fr@gmail.com">medrev.fr@gmail.com</a>.</p>
          <p>L&apos;hébergement est assuré par Vercel Inc. (États-Unis) pour l&apos;application web et Supabase (Europe, Paris) pour la base de données et les fichiers.</p>
        </section>

        <section className="legal-section">
          <h2 className="legal-h2">2. Objet</h2>
          <p>MedRev est une application web destinée aux étudiants en première année des études de santé (PASS / LAS, puis voie unique à partir de la rentrée 2027) pour organiser leurs révisions, générer des QCM à partir de leurs cours par intelligence artificielle, et suivre leur progression.</p>
          <p>L&apos;utilisation du Service est soumise aux présentes Conditions Générales d&apos;Utilisation. L&apos;inscription vaut acceptation pleine et entière.</p>
        </section>

        <section className="legal-section">
          <h2 className="legal-h2">3. Inscription et compte</h2>
          <p>L&apos;inscription est gratuite. Elle nécessite la fourniture d&apos;une adresse email valide et d&apos;un mot de passe. L&apos;utilisateur s&apos;engage à fournir des informations exactes et à les maintenir à jour.</p>
          <p>L&apos;utilisateur est seul responsable de la confidentialité de ses identifiants. Toute action effectuée depuis son compte est réputée effectuée par lui.</p>
        </section>

        <section className="legal-section">
          <h2 className="legal-h2">4. Plans et tarification</h2>
          <p>Le Service propose un plan Gratuit aux fonctionnalités principales accessibles sans paiement. Des plans Premium payants (mensuel à 9,99 € TTC, annuel à 69 € TTC) débloquent l&apos;usage illimité de l&apos;IA, du simulateur, et l&apos;accès aux statistiques avancées.</p>
          <p>Les paiements sont traités par Stripe Inc. MedRev ne stocke aucune donnée bancaire. Les abonnements sont renouvelés automatiquement à échéance, sauf résiliation par l&apos;utilisateur depuis son espace Stripe.</p>
        </section>

        <section className="legal-section">
          <h2 className="legal-h2">5. Résiliation et droit de rétractation</h2>
          <p>Conformément aux articles L221-18 et suivants du Code de la consommation, l&apos;utilisateur dispose d&apos;un délai de 14 jours pour exercer son droit de rétractation à compter de la souscription d&apos;un plan payant.</p>
          <p>L&apos;utilisateur peut résilier son abonnement à tout moment depuis son espace client Stripe. La résiliation prend effet à la fin de la période payée. Aucun remboursement prorata n&apos;est effectué pour les abonnements en cours, hors cas de rétractation légale.</p>
        </section>

        <section className="legal-section">
          <h2 className="legal-h2">6. Propriété intellectuelle</h2>
          <p>L&apos;interface, le code, le design et les contenus de MedRev sont la propriété exclusive de l&apos;éditeur et protégés par le droit d&apos;auteur.</p>
          <p>Les contenus uploadés par l&apos;utilisateur (cours vidéo, PDF, fiches) restent sa propriété. L&apos;utilisateur garantit disposer des droits nécessaires pour les charger sur le Service.</p>
        </section>

        <section className="legal-section">
          <h2 className="legal-h2">7. Responsabilité</h2>
          <p>MedRev s&apos;efforce d&apos;assurer la disponibilité et l&apos;exactitude du Service mais ne peut garantir une disponibilité de 100 %. Les QCM générés par IA peuvent contenir des erreurs ; ils ne dispensent pas l&apos;utilisateur de vérifier les informations dans les sources officielles.</p>
          <p>MedRev ne peut être tenu responsable des décisions ou résultats académiques de l&apos;utilisateur. Le Service est un outil d&apos;aide à la révision, pas un substitut à un enseignement officiel.</p>
        </section>

        <section className="legal-section">
          <h2 className="legal-h2">8. Données personnelles</h2>
          <p>Le traitement des données personnelles est détaillé dans la <Link href="/confidentialite">Politique de Confidentialité</Link>, consultable à tout moment depuis le footer du Service.</p>
        </section>

        <section className="legal-section">
          <h2 className="legal-h2">9. Modification des CGU</h2>
          <p>L&apos;éditeur se réserve le droit de modifier les présentes CGU à tout moment. Les modifications sont notifiées par email à l&apos;utilisateur au moins 30 jours avant leur entrée en vigueur. La poursuite de l&apos;utilisation du Service vaut acceptation.</p>
        </section>

        <section className="legal-section">
          <h2 className="legal-h2">10. Droit applicable</h2>
          <p>Les présentes CGU sont soumises au droit français. Tout litige relèvera de la compétence des tribunaux français.</p>
        </section>

        <p className="legal-back"><Link href="/">← Retour à l&apos;accueil</Link></p>
      </div>

      <MarketingFooter />
    </div>
  )
}

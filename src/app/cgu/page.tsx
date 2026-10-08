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
          <p>Le service MedRev (ci-après « le Service ») est édité par Lou Bonnefoy, étudiant, contact : <a href="mailto:medrev.fr@gmail.com">medrev.fr@gmail.com</a>. Les informations complètes figurent dans les <Link href="/mentions-legales">mentions légales</Link>.</p>
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
          <h2 className="legal-h2">4. Tarification</h2>
          <p>Le Service est actuellement <strong>gratuit dans son intégralité</strong>. Aucun abonnement payant n&apos;est proposé à la souscription, aucune donnée bancaire n&apos;est demandée, et le Service n&apos;affiche aucune publicité.</p>
          <p>Des formules payantes pourront être introduites ultérieurement. Elles feront l&apos;objet d&apos;une information préalable des utilisateurs et d&apos;une mise à jour des présentes conditions, y compris des informations qu&apos;un service payant doit publier (identification complète de l&apos;éditeur, médiateur de la consommation, modalités de rétractation et de résiliation).</p>
          <p>Les comptes disposant d&apos;un accès complet accordé avant cette date le conservent, sans contrepartie financière.</p>
        </section>

        <section className="legal-section">
          <h2 className="legal-h2">5. Fin d&apos;utilisation</h2>
          <p>Le Service étant gratuit, aucun engagement ni aucune résiliation d&apos;abonnement ne sont en jeu. L&apos;utilisateur peut cesser d&apos;utiliser MedRev à tout moment.</p>
          <p>La suppression définitive du compte et de l&apos;ensemble des données associées est disponible directement dans les Réglages. Elle est immédiate et sans condition.</p>
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

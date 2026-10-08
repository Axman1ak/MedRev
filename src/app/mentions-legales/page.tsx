// src/app/mentions-legales/page.tsx
//
// Mentions légales, version « site gratuit édité par un particulier ».
//
// Tant que MedRev ne vend rien (voir src/lib/offres.ts), l'éditeur n'est pas
// un éditeur professionnel au sens de l'article 6-III de la LCEN : il n'a pas
// à publier d'adresse, de SIRET ni de numéro de TVA. On va volontairement
// au-delà du minimum légal en donnant le nom, un contact direct et le détail
// des hébergeurs, parce que la page sert aussi à rassurer un tutorat.
//
// À METTRE À JOUR le jour où OFFRES_PAYANTES_OUVERTES passe à true : il
// faudra alors l'adresse, le statut juridique, le SIRET et la mention de TVA.

import Link from 'next/link'
import MarketingNav from '@/components/MarketingNav'
import MarketingFooter from '@/components/MarketingFooter'
import { CONTACT_EMAIL } from '@/lib/offres'
import '@/components/landing-styles.css'
import '@/components/landing-night.css'

export const metadata = {
  title: 'Mentions légales · MedRev',
  description: 'Mentions légales de MedRev : éditeur, directeur de la publication, hébergeurs, contact.',
}

export default function MentionsLegalesPage() {
  return (
    <div className="lp-page">
      <MarketingNav />

      <div className="legal-wrap">
        <div className="legal-header ln-subhero">
          <span className="ln-kicker">Informations légales</span>
          <h1 className="ln-subhero-h1">Mentions <em>légales</em></h1>
          <p className="ln-subhero-meta">Dernière mise à jour : octobre 2026</p>
        </div>

        <section className="legal-section">
          <h2 className="legal-h2">1. Éditeur du site</h2>
          <p>
            Le site medrev.fr et le service MedRev sont édités par <strong>Lou Bonnefoy</strong>,
            personne physique, étudiant. MedRev est un projet personnel : il n&apos;y a ni
            société, ni équipe, ni investisseur derrière.
          </p>
          <p>Contact : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
        </section>

        <section className="legal-section">
          <h2 className="legal-h2">2. Directeur de la publication</h2>
          <p>Lou Bonnefoy.</p>
        </section>

        <section className="legal-section">
          <h2 className="legal-h2">3. Un service gratuit</h2>
          <p>
            MedRev est actuellement <strong>gratuit et sans abonnement payant</strong>. Le site
            ne vend rien, n&apos;affiche aucune publicité et ne revend aucune donnée. Des
            formules payantes pourront être proposées plus tard ; cette page sera complétée
            à ce moment-là des informations qu&apos;un service payant doit publier.
          </p>
        </section>

        <section className="legal-section">
          <h2 className="legal-h2">4. Hébergement</h2>
          <p><strong>Application web</strong> : Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.</p>
          <p><strong>Base de données et fichiers</strong> : Supabase, région Europe (Paris, France).</p>
          <p>
            Les comptes, les fiches et les documents déposés par les utilisateurs sont stockés
            en Europe. Le détail des traitements figure dans la{' '}
            <Link href="/confidentialite">politique de confidentialité</Link>.
          </p>
        </section>

        <section className="legal-section">
          <h2 className="legal-h2">5. Propriété intellectuelle</h2>
          <p>
            L&apos;interface, le code et le design de MedRev sont protégés par le droit
            d&apos;auteur. Les cours, fiches et documents déposés par un utilisateur restent
            sa propriété, ou celle de leurs auteurs : MedRev ne les publie pas, ne les partage
            pas entre comptes et ne les réutilise pas à d&apos;autres fins que de les
            restituer à la personne qui les a déposés.
          </p>
        </section>

        <section className="legal-section">
          <h2 className="legal-h2">6. Signaler un contenu ou une erreur</h2>
          <p>
            Pour signaler un contenu illicite, une atteinte à des droits, ou une erreur dans
            une question générée, écris à <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            Les questions générées par l&apos;IA peuvent aussi être signalées en un clic depuis
            l&apos;application, sous chaque QCM.
          </p>
        </section>

        <section className="legal-section">
          <h2 className="legal-h2">7. Textes liés</h2>
          <p>
            <Link href="/cgu">Conditions générales d&apos;utilisation</Link>
            {' · '}
            <Link href="/confidentialite">Politique de confidentialité</Link>
            {' · '}
            <Link href="/contact">Contact</Link>
          </p>
        </section>

        <p className="legal-back"><Link href="/">← Retour à l&apos;accueil</Link></p>
      </div>

      <MarketingFooter />
    </div>
  )
}

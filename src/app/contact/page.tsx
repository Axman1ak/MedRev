// src/app/contact/page.tsx
//
// Page contact. Avant, la seule adresse du site était enfouie dans l'article 1
// des CGU : quelqu'un qui veut poser une question avant de s'inscrire n'avait
// nulle part où aller.
//
// Le bloc « tutorats et associations » est volontairement en premier : c'est
// le visiteur qu'on cherche à convaincre en ce moment, et il arrive avec une
// question précise (est-ce que ça concurrence ce qu'on fait ?).

import Link from 'next/link'
import MarketingNav from '@/components/MarketingNav'
import MarketingFooter from '@/components/MarketingFooter'
import '@/components/landing-styles.css'
import '@/components/landing-night.css'

export const metadata = {
  title: 'Contact · MedRev',
  description: 'Écrire à MedRev : questions des étudiants, tutorats et associations, signalement d\'une erreur dans un QCM.',
}

export default function ContactPage() {
  return (
    <div className="lp-page">
      <MarketingNav />

      <div className="legal-wrap">
        <div className="legal-header ln-subhero">
          <span className="ln-kicker">Contact</span>
          <h1 className="ln-subhero-h1">Écrire à <em>MedRev</em></h1>
          <p className="ln-subhero-meta">
            Une seule adresse, lue par la personne qui développe l&apos;app :{' '}
            <a href="mailto:medrev.fr@gmail.com">medrev.fr@gmail.com</a>
          </p>
        </div>

        <section className="legal-section">
          <h2 className="legal-h2">Tutorats et associations étudiantes</h2>
          <p>
            MedRev ne produit aucun contenu de cours. Pas de poly, pas de banque de QCM
            toute faite, pas de khôlles. L&apos;app organise le travail de l&apos;étudiant
            à partir de ses propres documents : elle ne remplace ni ce que fait un tutorat,
            ni ce que fait une fac.
          </p>
          <p>
            Si vous êtes au bureau d&apos;un tutorat et que vous voulez voir l&apos;outil,
            écrivez-nous : accès complet gratuit pour vos membres, et on prend le temps de
            vous le montrer. Vos retours sur la justesse des questions générées sont les
            plus utiles qu&apos;on puisse recevoir.
          </p>
        </section>

        <section className="legal-section">
          <h2 className="legal-h2">Une erreur dans une question ?</h2>
          <p>
            C&apos;est le signalement le plus important pour nous. Chaque QCM affiche un
            lien « Signaler cette question » : un clic, un motif, c&apos;est envoyé. Tu peux
            aussi écrire directement, en précisant la matière et la fiche.
          </p>
        </section>

        <section className="legal-section">
          <h2 className="legal-h2">Un bug, une idée, un abonnement</h2>
          <p>
            Même adresse. Pour une question de facturation, précise l&apos;email de ton
            compte. Pour un bug, dis-nous sur quel écran et sur quel appareil : ça fait
            gagner un aller-retour.
          </p>
        </section>

        <section className="legal-section">
          <h2 className="legal-h2">Données personnelles</h2>
          <p>
            Pour un accès, une rectification ou une suppression de tes données, écris à la
            même adresse. La suppression définitive du compte est aussi disponible
            directement dans les Réglages. Le détail est dans la{' '}
            <Link href="/confidentialite">politique de confidentialité</Link>.
          </p>
        </section>

        <p className="legal-back"><Link href="/">← Retour à l&apos;accueil</Link></p>
      </div>

      <MarketingFooter />
    </div>
  )
}

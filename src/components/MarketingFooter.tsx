// src/components/MarketingFooter.tsx
//
// Footer partagé entre toutes les pages publiques marketing.
//
// TROIS CORRECTIONS (octobre 2026) :
//
// 1. « Hébergé en France » contredisait l'article 1 des CGU, qui dit que
//    l'application est hébergée par Vercel Inc. (États-Unis) et la base par
//    Supabase (Paris). Les deux pages sont lisibles côte à côte, et c'est
//    exactement le genre de détail qu'une association vérifie. On garde la
//    version vraie : ce sont les DONNÉES qui sont en Europe.
//
// 2. La pastille « Tous les services opérationnels » était écrite en dur.
//    Elle serait restée verte pendant une panne de base. Un indicateur d'état
//    qui ne mesure rien vaut moins que pas d'indicateur du tout : retiré.
//    Le jour où il y a une vraie page d'état, on la rebranche.
//
// 3. Ni les mentions légales ni un contact n'étaient atteignables depuis le
//    footer. La seule adresse du site était enfouie dans l'article 1 des CGU.

import Link from 'next/link'

export default function MarketingFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-footer-inner">
        <div className="lp-footer-brand">
          <div className="lp-footer-logo">Med·Rev</div>
          <div className="lp-footer-tag">
            La méthode des prépas, sans le prix.
            <br />
            Conçu en France pour les P1.
          </div>
        </div>
      </div>
      <div className="lp-footer-bottom">
        <span>© 2026 MedRev · Données hébergées en Europe</span>
        <span className="lp-footer-legal">
          <Link href="/contact">Contact</Link>
          <Link href="/mentions-legales">Mentions légales</Link>
          <Link href="/cgu">CGU</Link>
          <Link href="/confidentialite">Confidentialité</Link>
        </span>
      </div>
    </footer>
  )
}

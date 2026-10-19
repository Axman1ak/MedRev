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
//
// Octobre 2026 : même pied de page marine que l'accueil (site-chrome.css).

import Link from 'next/link'
import MedRevMark from '@/components/MedRevMark'
import './site-chrome.css'

export default function MarketingFooter() {
  return (
    <footer className="sc-ft">
      <div className="sc-ft-in">
        <div className="sc-ft-brand">
          <MedRevMark bg="#fff" fg="#15304E" size={30} />
          <div>
            <b>MedRev</b>
            <span>Conçu en France pour la 1re année de santé.</span>
          </div>
        </div>
        <nav className="sc-ft-nav" aria-label="Liens du site">
          <Link href="/#comment">Comment ça marche</Link>
          <Link href="/methode">La méthode</Link>
          <Link href="/guides/organiser-sa-p1">Organiser sa P1</Link>
          <Link href="/manifesto">Manifesto</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/mentions-legales">Mentions légales</Link>
          <Link href="/cgu">CGU</Link>
          <Link href="/confidentialite">Confidentialité</Link>
        </nav>
      </div>
      <div className="sc-ft-bot">© 2026 MedRev. Données hébergées en Europe.</div>
    </footer>
  )
}

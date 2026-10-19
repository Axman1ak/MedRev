// src/components/MarketingNav.tsx
//
// Barre du haut de toutes les pages publiques, page d'accueil comprise.
// À gauche les pages (simples liens), à droite le compte (deux boutons,
// séparés par un trait) : on voit tout de suite ce qui mène à une page et
// ce qui mène à son compte.
//
// `current` souligne la page en cours. Plus de lien Tarifs ni de bandeau
// « Voir ce qui est inclus » : rien n'est en vente pour l'instant.
//
// site-public.css habille le corps des pages publiques (.lp-page) dans
// le même style que l'accueil ; il est importé ici pour arriver partout où
// cette barre est utilisée.

import Link from 'next/link'
import MedRevMark from '@/components/MedRevMark'
import './site-chrome.css'
import './site-public.css'

type Current = 'home' | 'pricing' | 'methode' | 'manifesto' | 'guide' | null

export default function MarketingNav({ current = null }: { current?: Current }) {
  return (
    <header className="sc-nv">
      <div className="sc-nv-in">
        <Link href="/" className="sc-logo" aria-label="MedRev, accueil">
          <MedRevMark bg="#fff" fg="#15304E" size={34} />
          <span>MedRev</span>
        </Link>
        <nav className="sc-links" aria-label="Pages">
          <Link href="/#comment" className="sc-link">Comment ça marche</Link>
          <Link href="/methode" className={`sc-link${current === 'methode' ? ' on' : ''}`}>La méthode</Link>
          <Link href="/guides/organiser-sa-p1" className={`sc-link${current === 'guide' ? ' on' : ''}`}>Organiser sa P1</Link>
          <Link href="/manifesto" className={`sc-link${current === 'manifesto' ? ' on' : ''}`}>Manifesto</Link>
        </nav>
        <div className="sc-acts">
          <Link href="/auth?mode=login" className="sc-btn sc-btn-out">Se connecter</Link>
          <Link href="/auth" className="sc-btn sc-btn-in">Commencer</Link>
        </div>
      </div>
      <div className="sc-prog" aria-hidden="true"><i /></div>
    </header>
  )
}

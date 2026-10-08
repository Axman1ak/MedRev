'use client'
// src/components/MarketingNav.tsx
//
// Nav partagée entre toutes les pages publiques marketing.
// La page courante est passée en prop `current` pour mettre en gras le lien actif.

import Link from 'next/link'

type Current = 'home' | 'pricing' | 'methode' | 'manifesto' | null

export default function MarketingNav({ current = null }: { current?: Current }) {
  return (
    <>
      <div className="lp-banner">
        {/* Pas de date dans ce bandeau : « rentrée 2026 » y est resté
            affiché jusqu'en septembre 2026, où il donnait l'impression d'un
            produit pas encore sorti. Un bandeau permanent ne se périme pas. */}
        <strong>Gratuit</strong> pour commencer ·
        <Link href="/pricing">Voir ce qui est inclus →</Link>
      </div>
      <nav className="lp-nav">
        <Link href="/" className="lp-logo">Med<span>·Rev</span></Link>
        <div className="lp-nav-links">
          <Link href="/methode" className={current === 'methode' ? 'active' : ''}>Méthode</Link>
          <Link href="/manifesto" className={current === 'manifesto' ? 'active' : ''}>Manifesto</Link>
          <Link href="/pricing" className={current === 'pricing' ? 'active' : ''}>Tarifs</Link>
        </div>
        <div className="lp-nav-actions">
          <Link href="/auth?mode=login" className="lp-nav-login">Se connecter</Link>
          <Link href="/auth" className="lp-btn-primary">Commencer →</Link>
        </div>
      </nav>
    </>
  )
}

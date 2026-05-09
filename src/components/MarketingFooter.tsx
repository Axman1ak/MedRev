// src/components/MarketingFooter.tsx
//
// Footer partagé entre toutes les pages publiques marketing.
// Liens légaux (CGU, Confidentialité) en bas, séparés du contenu produit.

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
        <span>© 2026 MedRev · Hébergé en France</span>
        <span className="lp-footer-legal">
          <Link href="/cgu">CGU</Link>
          <Link href="/confidentialite">Confidentialité</Link>
          <span className="lp-footer-status">
            <span className="lp-footer-status-dot" />
            Tous les services opérationnels
          </span>
        </span>
      </div>
    </footer>
  )
}

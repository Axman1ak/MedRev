// src/app/not-found.tsx
//
// Page 404 globale — affichée quand Next.js ne trouve pas la route demandée.
// Style aligné sur les pages marketing (Cinzel, palette MedRev).

import Link from 'next/link'

export const metadata = {
  title: 'Page introuvable — MedRev',
}

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#FAFAF7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 480, textAlign: 'center' }}>
        <div
          style={{
            fontFamily: "'Cinzel', 'Fraunces', Georgia, serif",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: '#1A1A1A',
            marginBottom: 32,
          }}
        >
          Med<span style={{ color: '#2D6A4F' }}>·Rev</span>
        </div>

        <div
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 88,
            fontWeight: 500,
            color: '#1B4332',
            lineHeight: 1,
            marginBottom: 18,
            letterSpacing: '-0.04em',
          }}
        >
          404
        </div>

        <h1
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 28,
            fontWeight: 500,
            color: '#1A1A1A',
            margin: '0 0 14px',
            letterSpacing: '-0.01em',
          }}
        >
          Cette page n&apos;existe pas
        </h1>

        <p
          style={{
            fontSize: 15,
            lineHeight: 1.6,
            color: '#5C5C5A',
            margin: '0 0 32px',
          }}
        >
          Le lien que tu as suivi est cassé, ou la page a peut-être été
          déplacée. Pas grave, tu peux revenir au tableau de bord ou à
          l&apos;accueil.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link
            href="/dashboard"
            style={{
              display: 'inline-block',
              padding: '12px 22px',
              background: '#1B4332',
              color: '#FFFFFF',
              textDecoration: 'none',
              borderRadius: 9,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Retour au tableau de bord →
          </Link>
          <Link
            href="/"
            style={{
              display: 'inline-block',
              padding: '12px 22px',
              background: 'transparent',
              color: '#1A1A1A',
              textDecoration: 'none',
              border: '1px solid #E8E6E0',
              borderRadius: 9,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Aller à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  )
}

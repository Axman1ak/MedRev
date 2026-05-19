'use client'
// src/app/error.tsx
//
// Error boundary global,affiché quand une page React plante côté client OU
// quand une route serveur retourne une erreur non gérée. Doit être un client
// component (Next.js le requiert pour pouvoir afficher le reset()).

import { useEffect } from 'react'
import Link from 'next/link'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Log côté console pour le debugging,Vercel les remonte dans
  // ses logs serveur si l'erreur vient d'un server component.
  useEffect(() => {
    console.error('[GlobalError]', error)
  }, [error])

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
            fontSize: 64,
            fontWeight: 500,
            color: '#C75050',
            lineHeight: 1,
            marginBottom: 18,
            letterSpacing: '-0.03em',
          }}
        >
          Oops.
        </div>

        <h1
          style={{
            fontFamily: "'Fraunces', serif",
            fontSize: 26,
            fontWeight: 500,
            color: '#1A1A1A',
            margin: '0 0 14px',
            letterSpacing: '-0.01em',
          }}
        >
          Une erreur inattendue est survenue
        </h1>

        <p
          style={{
            fontSize: 15,
            lineHeight: 1.6,
            color: '#5C5C5A',
            margin: '0 0 12px',
          }}
        >
          On a noté le problème. Tu peux recharger pour réessayer, ça
          marche très souvent.
        </p>

        {error.digest && (
          <p
            style={{
              fontSize: 11,
              color: '#9A9A98',
              fontFamily: "'JetBrains Mono', monospace",
              margin: '0 0 32px',
            }}
          >
            Réf : {error.digest}
          </p>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => reset()}
            style={{
              padding: '12px 22px',
              background: '#1B4332',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 9,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Recharger la page
          </button>
          <Link
            href="/dashboard"
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
            Retour au tableau de bord
          </Link>
        </div>

        <p
          style={{
            marginTop: 28,
            fontSize: 12,
            color: '#9A9A98',
            fontStyle: 'italic',
          }}
        >
          Si le problème persiste, écris à{' '}
          <a
            href="mailto:loubonnefoypc@gmail.com"
            style={{ color: '#5C5C5A' }}
          >
            loubonnefoypc@gmail.com
          </a>
          {error.digest ? ` avec la réf ${error.digest}` : ''}.
        </p>
      </div>
    </div>
  )
}

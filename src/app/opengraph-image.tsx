// src/app/opengraph-image.tsx
//
// OG image dynamique pour MedRev. Next.js 14 (App Router) génère cette image
// à la première requête puis la cache. Elle apparaît automatiquement quand
// on partage un lien MedRev sur WhatsApp, Twitter, Discord, LinkedIn, etc.
//
// Pour personnaliser par page (ex : /pricing avec une OG dédiée), créer un
// opengraph-image.tsx dans le dossier de cette page. Cette version sert de
// fallback global pour la racine.
//
// Format standard 1200×630 (recommandation OG/Twitter).

import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'MedRev — Tes cours, tes QCM, ton planning.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Fetch d'une font Google sur le CDN. La 1ère requête est plus lente, ensuite
// c'est cached côté Vercel Edge. Pour MedRev on charge Fraunces qui est notre
// font de marque (utilisée dans le H1 du site).
async function loadGoogleFont(family: string, text: string): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`
  const css = await (await fetch(url)).text()
  const match = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)
  if (!match) throw new Error(`Failed to extract font URL for ${family}`)
  const fontResp = await fetch(match[1])
  if (!fontResp.ok) throw new Error(`Failed to fetch font: ${fontResp.status}`)
  return await fontResp.arrayBuffer()
}

export default async function Image() {
  // Texte qu'on va utiliser dans l'image — on ne load que les glyphs nécessaires
  const ogText = "MedRev MED·REV Tes cours, tes QCM, ton planning. La méthode des prépas, sans le prix. POUR LES P1"

  const [frauncesRegular, frauncesItalic] = await Promise.all([
    loadGoogleFont('Fraunces:wght@500', ogText),
    loadGoogleFont('Fraunces:ital,wght@1,400', ogText),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#FAFAF7',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '80px',
          position: 'relative',
          fontFamily: 'Fraunces',
        }}
      >
        {/* Halo radial subtil en arrière-plan */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              'radial-gradient(ellipse 60% 40% at 50% 30%, rgba(45, 106, 79, 0.15) 0%, transparent 65%)',
          }}
        />

        {/* Logo top-left */}
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: 80,
            fontSize: 28,
            fontWeight: 500,
            letterSpacing: 6,
            color: '#1A1A1A',
            display: 'flex',
            fontFamily: 'serif',
            textTransform: 'uppercase',
          }}
        >
          MED·<span style={{ color: '#2D6A4F' }}>REV</span>
        </div>

        {/* Badge kicker */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 24px',
            background: '#DDECE3',
            border: '1px solid rgba(45, 106, 79, 0.25)',
            borderRadius: 999,
            fontSize: 16,
            fontWeight: 500,
            color: '#1B4332',
            letterSpacing: 3,
            textTransform: 'uppercase',
            marginBottom: 36,
            fontFamily: 'serif',
          }}
        >
          Pour les P1 · Rentrée 2026
        </div>

        {/* H1 principal */}
        <div
          style={{
            fontSize: 100,
            fontWeight: 500,
            color: '#1A1A1A',
            textAlign: 'center',
            lineHeight: 1.02,
            letterSpacing: -3,
            marginBottom: 28,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <span>Tes cours, tes QCM,</span>
          <span style={{ fontStyle: 'italic', color: '#1B4332' }}>ton planning.</span>
        </div>

        {/* Subtitle italique */}
        <div
          style={{
            fontSize: 30,
            fontStyle: 'italic',
            color: '#5C5C5A',
            textAlign: 'center',
            lineHeight: 1.4,
            maxWidth: 900,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          La méthode des prépas, sans le prix.
        </div>

        {/* Footer subtle */}
        <div
          style={{
            position: 'absolute',
            bottom: 60,
            right: 80,
            fontSize: 16,
            color: '#9A9A98',
            letterSpacing: 1,
            display: 'flex',
            fontFamily: 'serif',
          }}
        >
          medrev — méthode des prépas, sans le prix
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Fraunces', data: frauncesRegular, style: 'normal', weight: 500 },
        { name: 'Fraunces', data: frauncesItalic, style: 'italic', weight: 400 },
      ],
    }
  )
}

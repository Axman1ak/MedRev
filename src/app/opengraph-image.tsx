// src/app/opengraph-image.tsx
//
// L'image qui s'affiche quand on partage un lien MedRev (WhatsApp, Instagram,
// Discord, LinkedIn…). 1200 × 630. Même langage que la page d'accueil :
// fond marine, logo M, titre en Bricolage Grotesque.

import { ImageResponse } from 'next/og'
import { MEDREV_M_PATH } from '@/components/MedRevMark'

export const runtime = 'edge'
export const alt = 'MedRev : ta P1, organisée toute seule. Fiches, QCM et planning de révision.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// On ne charge que les lettres utilisées, depuis Google Fonts.
async function loadGoogleFont(family: string, text: string): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=${family}&text=${encodeURIComponent(text)}`
  const css = await (await fetch(url)).text()
  const match = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)
  if (!match) throw new Error(`Failed to extract font URL for ${family}`)
  const fontResp = await fetch(match[1])
  if (!fontResp.ok) throw new Error(`Failed to fetch font: ${fontResp.status}`)
  return await fontResp.arrayBuffer()
}

const TEXT = 'MedRev Ta P1, organisée toute seule. Fiches, QCM et planning de révision. Pour la P1 : PASS et LAS www.medrev.fr'

export default async function Image() {
  const [bold, medium] = await Promise.all([
    loadGoogleFont('Bricolage+Grotesque:wght@700', TEXT),
    loadGoogleFont('Bricolage+Grotesque:wght@500', TEXT),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px 80px',
          background: 'radial-gradient(80% 90% at 85% 20%, #22507E 0%, #15304E 55%, #0F2440 100%)',
          color: '#fff',
          fontFamily: 'Bricolage',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <svg width="76" height="76" viewBox="0 0 48 48">
            <rect width="48" height="48" rx="13" fill="#fff" />
            <path d={MEDREV_M_PATH} fill="#15304E" />
          </svg>
          <div style={{ fontSize: 46, fontWeight: 700, letterSpacing: -1.5 }}>MedRev</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              alignSelf: 'flex-start',
              fontSize: 24,
              fontWeight: 500,
              color: '#9CC4E8',
              background: 'rgba(156, 196, 232, 0.14)',
              borderRadius: 12,
              padding: '8px 18px',
              marginBottom: 26,
            }}
          >
            Pour la P1 : PASS et LAS
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', fontSize: 92, fontWeight: 700, letterSpacing: -3.5, lineHeight: 1 }}>
            <span>Ta P1, organisée</span>
            <span style={{ color: '#9CC4E8' }}>toute seule.</span>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 28, fontWeight: 500, color: 'rgba(255,255,255,0.75)' }}>
          <span>Fiches, QCM et planning de révision.</span>
          <span>www.medrev.fr</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Bricolage', data: bold, style: 'normal', weight: 700 },
        { name: 'Bricolage', data: medium, style: 'normal', weight: 500 },
      ],
    }
  )
}

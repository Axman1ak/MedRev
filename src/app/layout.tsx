// src/app/layout.tsx
import type { Metadata } from 'next'
import './globals.css'
import { SpeedInsights } from '@vercel/speed-insights/next'

export const metadata: Metadata = {
  title: 'MedRev — Révision Médicale IA',
  description: 'Plateforme de révision médicale par répétition espacée, propulsée par l\'IA. Préparez les EDN avec des QCM générés sur vos cours.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  )
}

// src/app/layout.tsx
//
// Layout racine MedRev. Contient :
//  - les fonts (Fraunces, Plus Jakarta Sans, Cormorant Garamond, Cinzel,
//    JetBrains Mono) chargées via next/font pour optimisation auto
//  - les meta tags SEO + OpenGraph (carte de partage WhatsApp / Twitter…)
//  - l'export viewport (Next.js 14+ : themeColor n'est plus dans metadata)
//
// L'image OG est générée automatiquement par src/app/opengraph-image.tsx
// (convention Next.js — rien à référencer manuellement ici).

import type { Metadata, Viewport } from 'next'
import { Fraunces, Plus_Jakarta_Sans, Cormorant_Garamond, Cinzel, JetBrains_Mono } from 'next/font/google'
import './globals.css'

// ============================================================
// FONTS
// ============================================================
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
})

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  display: 'swap',
})

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
})

const cinzel = Cinzel({
  subsets: ['latin'],
  variable: '--font-cinzel',
  display: 'swap',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
})

// ============================================================
// VIEWPORT (séparé de metadata depuis Next.js 14)
// ============================================================
export const viewport: Viewport = {
  themeColor: '#FAFAF7',
  width: 'device-width',
  initialScale: 1,
}

// ============================================================
// METADATA — SEO + cartes de partage
// ============================================================
export const metadata: Metadata = {
  metadataBase: new URL('https://med-rev-eight.vercel.app'), // ⚠️ remplace par ton vrai domaine prod si différent

  title: {
    default: 'MedRev — Tes cours, tes QCM, ton planning.',
    template: '%s — MedRev',
  },
  description:
    'La méthode des prépas, sans le prix. Importe ta vidéo de cours et ton poly, MedRev génère 30 QCM et programme tes 14 paliers de révision. Pour les P1 françaises.',

  keywords: [
    'P1', 'PASS', 'LAS', 'médecine', 'révisions', 'QCM', 'concours médecine',
    'prépa médecine', 'Sorbonne', 'Paris Cité', 'Anki', 'Ebbinghaus',
    'spaced repetition', 'fiches de révision', 'planning révision',
  ],

  authors: [{ name: 'Lou Bonnefoy' }],
  creator: 'Lou Bonnefoy',
  publisher: 'MedRev',

  // OpenGraph (Facebook, WhatsApp, LinkedIn, Discord, iMessage…)
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: 'https://medrev.fr',
    siteName: 'MedRev',
    title: 'MedRev — Tes cours, tes QCM, ton planning.',
    description:
      'La méthode des prépas, sans le prix. 30 QCM générés sur ta vidéo, planning J0 → J+120, simulateur type concours.',
    // L'image OG est fournie automatiquement par opengraph-image.tsx
  },

  // Twitter / X
  twitter: {
    card: 'summary_large_image',
    title: 'MedRev — Tes cours, tes QCM, ton planning.',
    description:
      'La méthode des prépas, sans le prix. 30 QCM sur ta vidéo, 14 paliers de révision, 100 % auto-organisé. Pour les P1.',
    creator: '@medrev_fr', // change ou supprime si pas de compte X
  },

  // Robots / SEO
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // Favicon — Next.js détecte aussi /app/icon.png automatiquement
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon.png',
  },

  // Empêche iOS de transformer les chiffres en liens tel:
  formatDetection: {
    telephone: false,
  },

  category: 'education',
}

// ============================================================
// ROOT LAYOUT
// ============================================================
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="fr"
      className={`${fraunces.variable} ${jakarta.variable} ${cormorant.variable} ${cinzel.variable} ${jetbrains.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}

// src/app/layout.tsx
//
// Layout racine MedRev. Contient :
//  - les fonts (Bricolage Grotesque + Hanken Grotesk pour la refonte, plus
//    Fraunces, Plus Jakarta Sans, Cormorant Garamond, Cinzel, JetBrains Mono
//    conservées le temps de migrer les pages) chargées via next/font
//  - les meta tags SEO + OpenGraph (carte de partage WhatsApp / Twitter…)
//  - l'export viewport (Next.js 14+ : themeColor n'est plus dans metadata)
//
// L'image OG est générée automatiquement par src/app/opengraph-image.tsx
// (convention Next.js — rien à référencer manuellement ici).

import type { Metadata, Viewport } from 'next'
import { Bricolage_Grotesque, Hanken_Grotesk, Fraunces, Plus_Jakarta_Sans, Cormorant_Garamond, Cinzel, JetBrains_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

// ============================================================
// FONTS
// ============================================================
// Refonte « Marine » : Bricolage Grotesque (titres) + Hanken Grotesk (UI).
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  display: 'swap',
})

const hanken = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-hanken',
  display: 'swap',
})

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
  metadataBase: new URL('https://medrev.fr'),

  title: {
    default: 'MedRev · Toute ta P1, organisée pour le concours',
    template: '%s · MedRev',
  },
  description:
    'La méthode des prépas, sans le prix. QCM générés depuis tes cours, révisions planifiées jusqu\'au concours et simulateur d\'examen. Pour les PASS et LAS.',

  keywords: [
    'P1', 'PASS', 'LAS', '1re année santé', 'concours médecine 2026',
    'réviser PASS', 'réviser LAS', 'médecine', 'révisions', 'QCM',
    'concours médecine', 'examens médecine', 'simulateur examen médecine',
    'prépa médecine', 'Sorbonne', 'Paris Cité', 'Ebbinghaus',
    'spaced repetition', 'fiches de révision', 'planning révision',
  ],

  authors: [{ name: 'MedRev' }],
  creator: 'MedRev',
  publisher: 'MedRev',

  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: 'https://medrev.fr',
    siteName: 'MedRev',
    title: 'MedRev · Toute ta P1, organisée pour le concours',
    description:
      'La méthode des prépas, sans le prix. 30 QCM générés sur tes cours, révisions planifiées jusqu\'au concours, simulateur d\'examen.',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'MedRev · Toute ta P1, organisée pour le concours',
    description:
      'La méthode des prépas, sans le prix. QCM générés sur tes cours, 14 paliers de révision, simulateur d\'examen. Pour les PASS/LAS.',
  },

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

  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon.png',
  },

  formatDetection: {
    telephone: false,
  },

  category: 'education',
}

// ============================================================
// DONNÉES STRUCTURÉES (JSON-LD)
// ============================================================
// Aide Google à comprendre QUI est MedRev : un outil de révision pour les
// étudiants en 1re année de médecine (PASS/LAS), et PAS l'autre appli de
// nutrition qui porte un nom proche. Déclare l'entité, le site et le type
// d'application (EducationalApplication).
const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://medrev.fr/#organization',
      name: 'MedRev',
      url: 'https://medrev.fr',
      logo: 'https://medrev.fr/apple-icon.png',
      description:
        "MedRev est un outil de révision pour les étudiants en première année de médecine (PASS et LAS) en France : QCM générés depuis les cours, planning de révision et simulateur d'examen.",
    },
    {
      '@type': 'WebSite',
      '@id': 'https://medrev.fr/#website',
      url: 'https://medrev.fr',
      name: 'MedRev',
      inLanguage: 'fr-FR',
      publisher: { '@id': 'https://medrev.fr/#organization' },
    },
    {
      '@type': 'SoftwareApplication',
      name: 'MedRev',
      url: 'https://medrev.fr',
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web',
      inLanguage: 'fr-FR',
      description:
        "Application de révision pour la première année de médecine (PASS/LAS) : QCM générés depuis tes cours, révisions planifiées jusqu'au concours et simulateur d'examen.",
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    },
  ],
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
      className={`${bricolage.variable} ${hanken.variable} ${fraunces.variable} ${jakarta.variable} ${cormorant.variable} ${cinzel.variable} ${jetbrains.variable}`}
    >
      <body>
        {children}
        <Analytics />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  )
}

// src/app/layout.tsx
//
// Snippet à intégrer dans ton layout.tsx racine. Si tu as déjà un export
// `metadata`, fusionne — sinon copie-colle tel quel au-dessus du composant
// RootLayout.
//
// metadataBase est CRUCIAL : sans lui, Next.js ne sait pas construire les
// URLs absolues pour les OG images. Mets ton vrai domaine prod ici.

import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL('https://med-rev-eight.vercel.app'), // ⚠️ remplace par ton domaine prod

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

  // Carte OpenGraph (Facebook, WhatsApp, LinkedIn, Discord, iMessage…)
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: 'https://medrev.fr',
    siteName: 'MedRev',
    title: 'MedRev — Tes cours, tes QCM, ton planning.',
    description:
      'La méthode des prépas, sans le prix. 30 QCM générés sur ta vidéo, planning J0 → J+120, simulateur type concours.',
    // L'image est auto-fournie par opengraph-image.tsx — pas besoin de la
    // référencer ici manuellement, Next.js s'en occupe via la convention.
  },

  // Twitter / X
  twitter: {
    card: 'summary_large_image',
    title: 'MedRev — Tes cours, tes QCM, ton planning.',
    description:
      'La méthode des prépas, sans le prix. 30 QCM sur ta vidéo, 14 paliers de révision, 100 % auto-organisé. Pour les P1.',
    creator: '@medrev_fr', // change ou supprime si pas de compte
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

  // Verification (à remplir si tu utilises Google Search Console)
  // verification: {
  //   google: 'ton-code-google-search-console',
  // },

  // Icône / favicon — Next.js détecte aussi /app/icon.png automatiquement
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-icon.png',
  },

  // Couleur du thème (barre Safari iOS / Chrome Android)
  themeColor: '#FAFAF7',

  // Format detection (empêche iOS de transformer les chiffres en liens tel:)
  formatDetection: {
    telephone: false,
  },

  category: 'education',
}

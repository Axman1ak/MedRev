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
  // Safari sur iPhone teinte ses barres du haut et du bas avec cette couleur.
  // Ces deux valeurs ne sont qu'un point de depart pour la toute premiere
  // image : le script d'amorcage ci-dessous les remplace ensuite par la couleur
  // du theme reellement choisi dans MedRev. Le reglage du telephone est le
  // meilleur pari en attendant.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FAFAF7' },
    { media: '(prefers-color-scheme: dark)', color: '#0A111E' },
  ],
  colorScheme: 'light dark',
  width: 'device-width',
  initialScale: 1,
}

// ============================================================
// AMORCAGE DU THEME
// ============================================================
// Ce script s'execute avant le premier affichage, sur toutes les pages.
//
// Avant, seule la page Reglages posait data-theme. Partout ailleurs l'attribut
// n'existait pas : le site s'affichait en clair meme pour quelqu'un qui avait
// choisi le sombre, puis basculait tout seul des qu'on ouvrait Reglages, et le
// restait jusqu'au rechargement suivant.
//
// Il doit etre ici et bloquant : le faire depuis un useEffect afficherait
// d'abord un ecran blanc, ce qui est pire que le bug d'origine.
//
// Il double src/lib/theme.ts, qu'un script en ligne ne peut pas importer. Si tu
// changes la cle de stockage ou les couleurs, change les deux.
const THEME_BOOTSTRAP = `(function(){try{
var t=localStorage.getItem('medrev-theme')==='dark'?'dark':'light';
var d=document.documentElement;
d.setAttribute('data-theme',t);
d.style.colorScheme=t;
var c=t==='dark'?'#0A111E':'#FAFAF7';
var apply=function(){
var m=document.querySelectorAll('meta[name="theme-color"]');
if(!m.length){var n=document.createElement('meta');n.setAttribute('name','theme-color');n.setAttribute('content',c);document.head.appendChild(n);return}
for(var i=0;i<m.length;i++){m[i].setAttribute('content',c)}
};
apply();
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',apply)}
}catch(e){}})()`

// ============================================================
// METADATA — SEO + cartes de partage
// ============================================================
export const metadata: Metadata = {
  metadataBase: new URL('https://med-rev-eight.vercel.app'),

  title: {
    default: 'MedRev · Tes cours, tes QCM, ton planning.',
    template: '%s · MedRev',
  },
  description:
    'La méthode des prépas, sans le prix. Importe ta vidéo de cours et ton poly, MedRev génère 30 QCM et programme tes 14 paliers de révision. Pour les P1 françaises.',

  keywords: [
    'P1', 'PASS', 'LAS', '1re année santé', 'voie unique santé',
    'réforme études de santé 2027', 'médecine', 'révisions', 'QCM',
    'concours médecine', 'examens médecine', 'contrôle continu santé',
    'prépa médecine', 'Sorbonne', 'Paris Cité', 'Ebbinghaus',
    'spaced repetition', 'fiches de révision', 'planning révision',
  ],

  authors: [{ name: 'MedRev' }],
  creator: 'MedRev',
  publisher: 'MedRev',

  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    url: 'https://med-rev-eight.vercel.app',
    siteName: 'MedRev',
    title: 'MedRev · Tes cours, tes QCM, ton planning.',
    description:
      'La méthode des prépas, sans le prix. 30 QCM générés sur ta vidéo, planning J0 → J+120, simulateur type examens.',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'MedRev · Tes cours, tes QCM, ton planning.',
    description:
      'La méthode des prépas, sans le prix. 30 QCM sur ta vidéo, 14 paliers de révision, 100 % auto-organisé. Pour les P1.',
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
      suppressHydrationWarning
    >
      <head>
        {/* Avant tout le reste : le theme choisi, pose sur <html> avant le
            premier pixel. suppressHydrationWarning sur <html> parce que le
            serveur ne peut pas connaitre ce choix, donc l'attribut differe
            forcement entre le HTML envoye et celui du navigateur. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  )
}

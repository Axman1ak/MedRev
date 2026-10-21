// src/app/page.tsx  ← Server Component (pas de 'use client')
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import HomeLanding from '@/components/HomeLanding'
import { SITE_URL, SOCIAL_PROFILES } from '@/lib/site'

// L'adresse canonique de l'accueil : une seule pour Google.
export const metadata: Metadata = {
  alternates: { canonical: SITE_URL + '/' },
}

// Données structurées : le nom du site (« MedRev ») et son logo, que Google
// utilise pour le nom affiché au-dessus du résultat et pour l'icône.
const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      '@id': SITE_URL + '/#site',
      name: 'MedRev',
      alternateName: ['medrev.fr', 'Med Rev', 'MedRev médecine', 'MedRev P1'],
      url: SITE_URL + '/',
      inLanguage: 'fr-FR',
    },
    {
      '@type': 'Organization',
      '@id': SITE_URL + '/#org',
      name: 'MedRev',
      url: SITE_URL + '/',
      logo: SITE_URL + '/icon-512.png',
      ...(SOCIAL_PROFILES.length ? { sameAs: SOCIAL_PROFILES } : {}),
    },
  ],
}

export default async function Home() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <HomeLanding />
    </>
  )
}

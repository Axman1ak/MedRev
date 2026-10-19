import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/site'

const BASE = SITE_URL

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ['', '/guides/organiser-sa-p1', '/methode', '/manifesto', '/contact', '/mentions-legales', '/cgu', '/confidentialite']
  const now = new Date()
  return pages.map(p => ({
    url: `${BASE}${p}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: p === '' ? 1 : 0.6,
  }))
}

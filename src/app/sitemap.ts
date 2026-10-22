import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/site'

const BASE = SITE_URL

export default function sitemap(): MetadataRoute.Sitemap {
  // Seules ces pages sont proposées à Google ; les autres sont en noindex.
  const pages = ['', '/guides/organiser-sa-p1']
  const now = new Date()
  return pages.map(p => ({
    url: `${BASE}${p}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: p === '' ? 1 : 0.6,
  }))
}

import type { MetadataRoute } from 'next'

import { SITE_URL } from '@/lib/site'

const BASE = SITE_URL

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // L'app connectée et les routes techniques n'ont rien à faire dans l'index.
      disallow: ['/dashboard', '/api', '/auth'],
    },
    sitemap: `${BASE}/sitemap.xml`,
  }
}

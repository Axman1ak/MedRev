import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://med-rev-eight.vercel.app'

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

import type { MetadataRoute } from 'next'

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://med-rev-eight.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = ['', '/pricing', '/methode', '/manifesto', '/cgu', '/confidentialite']
  const now = new Date()
  return pages.map(p => ({
    url: `${BASE}${p}`,
    lastModified: now,
    changeFrequency: 'monthly' as const,
    priority: p === '' ? 1 : 0.6,
  }))
}

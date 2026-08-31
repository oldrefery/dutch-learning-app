import { PRODUCTION_ORIGIN } from '@woordenaar/domain'
import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    host: PRODUCTION_ORIGIN,
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/app/',
        '/auth/',
        '/forgot-password',
        '/login',
        '/reset-password',
        '/share/',
        '/signup',
      ],
    },
    sitemap: `${PRODUCTION_ORIGIN}/sitemap.xml`,
  }
}

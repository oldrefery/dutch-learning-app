import { PRODUCTION_ORIGIN } from '@woordenaar/domain'
import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: PRODUCTION_ORIGIN,
      changeFrequency: 'monthly',
      priority: 1,
    },
  ]
}

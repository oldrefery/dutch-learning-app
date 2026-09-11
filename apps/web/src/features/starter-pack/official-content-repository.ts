import 'server-only'

import { createHash } from 'node:crypto'
import type { OfficialContentCatalogItem } from '@woordenaar/content/remote'
import { verifyRemoteOfficialContentVersion } from '@woordenaar/content/remote'
import { createClient } from '@/lib/supabase/server'
import type { StarterPackManifest } from './starter-pack-domain'
import { toStarterPackManifest } from './starter-pack-domain'

const CEFR_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])

const sha256 = async (value: string): Promise<string> =>
  createHash('sha256').update(value).digest('hex')

export async function getOfficialContentCatalog(): Promise<
  OfficialContentCatalogItem[]
> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('official_content_packs')
    .select(
      'pack_id, slug, title, description, cefr_level, entry_count, display_order, current_version, published_at'
    )
    .order('cefr_level')
    .order('display_order')
    .order('pack_id')

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST205') {
      return []
    }
    throw new Error('Could not load the official content catalog.')
  }

  return (data ?? []).flatMap(row => {
    if (
      !row.current_version ||
      !row.published_at ||
      !CEFR_LEVELS.has(row.cefr_level)
    ) {
      return []
    }
    return [
      {
        packId: row.pack_id,
        slug: row.slug,
        title: row.title,
        description: row.description,
        entryCount: row.entry_count,
        cefrLevel: row.cefr_level as OfficialContentCatalogItem['cefrLevel'],
        displayOrder: row.display_order,
        version: row.current_version,
        publishedAt: row.published_at,
      },
    ]
  })
}

export async function loadRemoteOfficialStarterPack(
  packId: string,
  version: string
): Promise<StarterPackManifest> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('official_content_pack_versions')
    .select('pack_id, version, manifest, content_sha256')
    .eq('pack_id', packId)
    .eq('version', version)
    .maybeSingle()

  if (error || !data) {
    throw new Error('The selected official content version is unavailable.')
  }

  const manifest = await verifyRemoteOfficialContentVersion(
    {
      packId: data.pack_id,
      version: data.version,
      manifest: data.manifest,
      contentSha256: data.content_sha256,
    },
    sha256
  )
  return toStarterPackManifest(manifest)
}

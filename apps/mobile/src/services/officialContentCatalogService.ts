import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Crypto from 'expo-crypto'
import type { OfficialContentManifest } from '@woordenaar/content/manifest'
import type {
  OfficialContentCatalogItem,
  RemoteOfficialContentVersion,
  Sha256,
} from '@woordenaar/content/remote'
import { verifyRemoteOfficialContentVersion } from '@woordenaar/content/remote'
import { supabase } from '@/lib/supabaseClient'

const CATALOG_CACHE_KEY = '@woordenaar/official-content/catalog/v1'
const PACK_CACHE_PREFIX = '@woordenaar/official-content/pack/v1'
const CEFR_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])

type UnknownRecord = Record<string, unknown>

interface CatalogGateway {
  fetchCatalog(): Promise<unknown>
  fetchVersion(packId: string, version: string): Promise<unknown>
}

interface CatalogStorage {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
}

interface OfficialContentCatalogDependencies {
  gateway: CatalogGateway
  sha256: Sha256
  storage: CatalogStorage
}

export interface LoadedOfficialContentPack {
  manifest: OfficialContentManifest
  source: 'cache' | 'network'
}

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parseCatalog = (value: unknown): OfficialContentCatalogItem[] => {
  if (!Array.isArray(value)) {
    throw new Error('Official content catalog response is invalid.')
  }
  return value.map((item, index) => {
    if (
      !isRecord(item) ||
      typeof item.pack_id !== 'string' ||
      typeof item.slug !== 'string' ||
      typeof item.title !== 'string' ||
      typeof item.description !== 'string' ||
      typeof item.cefr_level !== 'string' ||
      !CEFR_LEVELS.has(item.cefr_level) ||
      typeof item.display_order !== 'number' ||
      typeof item.entry_count !== 'number' ||
      !Number.isInteger(item.entry_count) ||
      item.entry_count <= 0 ||
      typeof item.current_version !== 'string' ||
      typeof item.published_at !== 'string'
    ) {
      throw new Error(`Official content catalog item ${index + 1} is invalid.`)
    }
    return {
      packId: item.pack_id,
      slug: item.slug,
      title: item.title,
      description: item.description,
      cefrLevel: item.cefr_level as OfficialContentCatalogItem['cefrLevel'],
      displayOrder: item.display_order,
      entryCount: item.entry_count,
      version: item.current_version,
      publishedAt: item.published_at,
    }
  })
}

const parseRemoteVersion = (value: unknown): RemoteOfficialContentVersion => {
  if (
    !isRecord(value) ||
    typeof value.pack_id !== 'string' ||
    typeof value.version !== 'string' ||
    typeof value.content_sha256 !== 'string' ||
    !('manifest' in value)
  ) {
    throw new Error('Official content version response is invalid.')
  }
  return {
    packId: value.pack_id,
    version: value.version,
    manifest: value.manifest,
    contentSha256: value.content_sha256,
  }
}

const packCacheKey = (packId: string, version: string): string =>
  `${PACK_CACHE_PREFIX}/${encodeURIComponent(packId)}/${encodeURIComponent(version)}`

const readCache = async (
  storage: CatalogStorage,
  key: string
): Promise<string | null> => {
  try {
    return await storage.getItem(key)
  } catch {
    return null
  }
}

const writeCache = async (
  storage: CatalogStorage,
  key: string,
  value: unknown
): Promise<void> => {
  try {
    await storage.setItem(key, JSON.stringify(value))
  } catch {
    // A storage failure must not make verified network content unavailable.
  }
}

const defaultGateway: CatalogGateway = {
  async fetchCatalog() {
    const { data, error } = await supabase
      .from('official_content_packs')
      .select(
        'pack_id, slug, title, description, cefr_level, entry_count, display_order, current_version, published_at'
      )
      .order('cefr_level')
      .order('display_order')
      .order('pack_id')
    if (error) throw error
    return data ?? []
  },
  async fetchVersion(packId, version) {
    const { data, error } = await supabase
      .from('official_content_pack_versions')
      .select('pack_id, version, manifest, content_sha256')
      .eq('pack_id', packId)
      .eq('version', version)
      .maybeSingle()
    if (error) throw error
    if (!data) throw new Error('Official content version is unavailable.')
    return data
  },
}

const defaultSha256: Sha256 = value =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value)

export const createOfficialContentCatalogService = ({
  gateway,
  sha256,
  storage,
}: OfficialContentCatalogDependencies) => ({
  async getCatalog(): Promise<OfficialContentCatalogItem[]> {
    try {
      const response = await gateway.fetchCatalog()
      const catalog = parseCatalog(response)
      await writeCache(storage, CATALOG_CACHE_KEY, response)
      return catalog
    } catch (networkError) {
      const cached = await readCache(storage, CATALOG_CACHE_KEY)
      if (cached) {
        try {
          return parseCatalog(JSON.parse(cached))
        } catch {
          // Preserve the original network error when the cache is corrupt.
        }
      }
      throw networkError
    }
  },

  async getPack(
    packId: string,
    version: string
  ): Promise<LoadedOfficialContentPack> {
    const cacheKey = packCacheKey(packId, version)
    try {
      const remote = parseRemoteVersion(
        await gateway.fetchVersion(packId, version)
      )
      const manifest = await verifyRemoteOfficialContentVersion(remote, sha256)
      await writeCache(storage, cacheKey, {
        pack_id: remote.packId,
        version: remote.version,
        manifest: remote.manifest,
        content_sha256: remote.contentSha256,
      })
      return { manifest, source: 'network' }
    } catch (networkError) {
      const cached = await readCache(storage, cacheKey)
      if (cached) {
        try {
          const remote = parseRemoteVersion(JSON.parse(cached))
          const manifest = await verifyRemoteOfficialContentVersion(
            remote,
            sha256
          )
          return { manifest, source: 'cache' }
        } catch {
          // Preserve the original network or validation error.
        }
      }
      throw networkError
    }
  },
})

export const officialContentCatalogService =
  createOfficialContentCatalogService({
    gateway: defaultGateway,
    sha256: defaultSha256,
    storage: AsyncStorage,
  })

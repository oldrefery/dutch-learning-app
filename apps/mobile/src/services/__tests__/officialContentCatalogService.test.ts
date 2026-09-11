import { createHash } from 'node:crypto'
import bundledPack from '@woordenaar/content'
import { canonicalizeOfficialContent } from '@woordenaar/content/remote'
import { createOfficialContentCatalogService } from '@/services/officialContentCatalogService'

const cloneBundledPack = () => JSON.parse(JSON.stringify(bundledPack))
const sha256 = async (value: string) =>
  createHash('sha256').update(value).digest('hex')

const catalogRow = {
  pack_id: 'official-dutch-a2-frequency-1',
  slug: 'dutch-a2-frequency-1',
  title: 'Dutch A2 · 1',
  description: 'High-frequency A2 vocabulary.',
  cefr_level: 'A2',
  display_order: 1,
  entry_count: 100,
  current_version: '1.0.0',
  published_at: '2026-09-11T10:00:00Z',
}

const createStorage = () => {
  const values = new Map<string, string>()
  return {
    values,
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      values.set(key, value)
    }),
  }
}

const createRemoteVersion = async () => {
  const manifest = cloneBundledPack()
  manifest.pack_id = catalogRow.pack_id
  manifest.version = catalogRow.current_version
  return {
    pack_id: manifest.pack_id,
    version: manifest.version,
    manifest,
    content_sha256: await sha256(canonicalizeOfficialContent(manifest)),
  }
}

describe('officialContentCatalogService', () => {
  it('falls back to the validated cached catalog while offline', async () => {
    const storage = createStorage()
    const gateway = {
      fetchCatalog: jest
        .fn()
        .mockResolvedValueOnce([catalogRow])
        .mockRejectedValueOnce(new Error('offline')),
      fetchVersion: jest.fn(),
    }
    const service = createOfficialContentCatalogService({
      gateway,
      sha256,
      storage,
    })

    await expect(service.getCatalog()).resolves.toEqual([
      expect.objectContaining({
        packId: catalogRow.pack_id,
        cefrLevel: 'A2',
        entryCount: 100,
      }),
    ])
    await expect(service.getCatalog()).resolves.toEqual([
      expect.objectContaining({ packId: catalogRow.pack_id, version: '1.0.0' }),
    ])
  })

  it('serves a verified downloaded pack from cache while offline', async () => {
    const storage = createStorage()
    const remote = await createRemoteVersion()
    const gateway = {
      fetchCatalog: jest.fn(),
      fetchVersion: jest
        .fn()
        .mockResolvedValueOnce(remote)
        .mockRejectedValueOnce(new Error('offline')),
    }
    const service = createOfficialContentCatalogService({
      gateway,
      sha256,
      storage,
    })

    await expect(
      service.getPack(remote.pack_id, remote.version)
    ).resolves.toEqual(expect.objectContaining({ source: 'network' }))
    await expect(
      service.getPack(remote.pack_id, remote.version)
    ).resolves.toEqual(
      expect.objectContaining({
        source: 'cache',
        manifest: expect.objectContaining({ pack_id: remote.pack_id }),
      })
    )
  })

  it('does not replace valid cache when downloaded content fails integrity', async () => {
    const storage = createStorage()
    const remote = await createRemoteVersion()
    const changed = cloneBundledPack()
    changed.pack_id = remote.pack_id
    changed.version = remote.version
    changed.entries[0].dutch_lemma = 'tampered'
    const gateway = {
      fetchCatalog: jest.fn(),
      fetchVersion: jest
        .fn()
        .mockResolvedValueOnce(remote)
        .mockResolvedValueOnce({ ...remote, manifest: changed }),
    }
    const service = createOfficialContentCatalogService({
      gateway,
      sha256,
      storage,
    })

    const first = await service.getPack(remote.pack_id, remote.version)
    const second = await service.getPack(remote.pack_id, remote.version)

    expect(first.source).toBe('network')
    expect(second.source).toBe('cache')
    expect(second.manifest.entries[0].dutch_lemma).not.toBe('tampered')
    expect(storage.setItem).toHaveBeenCalledTimes(1)
  })
})

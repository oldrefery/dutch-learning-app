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

const createRemoteVersion = async (
  packId = catalogRow.pack_id,
  version = catalogRow.current_version
) => {
  const manifest = cloneBundledPack()
  manifest.pack_id = packId
  manifest.version = version
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

  it('rejects a valid network response for a different requested identity', async () => {
    const storage = createStorage()
    const otherRemote = await createRemoteVersion('dutch-b1-01')
    const service = createOfficialContentCatalogService({
      gateway: {
        fetchCatalog: jest.fn(),
        fetchVersion: jest.fn().mockResolvedValue(otherRemote),
      },
      sha256,
      storage,
    })

    await expect(
      service.getPack(catalogRow.pack_id, catalogRow.current_version)
    ).rejects.toThrow('does not match the requested identity')
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('rejects a mismatched cached response under the requested cache key', async () => {
    const storage = createStorage()
    const otherRemote = await createRemoteVersion('dutch-b1-01')
    const requestedCacheKey =
      '@woordenaar/official-content/pack/v2/official-dutch-a2-frequency-1/1.0.0'
    storage.values.set(requestedCacheKey, JSON.stringify(otherRemote))
    const service = createOfficialContentCatalogService({
      gateway: {
        fetchCatalog: jest.fn(),
        fetchVersion: jest.fn().mockRejectedValue(new Error('offline')),
      },
      sha256,
      storage,
    })

    await expect(
      service.getPack(catalogRow.pack_id, catalogRow.current_version)
    ).rejects.toThrow('offline')
  })

  it('keeps verified network content usable when cache writes fail', async () => {
    const storage = createStorage()
    storage.setItem.mockRejectedValue(new Error('quota exceeded'))
    const remote = await createRemoteVersion()
    const service = createOfficialContentCatalogService({
      gateway: {
        fetchCatalog: jest.fn(),
        fetchVersion: jest.fn().mockResolvedValue(remote),
      },
      sha256,
      storage,
    })

    await expect(
      service.getPack(remote.pack_id, remote.version)
    ).resolves.toEqual(expect.objectContaining({ source: 'network' }))
  })

  it('keeps a validated catalog usable when its cache write fails', async () => {
    const storage = createStorage()
    storage.setItem.mockRejectedValue(new Error('quota exceeded'))
    const service = createOfficialContentCatalogService({
      gateway: {
        fetchCatalog: jest.fn().mockResolvedValue([catalogRow]),
        fetchVersion: jest.fn(),
      },
      sha256,
      storage,
    })

    await expect(service.getCatalog()).resolves.toEqual([
      expect.objectContaining({ packId: catalogRow.pack_id }),
    ])
  })

  it('invalidates the v1 catalog cache after entry_count became required', async () => {
    const storage = createStorage()
    const oldCatalogRow = { ...catalogRow }
    delete (oldCatalogRow as Partial<typeof catalogRow>).entry_count
    storage.values.set(
      '@woordenaar/official-content/catalog/v1',
      JSON.stringify([oldCatalogRow])
    )
    const service = createOfficialContentCatalogService({
      gateway: {
        fetchCatalog: jest.fn().mockRejectedValue(new Error('offline')),
        fetchVersion: jest.fn(),
      },
      sha256,
      storage,
    })

    await expect(service.getCatalog()).rejects.toThrow('offline')
    expect(storage.getItem).toHaveBeenCalledWith(
      '@woordenaar/official-content/catalog/v2'
    )
  })

  it('rejects a corrupt current catalog cache while offline', async () => {
    const storage = createStorage()
    storage.values.set('@woordenaar/official-content/catalog/v2', '{invalid')
    const service = createOfficialContentCatalogService({
      gateway: {
        fetchCatalog: jest.fn().mockRejectedValue(new Error('offline')),
        fetchVersion: jest.fn(),
      },
      sha256,
      storage,
    })

    await expect(service.getCatalog()).rejects.toThrow('offline')
  })

  it('rejects a corrupt current pack cache while offline', async () => {
    const storage = createStorage()
    storage.values.set(
      '@woordenaar/official-content/pack/v2/official-dutch-a2-frequency-1/1.0.0',
      '{invalid'
    )
    const service = createOfficialContentCatalogService({
      gateway: {
        fetchCatalog: jest.fn(),
        fetchVersion: jest.fn().mockRejectedValue(new Error('offline')),
      },
      sha256,
      storage,
    })

    await expect(
      service.getPack(catalogRow.pack_id, catalogRow.current_version)
    ).rejects.toThrow('offline')
  })
})

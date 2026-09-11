import { createHash } from 'node:crypto'
import bundledPack from '@woordenaar/content'
import {
  canonicalizeOfficialContent,
  verifyRemoteOfficialContentVersion,
} from '@woordenaar/content/remote'

const cloneBundledPack = () => JSON.parse(JSON.stringify(bundledPack))
const sha256 = async (value: string) =>
  createHash('sha256').update(value).digest('hex')

describe('remote official content integrity', () => {
  it('accepts equivalent JSON independently of object key order', async () => {
    const manifest = cloneBundledPack()
    const reordered = Object.fromEntries(Object.entries(manifest).reverse())
    const digest = await sha256(canonicalizeOfficialContent(manifest))

    await expect(
      verifyRemoteOfficialContentVersion(
        {
          packId: manifest.pack_id,
          version: manifest.version,
          manifest: reordered,
          contentSha256: digest,
        },
        sha256
      )
    ).resolves.toEqual(reordered)
  })

  it('rejects changed content and mismatched catalog identity', async () => {
    const manifest = cloneBundledPack()
    const digest = await sha256(canonicalizeOfficialContent(manifest))
    const changed = cloneBundledPack()
    changed.entries[0].dutch_lemma = 'changed'

    await expect(
      verifyRemoteOfficialContentVersion(
        {
          packId: manifest.pack_id,
          version: manifest.version,
          manifest: changed,
          contentSha256: digest,
        },
        sha256
      )
    ).rejects.toThrow('integrity verification failed')

    await expect(
      verifyRemoteOfficialContentVersion(
        {
          packId: 'another-pack',
          version: manifest.version,
          manifest,
          contentSha256: digest,
        },
        sha256
      )
    ).rejects.toThrow('identity does not match')
  })
})

import bundledPack from '@woordenaar/content'
import { validateOfficialContentManifest } from '@woordenaar/content/manifest'

const cloneBundledPack = () => JSON.parse(JSON.stringify(bundledPack))

describe('official content manifest contract', () => {
  it('accepts a valid remote pack independently of the bundled pack size', () => {
    const remotePack = cloneBundledPack()
    remotePack.pack_id = 'official-dutch-c1-frequency-1'
    remotePack.version = '1.0.0'
    remotePack.entries = remotePack.entries.slice(0, 1)

    const result = validateOfficialContentManifest(remotePack)

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.entries).toHaveLength(1)
  })

  it.each([
    'word_id',
    'user_id',
    'collection_id',
    'image_url',
    'tts_url',
    'knowledge_level',
    'review_history',
    'srs_state',
  ])('rejects learner or mutable field %s', field => {
    const remotePack = cloneBundledPack() as {
      entries: Record<string, unknown>[]
    }
    remotePack.entries[0][field] = 'forbidden'

    const result = validateOfficialContentManifest(remotePack)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.issues).toContainEqual(
      expect.objectContaining({ path: `entries[0].${field}` })
    )
  })

  it('rejects two entries that collapse to one import semantic key', () => {
    const remotePack = cloneBundledPack()
    const duplicate = JSON.parse(JSON.stringify(remotePack.entries[0]))
    duplicate.entry_id = 'duplicate-entry-id'
    duplicate.dutch_lemma = `  ${duplicate.dutch_lemma.toUpperCase()}  `
    remotePack.entries = [remotePack.entries[0], duplicate]

    const result = validateOfficialContentManifest(remotePack)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.issues).toContainEqual({
      path: 'entries[1]',
      message: 'must have a unique import semantic key',
    })
  })
})

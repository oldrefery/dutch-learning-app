import { createHash } from 'node:crypto'
import bundled from '@woordenaar/content'
import {
  parseOfficialDictionaryMapping,
  officialEntryToDictionaryContent,
  verifyOfficialDictionaryMapping,
} from '@woordenaar/content/dictionary'
import { validateOfficialContentManifest } from '@woordenaar/content/manifest'
import { canonicalizeOfficialContent } from '@woordenaar/content/remote'
import {
  parseDictionaryContent,
  canonicalizeCefrInput,
} from '@woordenaar/domain'

const sha256 = async (value: string) =>
  createHash('sha256').update(value).digest('hex')
const manifest = () => {
  const result = validateOfficialContentManifest(bundled)
  if (!result.success) throw new Error('Invalid fixture')
  return result.data
}
const receipt = async () => ({
  schema_version: 1,
  pack_id: bundled.pack_id,
  version: bundled.version,
  manifest_sha256: await sha256(canonicalizeOfficialContent(bundled)),
  entries: [
    {
      pack_entry_id: bundled.entries[0].entry_id,
      reference: {
        entry_id: '10000000-0000-4000-8000-000000000001',
        revision_id: '20000000-0000-4000-8000-000000000001',
      },
      revision_content_sha256: await sha256(
        canonicalizeOfficialContent(
          officialEntryToDictionaryContent(manifest().entries[0])
        )
      ),
      revision: {
        revision_no: 1,
        schema_version: 1,
        cefr_input_sha256: await sha256(
          canonicalizeCefrInput(
            officialEntryToDictionaryContent(manifest().entries[0])
          )
        ),
      },
      provenance: {
        source_id: '30000000-0000-4000-8000-000000000001',
        provenance_locator: 'synthetic-reviewed-source',
      },
    },
  ],
})

describe('official dictionary mapping receipt', () => {
  it('normalizes old bundled content into valid complete dictionary content', () => {
    for (const entry of manifest().entries) {
      const content = officialEntryToDictionaryContent(entry)
      expect(parseDictionaryContent(content).success).toBe(true)
      expect(content.dutch_original).toBe(
        entry.dutch_original ?? entry.dutch_lemma
      )
      expect(content.translations.ru).toEqual(entry.translations.ru ?? [])
      expect(content.image_url).toBeNull()
      expect(content.tts_url).toBeNull()
    }
  })
  it('binds partial mappings to immutable v1 content without changing the manifest', async () => {
    const before = canonicalizeOfficialContent(bundled)
    const mapping = await receipt()
    await expect(
      verifyOfficialDictionaryMapping(mapping, manifest(), sha256)
    ).resolves.toEqual(mapping)
    expect(canonicalizeOfficialContent(bundled)).toBe(before)
    expect(validateOfficialContentManifest(bundled).success).toBe(true)
    expect(mapping.entries[0].reference.entry_id).not.toBe(
      mapping.entries[0].pack_entry_id
    )
  })

  it.each(['pack_id', 'version', 'manifest_sha256'] as const)(
    'rejects another %s',
    async field => {
      const mapping = await receipt()
      mapping[field] = field === 'manifest_sha256' ? 'b'.repeat(64) : 'another'
      await expect(
        verifyOfficialDictionaryMapping(mapping, manifest(), sha256)
      ).rejects.toThrow('does not match')
    }
  )

  it('rejects unknown pack entries and unapproved content', async () => {
    const mapping = await receipt()
    mapping.entries[0].pack_entry_id = 'unreviewed-entry'
    await expect(
      verifyOfficialDictionaryMapping(mapping, manifest(), sha256)
    ).rejects.toThrow('does not match')
    const pending = manifest()
    await expect(
      verifyOfficialDictionaryMapping(
        await receipt(),
        {
          ...pending,
          content_review: { ...pending.content_review, status: 'pending' },
        },
        sha256
      )
    ).rejects.toThrow('approved manifest')
  })

  it('rejects duplicate entries, malformed references and extra personal or CEFR fields', async () => {
    const mapping = await receipt()
    expect(() =>
      parseOfficialDictionaryMapping({
        ...mapping,
        entries: [...mapping.entries, ...mapping.entries],
      })
    ).toThrow('invalid')
    expect(() =>
      parseOfficialDictionaryMapping({ ...mapping, schema_version: 2 })
    ).toThrow('invalid')
    expect(() =>
      parseOfficialDictionaryMapping({ ...mapping, word_id: 'personal' })
    ).toThrow('invalid')
    for (const entry of [
      { ...mapping.entries[0], cefr_level: 'A1' },
      {
        ...mapping.entries[0],
        provenance: {
          ...mapping.entries[0].provenance,
          provenance_locator: '',
        },
      },
      {
        ...mapping.entries[0],
        reference: {
          entry_id: 'invalid',
          revision_id: mapping.entries[0].reference.revision_id,
        },
      },
    ]) {
      expect(() =>
        parseOfficialDictionaryMapping({ ...mapping, entries: [entry] })
      ).toThrow('invalid')
    }
  })
})

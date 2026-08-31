import {
  buildStarterPackImportPayload,
  buildStarterPackPreview,
  getStarterPackSemanticKey,
  loadOfficialStarterPack,
  selectStarterPackEntries,
} from './starter-pack-domain'

describe('starter pack domain', () => {
  it('loads the approved official pack', () => {
    const manifest = loadOfficialStarterPack()

    expect(manifest.packId).toBe('official-dutch-a1-essentials')
    expect(manifest.entries).toHaveLength(60)
    expect(manifest.entries[0]).toEqual(
      expect.objectContaining({
        entryId: 'a1-001-huis',
        dutchLemma: 'huis',
        article: 'het',
        translations: expect.objectContaining({ en: ['house', 'home'] }),
      })
    )
  })

  it('detects semantic duplicates independently of casing', () => {
    const manifest = loadOfficialStarterPack()
    const preview = buildStarterPackPreview(manifest, [
      {
        dutchLemma: 'HUIS',
        partOfSpeech: 'NOUN',
        article: 'HET',
        collectionName: 'Existing words',
      },
    ])

    expect(preview[0]).toEqual(
      expect.objectContaining({
        isDuplicate: true,
        duplicateCollectionName: 'Existing words',
      })
    )
    expect(preview[1]?.isDuplicate).toBe(false)
  })

  it('selects only known IDs once and builds RPC-safe JSON', () => {
    const manifest = loadOfficialStarterPack()
    const selected = selectStarterPackEntries(manifest, [
      'a1-001-huis',
      'missing-entry',
      'a1-001-huis',
      'a1-035-opstaan',
    ])
    const payload = buildStarterPackImportPayload(selected)

    expect(selected).toHaveLength(2)
    expect(payload).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dutch_lemma: 'huis',
          article: 'het',
          translations: { en: ['house', 'home'], ru: [] },
        }),
        expect.objectContaining({
          dutch_lemma: 'opstaan',
          is_separable: true,
          prefix_part: 'op',
          root_verb: 'staan',
        }),
      ])
    )
  })

  it('normalizes a semantic key using the database uniqueness fields', () => {
    expect(getStarterPackSemanticKey('  Huis ', 'NOUN', 'HET')).toBe(
      'huis|noun|het'
    )
    expect(getStarterPackSemanticKey('welkom', null, null)).toBe(
      'welkom|unknown|'
    )
  })
})

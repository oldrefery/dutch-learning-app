import dutchA1PackAsset from '@/assets/starter-packs/dutch-a1.json'
import {
  createStarterPackImportWords,
  getStarterPackPreview,
  isStarterPackReleaseReady,
  loadOfficialDutchA1Pack,
  validateStarterPackManifest,
} from '@/services/starterPackService'
import type { StarterPackManifest } from '@/types/StarterPackTypes'

describe('starterPackService', () => {
  it('loads the bundled offline pack with the expected manifest range', () => {
    const manifest = loadOfficialDutchA1Pack()

    expect(manifest.pack_id).toBe('official-dutch-a1-essentials')
    expect(manifest.entries).toHaveLength(60)
    expect(manifest.entries.length).toBeGreaterThanOrEqual(50)
    expect(manifest.entries.length).toBeLessThanOrEqual(100)
    expect(getStarterPackPreview(manifest).words).toHaveLength(60)
    expect(manifest.provenance).toEqual(
      expect.objectContaining({
        origin: 'existing-project-library',
        source_card_count: 1928,
        source_unique_semantic_count: 1917,
      })
    )
    expect(isStarterPackReleaseReady(manifest)).toBe(false)
  })

  it('rejects malformed linguistic fields and learner-owned progress', () => {
    const malformed = structuredClone(dutchA1PackAsset) as unknown as {
      entries: Record<string, unknown>[]
    }
    malformed.entries[0].article = 'een'
    malformed.entries[1].is_separable = true
    malformed.entries[1].interval_days = 30

    const result = validateStarterPackManifest(malformed)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'entries[0].article' }),
        expect.objectContaining({ path: 'entries[1].prefix_part' }),
        expect.objectContaining({ path: 'entries[1].root_verb' }),
        expect.objectContaining({ path: 'entries[1].interval_days' }),
      ])
    )
  })

  it('requires reviewer identity and date before approval', () => {
    const malformed = structuredClone(
      dutchA1PackAsset
    ) as unknown as StarterPackManifest
    malformed.content_review.status = 'approved'

    const result = validateStarterPackManifest(malformed)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'content_review' }),
      ])
    )
  })

  it('requires traceable database snapshot provenance', () => {
    const malformed = structuredClone(
      dutchA1PackAsset
    ) as unknown as StarterPackManifest
    malformed.provenance.source_card_count = undefined
    malformed.provenance.selection_method = undefined

    const result = validateStarterPackManifest(malformed)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: 'provenance.source_card_count',
        }),
        expect.objectContaining({
          path: 'provenance.selection_method',
        }),
      ])
    )
  })

  it('keeps the database snapshot concise and free of learner data', () => {
    const manifest = loadOfficialDutchA1Pack()
    const semanticKeys = new Set<string>()

    manifest.entries.forEach(entry => {
      semanticKeys.add(
        [entry.dutch_lemma, entry.part_of_speech, entry.article ?? '']
          .map(value => value.trim().toLowerCase())
          .join('|')
      )
      expect(entry.translations.en.length).toBeLessThanOrEqual(2)
      expect(entry.translations.ru?.length ?? 0).toBeLessThanOrEqual(2)
      expect(entry.examples?.length ?? 0).toBeLessThanOrEqual(2)
      expect(entry).not.toHaveProperty('word_id')
      expect(entry).not.toHaveProperty('user_id')
      expect(entry).not.toHaveProperty('collection_id')
      expect(entry).not.toHaveProperty('interval_days')
      expect(entry).not.toHaveProperty('next_review_date')
      expect(entry).not.toHaveProperty('image_url')
      expect(entry).not.toHaveProperty('tts_url')
    })

    expect(semanticKeys.size).toBe(manifest.entries.length)
  })

  it('imports only selected entries with fresh learner progression', () => {
    const manifest = loadOfficialDutchA1Pack()
    const reviewDate = '2026-08-29'

    const words = createStarterPackImportWords(
      manifest,
      ['a1-001-huis', 'a1-035-opstaan'],
      reviewDate
    )

    expect(words).toHaveLength(2)
    expect(words).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          dutch_lemma: 'huis',
          article: 'het',
          interval_days: 0,
          repetition_count: 0,
          easiness_factor: 2.5,
          next_review_date: reviewDate,
          last_reviewed_at: null,
        }),
        expect.objectContaining({
          dutch_lemma: 'opstaan',
          is_separable: true,
          prefix_part: 'op',
          root_verb: 'staan',
        }),
      ])
    )
    words.forEach(word => {
      expect(word).not.toHaveProperty('word_id')
      expect(word).not.toHaveProperty('user_id')
      expect(word).not.toHaveProperty('collection_id')
      expect(word).not.toHaveProperty('created_at')
      expect(word).not.toHaveProperty('updated_at')
    })
  })
})

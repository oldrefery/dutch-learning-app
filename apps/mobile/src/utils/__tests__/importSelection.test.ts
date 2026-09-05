import {
  buildImportWordSelections,
  getImportSuccessMessage,
  getSemanticWordKey,
} from '@/utils/importSelection'
import {
  getStarterPackPreview,
  loadOfficialDutchA1Pack,
} from '@/services/starterPackService'
import type { Word } from '@/types/database'

const EXISTING_COLLECTION_ID = 'existing-collection'

const createExistingWord = (overrides: Partial<Word> = {}): Word => ({
  ...getStarterPackPreview(loadOfficialDutchA1Pack()).words[0],
  user_id: 'user-id',
  interval_days: 4,
  repetition_count: 2,
  easiness_factor: 2.6,
  next_review_date: '2026-09-01',
  last_reviewed_at: '2026-08-28T00:00:00.000Z',
  ...overrides,
})

describe('importSelection', () => {
  it('normalizes the complete semantic key', () => {
    expect(getSemanticWordKey(' Huis ', ' Noun ', ' HET ')).toBe(
      'huis|noun|het'
    )
    expect(getSemanticWordKey(undefined, null, '   ')).toBe('|unknown|')
  })

  it('marks semantic duplicates and identifies their collection', () => {
    const preview = getStarterPackPreview(loadOfficialDutchA1Pack())
    const selections = buildImportWordSelections(
      preview.words.slice(0, 2),
      [
        createExistingWord({
          dutch_lemma: ' HUIS ',
          part_of_speech: 'NOUN',
          article: 'HET' as Word['article'],
          collection_id: EXISTING_COLLECTION_ID,
        }),
      ],
      [{ collection_id: EXISTING_COLLECTION_ID, name: 'My Dutch' }]
    )

    expect(selections[0]).toEqual(
      expect.objectContaining({
        selected: false,
        isDuplicate: true,
        existingInCollection: 'My Dutch',
      })
    )
    expect(selections[1]).toEqual(
      expect.objectContaining({ selected: true, isDuplicate: false })
    )
  })

  it('reports repeated imports as an idempotent no-op', () => {
    expect(getImportSuccessMessage(3, 0)).toBe(
      'No new words were imported. Selected words already exist in your collection.'
    )
  })

  it('keeps the first duplicate location even when it is unfiled', () => {
    const preview = getStarterPackPreview(loadOfficialDutchA1Pack())
    const unfiledWord = createExistingWord({ collection_id: null })
    const laterCopy = createExistingWord({
      word_id: 'later-copy',
      collection_id: EXISTING_COLLECTION_ID,
    })

    const [selection] = buildImportWordSelections(
      preview.words.slice(0, 1),
      [unfiledWord, laterCopy],
      [{ collection_id: EXISTING_COLLECTION_ID, name: 'Later collection' }]
    )

    expect(selection).toEqual(
      expect.objectContaining({
        selected: false,
        isDuplicate: true,
        existingInCollection: undefined,
      })
    )
  })

  it('formats complete and partially skipped imports', () => {
    expect(getImportSuccessMessage(1, 1)).toBe('Successfully imported 1 word')
    expect(getImportSuccessMessage(3, 1)).toBe(
      'Successfully imported 1 word. Skipped 2 duplicates.'
    )
    expect(getImportSuccessMessage(3, 2)).toBe(
      'Successfully imported 2 words. Skipped 1 duplicate.'
    )
    expect(getImportSuccessMessage(3, 3)).toBe('Successfully imported 3 words')
  })
})

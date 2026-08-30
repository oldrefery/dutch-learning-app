import {
  buildCollectionDetail,
  filterCollectionWords,
  isCollectionId,
} from './collection-detail'
import type {
  CollectionDetailRow,
  CollectionWordRow,
} from './collection-detail'

const collection: CollectionDetailRow = {
  collection_id: '18efc3c3-058d-47e3-9bba-868755678c87',
  created_at: '2026-08-01T12:00:00.000Z',
  is_shared: null,
  name: 'Travel',
  updated_at: null,
}

const createWord = (
  overrides: Partial<CollectionWordRow> = {}
): CollectionWordRow => ({
  article: null,
  collection_id: collection.collection_id,
  created_at: '2026-08-01T12:00:00.000Z',
  dutch_lemma: 'reizen',
  dutch_original: null,
  image_url: null,
  interval_days: 1,
  next_review_date: '2026-08-31T12:00:00.000Z',
  part_of_speech: 'verb',
  repetition_count: 0,
  translations: { en: ['to travel'] },
  word_id: 'word-1',
  ...overrides,
})

describe('collection detail', () => {
  it('maps word data and calculates collection stats', () => {
    const detail = buildCollectionDetail(
      collection,
      [
        createWord({
          next_review_date: '2026-08-29T12:00:00.000Z',
          repetition_count: 3,
        }),
        createWord({
          dutch_lemma: 'trein',
          repetition_count: 0,
          translations: { en: ['train'] },
          word_id: 'word-2',
        }),
      ],
      new Date('2026-08-30T12:00:00.000Z')
    )

    expect(detail).toMatchObject({
      dueWords: 1,
      masteredWords: 1,
      newWords: 1,
      progressPercentage: 50,
      totalWords: 2,
    })
    expect(detail.words[0]).toMatchObject({
      dutchLemma: 'reizen',
      isDue: true,
      isMastered: true,
      translation: 'to travel',
    })
  })

  it('normalizes missing or invalid translations', () => {
    const detail = buildCollectionDetail(collection, [
      createWord({ translations: { en: [null, ''] } }),
    ])

    expect(detail.words[0].translation).toBe('No translation')
  })

  it('filters Dutch lemmas case-insensitively', () => {
    const detail = buildCollectionDetail(collection, [
      createWord({ dutch_lemma: 'Één', word_id: 'word-1' }),
      createWord({ dutch_lemma: 'Twee', word_id: 'word-2' }),
    ])

    expect(filterCollectionWords(detail.words, '  ÉÉ  ')).toHaveLength(1)
    expect(filterCollectionWords(detail.words, '')).toHaveLength(2)
  })

  it('accepts only UUID collection identifiers', () => {
    expect(isCollectionId(collection.collection_id)).toBe(true)
    expect(isCollectionId('not-a-uuid')).toBe(false)
  })
})

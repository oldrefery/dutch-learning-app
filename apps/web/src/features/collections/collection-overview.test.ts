import { buildCollectionOverviews } from './collection-overview'
import type {
  CollectionSummaryRow,
  WordSummaryRow,
} from './collection-overview'

const NOW = new Date('2026-08-30T12:00:00.000Z')

const createCollection = (
  overrides: Partial<CollectionSummaryRow> = {}
): CollectionSummaryRow => ({
  collection_id: 'collection-1',
  created_at: '2026-08-01T10:00:00.000Z',
  is_shared: false,
  name: 'Everyday Dutch',
  updated_at: null,
  ...overrides,
})

const createWord = (
  overrides: Partial<WordSummaryRow> = {}
): WordSummaryRow => ({
  collection_id: 'collection-1',
  next_review_date: '2026-08-31T12:00:00.000Z',
  repetition_count: 0,
  ...overrides,
})

describe('buildCollectionOverviews', () => {
  it('returns empty statistics for a collection without words', () => {
    expect(buildCollectionOverviews([createCollection()], [], NOW)).toEqual([
      {
        id: 'collection-1',
        name: 'Everyday Dutch',
        isShared: false,
        createdAt: '2026-08-01T10:00:00.000Z',
        updatedAt: null,
        totalWords: 0,
        masteredWords: 0,
        dueWords: 0,
        newWords: 0,
        progressPercentage: 0,
      },
    ])
  })

  it('calculates mastered progress and words due now', () => {
    const words = [
      createWord({
        repetition_count: 3,
        next_review_date: '2026-08-30T11:59:59.000Z',
      }),
      createWord({ repetition_count: 4 }),
      createWord({
        repetition_count: 1,
        next_review_date: 'not-a-date',
      }),
    ]

    expect(
      buildCollectionOverviews([createCollection()], words, NOW)[0]
    ).toMatchObject({
      totalWords: 3,
      masteredWords: 2,
      dueWords: 1,
      newWords: 0,
      progressPercentage: 67,
    })
  })

  it('ignores unassigned words and keeps collection order', () => {
    const collections = [
      createCollection(),
      createCollection({
        collection_id: 'collection-2',
        is_shared: true,
        name: 'Work',
      }),
    ]
    const words = [
      createWord({ collection_id: null }),
      createWord({ collection_id: 'collection-2' }),
    ]

    const result = buildCollectionOverviews(collections, words, NOW)

    expect(result.map(collection => collection.name)).toEqual([
      'Everyday Dutch',
      'Work',
    ])
    expect(result[0].totalWords).toBe(0)
    expect(result[1]).toMatchObject({
      totalWords: 1,
      newWords: 1,
      isShared: true,
    })
  })
})

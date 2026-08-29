import {
  DIFFICULT_EASINESS_FACTOR_THRESHOLD,
  REVIEW_MODE,
  REVIEW_SCOPE,
} from '@/constants/ReviewConstants'
import {
  createMockCollection,
  createMockWord,
} from '@/__tests__/helpers/factories'
import type { Word } from '@/types/database'
import type { ReviewSessionConfig } from '@/types/ReviewTypes'
import { selectReviewWords } from '../reviewSession'

const TODAY = '2026-08-28'
const TOMORROW = '2026-08-29'

describe('selectReviewWords', () => {
  const userId = 'review-user'
  const collection = createMockCollection({
    collection_id: 'collection-a',
    user_id: userId,
  })
  const referenceDate = new Date(2026, 7, 28, 23, 59, 59)

  const select = (
    config: ReviewSessionConfig,
    words: readonly (Word | null | undefined)[] = [
      createMockWord({
        word_id: 'due-word',
        user_id: userId,
        collection_id: collection.collection_id,
        next_review_date: TODAY,
      }),
    ]
  ) =>
    selectReviewWords({
      words,
      collections: [collection],
      userId,
      config,
      referenceDate,
    })

  it('should select every due word for the current user', () => {
    const result = select(
      { mode: REVIEW_MODE.MEANING_RECALL, scope: REVIEW_SCOPE.ALL_DUE },
      [
        createMockWord({
          word_id: 'overdue',
          user_id: userId,
          next_review_date: '2026-08-27',
        }),
        createMockWord({
          word_id: 'today',
          user_id: userId,
          next_review_date: TODAY,
        }),
        createMockWord({
          word_id: 'tomorrow',
          user_id: userId,
          next_review_date: TOMORROW,
        }),
        createMockWord({
          word_id: 'other-user',
          user_id: 'other-user',
          next_review_date: TODAY,
        }),
      ]
    )

    expect(result).toEqual({
      success: true,
      words: [
        expect.objectContaining({ word_id: 'overdue' }),
        expect.objectContaining({ word_id: 'today' }),
      ],
    })
  })

  it('should select only due words from the requested collection', () => {
    const result = select(
      {
        mode: REVIEW_MODE.MEANING_RECALL,
        scope: REVIEW_SCOPE.COLLECTION_DUE,
        collectionId: collection.collection_id,
      },
      [
        createMockWord({
          word_id: 'in-collection',
          user_id: userId,
          collection_id: collection.collection_id,
          next_review_date: TODAY,
        }),
        createMockWord({
          word_id: 'other-collection',
          user_id: userId,
          collection_id: 'collection-b',
          next_review_date: TODAY,
        }),
      ]
    )

    expect(result.success).toBe(true)
    expect(result.words.map(word => word.word_id)).toEqual(['in-collection'])
  })

  it('should select only difficult words that are currently due', () => {
    const result = select(
      { mode: REVIEW_MODE.RECOGNITION, scope: REVIEW_SCOPE.DIFFICULT_DUE },
      [
        createMockWord({
          word_id: 'difficult-due',
          user_id: userId,
          easiness_factor: DIFFICULT_EASINESS_FACTOR_THRESHOLD,
          next_review_date: TODAY,
        }),
        createMockWord({
          word_id: 'difficult-tomorrow',
          user_id: userId,
          easiness_factor: 1.8,
          next_review_date: TOMORROW,
        }),
        createMockWord({
          word_id: 'normal-due',
          user_id: userId,
          easiness_factor: 2.5,
          next_review_date: TODAY,
        }),
      ]
    )

    expect(result.success).toBe(true)
    expect(result.words.map(word => word.word_id)).toEqual(['difficult-due'])
  })

  it('should return an explicit failure for a deleted collection', () => {
    const result = selectReviewWords({
      words: [],
      collections: [],
      userId,
      config: {
        mode: REVIEW_MODE.MEANING_RECALL,
        scope: REVIEW_SCOPE.COLLECTION_DUE,
        collectionId: 'deleted-collection',
      },
      referenceDate,
    })

    expect(result).toEqual({
      success: false,
      reason: 'collection-not-found',
      words: [],
    })
  })

  it('should ignore null entries and invalid review dates', () => {
    const result = select(
      { mode: REVIEW_MODE.MEANING_RECALL, scope: REVIEW_SCOPE.ALL_DUE },
      [
        null,
        undefined,
        createMockWord({
          word_id: 'invalid-date',
          user_id: userId,
          next_review_date: 'invalid',
        }),
      ]
    )

    expect(result).toEqual({ success: true, words: [] })
  })
})

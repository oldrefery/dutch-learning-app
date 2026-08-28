import { DIFFICULT_EASINESS_FACTOR_THRESHOLD } from '@/constants/ReviewConstants'
import type { Collection, Word } from '@/types/database'
import type { ReviewSessionConfig } from '@/types/ReviewTypes'
import { isDueOnLocalDate } from './dateUtils'

interface SelectReviewWordsOptions {
  words: readonly (Word | null | undefined)[]
  collections: readonly Collection[]
  userId: string
  config: ReviewSessionConfig
  referenceDate?: Date
}

export type ReviewWordSelectionResult =
  | { success: true; words: Word[] }
  | { success: false; reason: 'collection-not-found'; words: [] }

export function selectReviewWords({
  words,
  collections,
  userId,
  config,
  referenceDate = new Date(),
}: SelectReviewWordsOptions): ReviewWordSelectionResult {
  if (
    config.scope === 'collection-due' &&
    !collections.some(
      collection => collection.collection_id === config.collectionId
    )
  ) {
    return { success: false, reason: 'collection-not-found', words: [] }
  }

  const dueWords = words.filter((word): word is Word =>
    Boolean(
      word &&
      word.user_id === userId &&
      isDueOnLocalDate(word.next_review_date, referenceDate)
    )
  )

  switch (config.scope) {
    case 'collection-due':
      return {
        success: true,
        words: dueWords.filter(
          word => word.collection_id === config.collectionId
        ),
      }
    case 'difficult-due':
      return {
        success: true,
        words: dueWords.filter(
          word => word.easiness_factor <= DIFFICULT_EASINESS_FACTOR_THRESHOLD
        ),
      }
    case 'all-due':
      return { success: true, words: dueWords }
  }
}

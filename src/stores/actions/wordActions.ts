import { APPLICATION_STORE_CONSTANTS } from '@/constants/ApplicationStoreConstants'
import { Sentry } from '@/lib/sentry'
import { wordRepository } from '@/db/wordRepository'
import { calculateNextReview } from '@/utils/srs'
import type {
  StoreSetFunction,
  StoreGetFunction,
  AnalyzedWord,
  ReviewAssessment,
  ApplicationState,
} from '@/types/ApplicationStoreTypes'
import type { GeminiWordAnalysis } from '@/types/database'

const USER_NOT_AUTHENTICATED_ERROR = 'User not authenticated'
const UNKNOWN_ERROR = 'Unknown error'

export const createWordActions = (
  set: StoreSetFunction,
  get: StoreGetFunction
): Pick<
  ApplicationState,
  | 'fetchWords'
  | 'addNewWord'
  | 'saveAnalyzedWord'
  | 'updateWordAfterReview'
  | 'deleteWord'
  | 'updateWordImage'
  | 'moveWordToCollection'
  | 'resetWordProgress'
  | 'addWordsToCollection'
> => ({
  fetchWords: async () => {
    try {
      set({ wordsLoading: true })
      const userId = get().currentUserId
      if (!userId) {
        set({
          error: {
            message:
              APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES.WORDS_FETCH_FAILED,
            details: USER_NOT_AUTHENTICATED_ERROR,
          },
          wordsLoading: false,
        })
        return
      }

      // Offline-first: fetch from local SQLite
      console.log('[Words] Fetching from local SQLite')
      const words = await wordRepository.getWordsByUserId(userId)

      if (!words || words.length === 0) {
        set({
          error: {
            message:
              APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES.WORDS_FETCH_FAILED,
            details: 'Failed to fetch words from service',
          },
          wordsLoading: false,
        })
        return
      }

      set({ words, wordsLoading: false })
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'fetchWords' },
        extra: { message: 'Error fetching words' },
      })
      set({
        error: {
          message:
            APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES.WORDS_FETCH_FAILED,
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
        wordsLoading: false,
      })
    }
  },

  addNewWord: async (word: string, collectionId?: string) => {
    // NOTE: This method is kept for backward compatibility, but word analysis
    // should be done in the UI layer and passed via saveAnalyzedWord
    throw new Error(
      'addNewWord is deprecated. Use saveAnalyzedWord with pre-analyzed word from UI'
    )
  },

  saveAnalyzedWord: async (
    analyzedWord: AnalyzedWord | GeminiWordAnalysis,
    collectionId?: string
  ) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        set({
          error: {
            message: 'Failed to save analyzed word',
            details: USER_NOT_AUTHENTICATED_ERROR,
          },
        })
        return
      }

      if (collectionId) {
        analyzedWord.collection_id = collectionId
      }

      // Offline-first: save to local SQLite
      const wordToAdd = {
        ...analyzedWord,
        user_id: userId,
        interval_days: 1,
        repetition_count: 0,
        easiness_factor: 2.5,
        next_review_date: new Date(
          Date.now() + 24 * 60 * 60 * 1000
        ).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any

      await wordRepository.addWord(wordToAdd)

      // Return the saved word
      const currentWords = get().words
      set({ words: [...currentWords, wordToAdd] })
      return wordToAdd
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'saveAnalyzedWord' },
        extra: { analyzedWord, collectionId, userId: get().currentUserId },
      })

      set({
        error: {
          message: 'Failed to save analyzed word',
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
      // Don't throw - let caller handle via store state
    }
  },

  updateWordAfterReview: async (
    wordId: string,
    assessment: ReviewAssessment
  ) => {
    try {
      // Validate inputs
      if (!wordId) {
        Sentry.captureException(new Error('Invalid wordId provided'), {
          tags: { operation: 'updateWordAfterReview' },
          extra: { wordId },
        })
      }
      if (!assessment || !assessment.assessment) {
        Sentry.captureException(new Error('Invalid assessment provided'), {
          tags: { operation: 'updateWordAfterReview' },
          extra: { assessment },
        })
      }

      const userId = get().currentUserId

      if (!userId) {
        throw new Error(USER_NOT_AUTHENTICATED_ERROR)
      }

      // Get the current word to calculate new SRS values
      const currentWords = get().words
      const currentWord = currentWords.find(w => w.word_id === wordId)

      if (!currentWord) {
        throw new Error(`Word with ID ${wordId} not found in local cache`)
      }

      // Calculate new SRS values
      const srsUpdate = calculateNextReview({
        interval_days: currentWord.interval_days,
        repetition_count: currentWord.repetition_count,
        easiness_factor: currentWord.easiness_factor,
        assessment: assessment.assessment,
      })

      const lastReviewedAt = new Date().toISOString()

      // Offline-first: always update local SQLite first
      await wordRepository.updateWordProgress(wordId, userId, {
        interval_days: srsUpdate.interval_days,
        repetition_count: srsUpdate.repetition_count,
        easiness_factor: srsUpdate.easiness_factor,
        next_review_date: srsUpdate.next_review_date,
        last_reviewed_at: lastReviewedAt,
      })

      // Update the local store with calculated values
      const updatedWordData = {
        ...currentWord,
        ...srsUpdate,
        last_reviewed_at: lastReviewedAt,
      }

      const wordIndex = currentWords.findIndex(w => w.word_id === wordId)
      if (wordIndex !== -1) {
        const updatedWords = [...currentWords]
        updatedWords[wordIndex] = updatedWordData
        set({ words: updatedWords })
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'updateWordAfterReview' },
        extra: { wordId, assessment },
      })
      set({
        error: {
          message: 'Failed to update word progress',
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
    }
  },

  deleteWord: async (wordId: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        throw new Error(USER_NOT_AUTHENTICATED_ERROR)
      }

      // Offline-first: delete it from local SQLite
      await wordRepository.deleteWord(wordId, userId)
      const currentWords = get().words
      const updatedWords = currentWords.filter(w => w.word_id !== wordId)
      set({ words: updatedWords })
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'deleteWord' },
        extra: { wordId },
      })
      set({
        error: {
          message: 'Failed to delete word',
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
      // Don't throw - let caller handle via store state
    }
  },

  updateWordImage: async (wordId: string, imageUrl: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        throw new Error(USER_NOT_AUTHENTICATED_ERROR)
      }

      // Offline-first: update image in local SQLite
      await wordRepository.updateWordImage(wordId, userId, imageUrl)

      // Update local store
      const currentWords = get().words
      const wordIndex = currentWords.findIndex(w => w.word_id === wordId)

      if (wordIndex !== -1) {
        const updatedWords = [...currentWords]
        updatedWords[wordIndex] = {
          ...updatedWords[wordIndex],
          image_url: imageUrl,
          updated_at: new Date().toISOString(),
        }
        set({ words: updatedWords })
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'updateWordImage' },
        extra: { wordId, imageUrl },
      })
      set({
        error: {
          message: 'Failed to update word image',
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
      // Don't throw - let caller handle via store state
    }
  },

  moveWordToCollection: async (wordId: string, newCollectionId: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        throw new Error(USER_NOT_AUTHENTICATED_ERROR)
      }

      // Offline-first: move word in local SQLite
      await wordRepository.moveWordToCollection(wordId, userId, newCollectionId)

      // Update local store
      const currentWords = get().words
      const wordIndex = currentWords.findIndex(w => w.word_id === wordId)

      if (wordIndex !== -1) {
        const updatedWords = [...currentWords]
        updatedWords[wordIndex] = {
          ...updatedWords[wordIndex],
          collection_id: newCollectionId,
          updated_at: new Date().toISOString(),
        }
        set({ words: updatedWords })
        return updatedWords[wordIndex]
      }
      return null
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'moveWordToCollection' },
        extra: { wordId, newCollectionId },
      })
      set({
        error: {
          message: 'Failed to move word to collection',
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
      return null
    }
  },

  resetWordProgress: async (wordId: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        throw new Error(USER_NOT_AUTHENTICATED_ERROR)
      }

      // Offline-first: reset progress in local SQLite
      await wordRepository.resetWordProgress(wordId, userId)

      // Update the local store with reset values
      const currentWords = get().words
      const wordIndex = currentWords.findIndex(w => w.word_id === wordId)

      if (wordIndex !== -1) {
        const updatedWords = [...currentWords]
        const resetDate = new Date(
          Date.now() + 24 * 60 * 60 * 1000
        ).toISOString()
        updatedWords[wordIndex] = {
          ...updatedWords[wordIndex],
          interval_days: 1,
          repetition_count: 0,
          easiness_factor: 2.5,
          next_review_date: resetDate,
          last_reviewed_at: null,
          updated_at: new Date().toISOString(),
        }
        set({ words: updatedWords })
        return updatedWords[wordIndex]
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'resetWordProgress' },
        extra: { wordId },
      })
      set({
        error: {
          message: 'Failed to reset word progress',
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
    }
  },

  addWordsToCollection: async (
    collectionId: string,
    words: Partial<import('@/types/database').Word>[]
  ) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        set({
          error: {
            message: 'Failed to import words',
            details: USER_NOT_AUTHENTICATED_ERROR,
          },
        })
        return false
      }

      // Offline-first: save all words to local SQLite
      const now = new Date().toISOString()
      await Promise.all(
        words.map(word =>
          wordRepository.addWord({
            ...word,
            user_id: userId,
            collection_id: collectionId,
            interval_days: word.interval_days ?? 1,
            repetition_count: word.repetition_count ?? 0,
            easiness_factor: word.easiness_factor ?? 2.5,
            next_review_date:
              word.next_review_date ??
              new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            created_at: word.created_at ?? now,
            updated_at: word.updated_at ?? now,
          } as any)
        )
      )

      // Update the store with new words (in offline-first, we just track the count)
      const currentWords = get().words
      const wordsToAdd = words.map((word, idx) => ({
        ...word,
        user_id: userId,
        collection_id: collectionId,
        interval_days: word.interval_days ?? 1,
        repetition_count: word.repetition_count ?? 0,
        easiness_factor: word.easiness_factor ?? 2.5,
        next_review_date:
          word.next_review_date ??
          new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_at: word.created_at ?? now,
        updated_at: word.updated_at ?? now,
      })) as any

      set({ words: [...currentWords, ...wordsToAdd] })

      return true
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'addWordsToCollection' },
        extra: {
          collectionId,
          wordCount: words.length,
          userId: get().currentUserId,
        },
      })
      set({
        error: {
          message: 'Failed to import words',
          details: error instanceof Error ? error.message : UNKNOWN_ERROR,
        },
      })
      // Don't throw - let caller handle via store state
      return false
    }
  },
})

import { APPLICATION_STORE_CONSTANTS } from '@/constants/ApplicationStoreConstants'
import { Sentry } from '@/lib/sentry'
import { wordService } from '@/lib/supabase'
import { logError, logInfo } from '@/utils/logger'
import { wordRepository } from '@/db/wordRepository'
import { reviewEventRepository } from '@/db/reviewEventRepository'
import { calculateNextReview } from '@/utils/srs'
import * as Crypto from 'expo-crypto'
import { createStoreError, ErrorCategory } from '@/types/ErrorTypes'
import type {
  StoreSetFunction,
  StoreGetFunction,
  AnalyzedWord,
  ReviewAssessment,
  ApplicationState,
} from '@/types/ApplicationStoreTypes'
import type { GeminiWordAnalysis, Word } from '@/types/database'
import {
  DEFAULT_REVIEW_SESSION_CONFIG,
  MAX_REVIEW_RESPONSE_TIME_MS,
  REVIEW_MODE,
  REVIEW_SESSION_MODE,
} from '@/constants/ReviewConstants'

const USER_NOT_AUTHENTICATED_ERROR =
  APPLICATION_STORE_CONSTANTS.AUTH_ERRORS.USER_NOT_AUTHENTICATED
const USER_NOT_AUTHENTICATED_LOG = 'User not authenticated'
const UNKNOWN_ERROR = 'Unknown error'

// Error messages for word operations
const WORD_SAVE_FAILED = 'Failed to save analyzed word'
const WORD_UPDATE_FAILED = 'Failed to update word progress'
const WORD_DELETE_FAILED = 'Failed to delete word'
const WORD_IMAGE_UPDATE_FAILED = 'Failed to update word image'
const WORD_MOVE_FAILED = 'Failed to move word to collection'
const WORD_RESET_FAILED = 'Failed to reset word progress'
const WORDS_IMPORT_FAILED = 'Failed to import words'
const WORD_REANALYZE_FAILED = 'Failed to re-analyze word'
const INVALID_ANALYSIS_RESPONSE = 'Invalid response from word analysis'

const normalizeResponseTime = (responseTime?: number): number | null => {
  if (responseTime === undefined || !Number.isFinite(responseTime)) return null
  return Math.min(
    MAX_REVIEW_RESPONSE_TIME_MS,
    Math.max(0, Math.round(responseTime))
  )
}

interface ImportWordsActionError extends Error {
  userMessage?: string
}

const getImportErrorMessage = (error: unknown): string => {
  if (error && typeof error === 'object') {
    const importError = error as ImportWordsActionError
    if (
      typeof importError.userMessage === 'string' &&
      importError.userMessage.trim() !== ''
    ) {
      return importError.userMessage
    }

    if (importError.message !== '') {
      return importError.message
    }
  }

  return error instanceof Error ? error.message : UNKNOWN_ERROR
}

const mergeWordsById = (
  currentWords: Word[],
  incomingWords: Word[]
): Word[] => {
  const mergedWords = [...currentWords]
  const indexByWordId = new Map<string, number>()

  mergedWords.forEach((word, index) => {
    indexByWordId.set(word.word_id, index)
  })

  incomingWords.forEach(word => {
    const existingIndex = indexByWordId.get(word.word_id)

    if (existingIndex === undefined) {
      indexByWordId.set(word.word_id, mergedWords.length)
      mergedWords.push(word)
      return
    }

    mergedWords[existingIndex] = {
      ...mergedWords[existingIndex],
      ...word,
    }
  })

  return mergedWords
}

const createWordFromAnalysis = (
  analysis: AnalyzedWord | GeminiWordAnalysis,
  userId: string,
  collectionId: string | null
): Word => {
  const now = new Date().toISOString()

  return {
    word_id: Crypto.randomUUID(),
    user_id: userId,
    collection_id: collectionId,
    dutch_lemma: analysis.dutch_lemma,
    dutch_original:
      'dutch_original' in analysis ? (analysis.dutch_original ?? null) : null,
    part_of_speech: analysis.part_of_speech ?? null,
    is_irregular: analysis.is_irregular ?? false,
    is_reflexive: analysis.is_reflexive ?? false,
    is_expression: analysis.is_expression ?? false,
    expression_type: analysis.expression_type ?? null,
    is_separable: analysis.is_separable ?? false,
    prefix_part: analysis.prefix_part ?? null,
    root_verb: analysis.root_verb ?? null,
    article: analysis.article ?? null,
    plural: analysis.plural ?? null,
    register: analysis.register ?? null,
    translations: analysis.translations,
    examples: analysis.examples ?? null,
    synonyms: analysis.synonyms ?? [],
    antonyms: analysis.antonyms ?? [],
    conjugation: analysis.conjugation ?? null,
    preposition: analysis.preposition ?? null,
    image_url: analysis.image_url ?? null,
    tts_url: analysis.tts_url ?? null,
    interval_days: 1,
    repetition_count: 0,
    easiness_factor: 2.5,
    next_review_date: now.split('T')[0],
    last_reviewed_at: null,
    analysis_notes: analysis.analysis_notes ?? null,
    created_at: now,
    updated_at: now,
  }
}

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
  | 'reanalyzeWord'
> => ({
  fetchWords: async () => {
    try {
      set({ wordsLoading: true })
      const userId = get().currentUserId
      if (!userId) {
        set({
          error: createStoreError(
            APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES.WORDS_FETCH_FAILED,
            {
              category: ErrorCategory.CLIENT,
              context: { reason: USER_NOT_AUTHENTICATED_ERROR },
            }
          ),
          wordsLoading: false,
        })
        return
      }

      // Offline-first: fetch from local SQLite
      const words = await wordRepository.getWordsByUserId(userId)

      // Empty word list is a valid state for new users
      set({ words: words || [], wordsLoading: false })
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'fetchWords' },
        extra: { message: 'Error fetching words' },
      })
      set({
        error: createStoreError(
          APPLICATION_STORE_CONSTANTS.ERROR_MESSAGES.WORDS_FETCH_FAILED,
          { originalError: error instanceof Error ? error : undefined }
        ),
        wordsLoading: false,
      })
    }
  },

  addNewWord: async () => {
    // NOTE: This method is deprecated - word analysis should be done in the UI layer
    // and passed via saveAnalyzedWord instead
    logError(
      'addNewWord called',
      new Error(
        'addNewWord is deprecated. Use saveAnalyzedWord with pre-analyzed word from UI'
      ),
      {},
      'words',
      false
    )
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
          error: createStoreError(WORD_SAVE_FAILED, {
            category: ErrorCategory.CLIENT,
            context: { reason: USER_NOT_AUTHENTICATED_ERROR },
          }),
        })
        return Promise.reject(new Error(USER_NOT_AUTHENTICATED_ERROR))
      }

      const targetCollectionId =
        collectionId ?? analyzedWord.collection_id ?? null

      // Check for duplicate before saving (defense in depth)
      const existingWord = await wordRepository.getWordBySemanticKey(
        userId,
        analyzedWord.dutch_lemma,
        analyzedWord.part_of_speech,
        analyzedWord.article
      )

      if (existingWord) {
        const errorMsg = `Word "${analyzedWord.dutch_lemma}" already exists in your collection`
        logInfo(
          'Duplicate word prevented at store level',
          {
            dutch_lemma: analyzedWord.dutch_lemma,
            part_of_speech: analyzedWord.part_of_speech,
            article: analyzedWord.article,
            existing_word_id: existingWord.word_id,
          },
          'words'
        )
        set({
          error: createStoreError(WORD_SAVE_FAILED, {
            category: ErrorCategory.VALIDATION,
            context: { reason: errorMsg },
          }),
        })
        // Keep duplicate behavior as a rejected promise without throwing inside try/catch.
        return Promise.reject(new Error(errorMsg))
      }

      // Offline-first: save it to local SQLite
      // Generate word_id on a client for offline-first architecture
      const wordToAdd = createWordFromAnalysis(
        analyzedWord,
        userId,
        targetCollectionId
      )

      await wordRepository.addWord(wordToAdd)

      // Return the saved word
      const currentWords = get().words
      set({ words: [...currentWords, wordToAdd] })
      return wordToAdd
    } catch (error) {
      const saveError =
        error instanceof Error ? error : new Error(UNKNOWN_ERROR)

      Sentry.captureException(saveError, {
        tags: { operation: 'saveAnalyzedWord' },
        extra: { analyzedWord, collectionId, userId: get().currentUserId },
      })

      set({
        error: createStoreError(WORD_SAVE_FAILED, {
          originalError: saveError,
        }),
      })
      throw saveError
    }
  },

  updateWordAfterReview: async (
    wordId: string,
    assessment: ReviewAssessment
  ) => {
    try {
      // Validate inputs
      if (!wordId) {
        logError(
          'Invalid wordId provided to updateWordAfterReview',
          new Error('wordId is required'),
          { wordId },
          'words',
          false
        )
        set({
          error: createStoreError(WORD_UPDATE_FAILED, {
            category: ErrorCategory.VALIDATION,
            context: { reason: 'Invalid word ID' },
          }),
        })
        return false
      }
      if (!assessment || !assessment.assessment) {
        logError(
          'Invalid assessment provided to updateWordAfterReview',
          new Error('assessment is required'),
          { assessment },
          'words',
          false
        )
        set({
          error: createStoreError(WORD_UPDATE_FAILED, {
            category: ErrorCategory.VALIDATION,
            context: { reason: 'Invalid assessment' },
          }),
        })
        return false
      }

      const userId = get().currentUserId

      if (!userId) {
        logError(
          USER_NOT_AUTHENTICATED_LOG,
          new Error(USER_NOT_AUTHENTICATED_ERROR),
          { wordId, assessment },
          'words',
          false
        )
        set({
          error: createStoreError(WORD_UPDATE_FAILED, {
            category: ErrorCategory.CLIENT,
            context: { reason: USER_NOT_AUTHENTICATED_ERROR },
          }),
        })
        return false
      }

      // Get the current word to calculate new SRS values
      const currentWords = get().words
      const currentWord = currentWords.find(w => w.word_id === wordId)

      if (!currentWord) {
        logInfo(
          `Word with ID ${wordId} not found in local cache`,
          { wordId, wordsCount: currentWords.length },
          'words'
        )
        set({
          error: createStoreError(WORD_UPDATE_FAILED, {
            category: ErrorCategory.VALIDATION,
            context: { reason: 'Word not found' },
          }),
        })
        return false
      }

      // Calculate new SRS values
      const srsUpdate = calculateNextReview({
        interval_days: currentWord.interval_days,
        repetition_count: currentWord.repetition_count,
        easiness_factor: currentWord.easiness_factor,
        assessment: assessment.assessment,
      })

      const reviewedAt =
        assessment.timestamp instanceof Date &&
        !Number.isNaN(assessment.timestamp.getTime())
          ? assessment.timestamp.toISOString()
          : new Date().toISOString()
      const reviewSession = get().reviewSession
      const sessionMode = reviewSession?.config.mode
      const resolvedSessionMode =
        sessionMode === REVIEW_SESSION_MODE.ADAPTIVE
          ? reviewSession?.adaptiveModeByWordId?.[wordId]?.mode
          : sessionMode
      const reviewMode =
        assessment.reviewMode ??
        resolvedSessionMode ??
        DEFAULT_REVIEW_SESSION_CONFIG.mode

      // Offline-first: update SRS and append its matching event atomically.
      await reviewEventRepository.recordAssessment({
        progress: srsUpdate,
        event: {
          event_id: Crypto.randomUUID(),
          user_id: userId,
          word_id: wordId,
          assessment: assessment.assessment,
          review_mode: reviewMode,
          answered_correctly:
            reviewMode === REVIEW_MODE.RECOGNITION
              ? (assessment.answeredCorrectly ?? null)
              : null,
          response_time_ms: normalizeResponseTime(assessment.responseTime),
          previous_interval_days: currentWord.interval_days,
          next_interval_days: srsUpdate.interval_days,
          previous_easiness_factor: currentWord.easiness_factor,
          next_easiness_factor: srsUpdate.easiness_factor,
          reviewed_at: reviewedAt,
        },
      })

      // Update the local store with calculated values
      const updatedWordData = {
        ...currentWord,
        ...srsUpdate,
        last_reviewed_at: reviewedAt,
        updated_at: reviewedAt,
      }

      const wordIndex = currentWords.findIndex(w => w.word_id === wordId)
      if (wordIndex !== -1) {
        const updatedWords = [...currentWords]
        updatedWords[wordIndex] = updatedWordData
        set({ words: updatedWords })
      }
      return true
    } catch (error) {
      logError(
        'Error updating word after review',
        error,
        { wordId, assessment },
        'words',
        false
      )
      set({
        error: createStoreError(WORD_UPDATE_FAILED, {
          originalError: error instanceof Error ? error : undefined,
        }),
      })
      return false
    }
  },

  deleteWord: async (wordId: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        logError(
          USER_NOT_AUTHENTICATED_LOG,
          new Error(USER_NOT_AUTHENTICATED_ERROR),
          { wordId },
          'words',
          false
        )
        set({
          error: createStoreError(WORD_DELETE_FAILED, {
            category: ErrorCategory.CLIENT,
            context: { reason: USER_NOT_AUTHENTICATED_ERROR },
          }),
        })
        return
      }

      // Offline-first: delete it from local SQLite
      await wordRepository.deleteWord(wordId, userId)
      const currentWords = get().words
      const updatedWords = currentWords.filter(w => w.word_id !== wordId)
      set({ words: updatedWords })
    } catch (error) {
      logError('Error deleting word', error, { wordId }, 'words', false)
      set({
        error: createStoreError(WORD_DELETE_FAILED, {
          originalError: error instanceof Error ? error : undefined,
        }),
      })
    }
  },

  updateWordImage: async (wordId: string, imageUrl: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        logError(
          USER_NOT_AUTHENTICATED_LOG,
          new Error(USER_NOT_AUTHENTICATED_ERROR),
          { wordId, imageUrl },
          'words',
          false
        )
        set({
          error: createStoreError(WORD_IMAGE_UPDATE_FAILED, {
            category: ErrorCategory.CLIENT,
            context: { reason: USER_NOT_AUTHENTICATED_ERROR },
          }),
        })
        return
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
      logError(
        'Error updating word image',
        error,
        { wordId, imageUrl },
        'words',
        false
      )
      set({
        error: createStoreError(WORD_IMAGE_UPDATE_FAILED, {
          originalError: error instanceof Error ? error : undefined,
        }),
      })
    }
  },

  moveWordToCollection: async (wordId: string, newCollectionId: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        logError(
          USER_NOT_AUTHENTICATED_LOG,
          new Error(USER_NOT_AUTHENTICATED_ERROR),
          { wordId, newCollectionId },
          'words',
          false
        )
        set({
          error: createStoreError(WORD_MOVE_FAILED, {
            category: ErrorCategory.CLIENT,
            context: { reason: USER_NOT_AUTHENTICATED_ERROR },
          }),
        })
        return null
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
      logError(
        'Error moving word to collection',
        error,
        { wordId, newCollectionId },
        'words',
        false
      )
      set({
        error: createStoreError(WORD_MOVE_FAILED, {
          originalError: error instanceof Error ? error : undefined,
        }),
      })
      return null
    }
  },

  resetWordProgress: async (wordId: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        logError(
          USER_NOT_AUTHENTICATED_LOG,
          new Error(USER_NOT_AUTHENTICATED_ERROR),
          { wordId },
          'words',
          false
        )
        set({
          error: createStoreError(WORD_RESET_FAILED, {
            category: ErrorCategory.CLIENT,
            context: { reason: USER_NOT_AUTHENTICATED_ERROR },
          }),
        })
        return
      }

      // Offline-first: reset progress in local SQLite
      await wordRepository.resetWordProgress(wordId, userId)

      // Update the local store with reset values
      const currentWords = get().words
      const wordIndex = currentWords.findIndex(w => w.word_id === wordId)

      if (wordIndex !== -1) {
        const updatedWords = [...currentWords]
        const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0] // Store-only date: "2025-12-22"
        updatedWords[wordIndex] = {
          ...updatedWords[wordIndex],
          interval_days: 1,
          repetition_count: 0,
          easiness_factor: 2.5,
          next_review_date: tomorrow,
          last_reviewed_at: null,
          updated_at: new Date().toISOString(),
        }
        set({ words: updatedWords })
        return updatedWords[wordIndex]
      }
    } catch (error) {
      logError(
        'Error resetting word progress',
        error,
        { wordId },
        'words',
        false
      )
      set({
        error: createStoreError(WORD_RESET_FAILED, {
          originalError: error instanceof Error ? error : undefined,
        }),
      })
    }
  },

  addWordsToCollection: async (
    collectionId: string,
    words: Partial<import('@/types/database').Word>[],
    isImportFromShared: boolean = false
  ) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        set({
          error: createStoreError(WORDS_IMPORT_FAILED, {
            category: ErrorCategory.CLIENT,
            context: { reason: USER_NOT_AUTHENTICATED_ERROR },
          }),
        })
        return false
      }

      // For imports from shared collections, use RPC to bypass RLS
      if (isImportFromShared) {
        try {
          // Use wordService to call RPC function with SECURITY DEFINER to bypass RLS
          const importedWords = await wordService.importWordsToCollection(
            collectionId,
            words
          )

          if (!importedWords || importedWords.length === 0) {
            logInfo('No words were imported', { collectionId })
            return true
          }

          const now = new Date().toISOString()
          const defaultReviewDate = now.split('T')[0]
          const normalizedImportedWords: Word[] = importedWords.map(word => ({
            ...word,
            word_id: word.word_id ?? Crypto.randomUUID(),
            user_id: userId,
            collection_id: collectionId,
            interval_days: word.interval_days ?? 1,
            repetition_count: word.repetition_count ?? 0,
            easiness_factor: word.easiness_factor ?? 2.5,
            next_review_date: word.next_review_date ?? defaultReviewDate,
            created_at: word.created_at ?? now,
            updated_at: word.updated_at ?? now,
            synonyms: word.synonyms ?? [],
            antonyms: word.antonyms ?? [],
          }))

          await wordRepository.saveWords(normalizedImportedWords)

          // Merge imported words by word_id to avoid duplicates in the in-memory store.
          const currentWords = get().words
          const mergedWords = mergeWordsById(
            currentWords as Word[],
            normalizedImportedWords
          )
          const importedNewCount = Math.max(
            mergedWords.length - currentWords.length,
            0
          )
          set({ words: mergedWords })

          logInfo(
            `Shared import completed: ${importedNewCount} new word${importedNewCount !== 1 ? 's' : ''}`,
            {
              collectionId,
              requestedWordCount: words.length,
              returnedWordCount: importedWords.length,
              importedNewCount,
            }
          )

          return true
        } catch (error) {
          logError(
            'Error importing words from shared collection',
            error,
            { collectionId, wordCount: words.length },
            'words',
            false
          )
          set({
            error: createStoreError(getImportErrorMessage(error), {
              category: ErrorCategory.CLIENT,
              originalError: error instanceof Error ? error : undefined,
            }),
          })
          return false
        }
      }

      // Offline-first: save all words to local SQLite for regular word creation
      // Generate word_id on a client for offline-first architecture
      const now = new Date().toISOString()
      const today = now.split('T')[0] // Extract date only: "2025-12-21"
      const wordsWithIds = words.map(word => ({
        ...word,
        word_id: word.word_id || Crypto.randomUUID(),
        user_id: userId,
        collection_id: collectionId,
        interval_days: word.interval_days ?? 1,
        repetition_count: word.repetition_count ?? 0,
        easiness_factor: word.easiness_factor ?? 2.5,
        next_review_date: word.next_review_date ?? today, // Store-only date
        created_at: word.created_at ?? now,
        updated_at: word.updated_at ?? now,
      }))

      await Promise.all(
        wordsWithIds.map(word => wordRepository.addWord(word as any))
      )

      // Update the store with new words (in offline-first, we just track the count)
      const currentWords = get().words
      const wordsToAdd = wordsWithIds as any

      set({ words: [...currentWords, ...wordsToAdd] })

      return true
    } catch (error) {
      logError(
        'Error adding words to collection',
        error,
        { collectionId, wordCount: words.length },
        'words',
        false
      )
      set({
        error: createStoreError(WORDS_IMPORT_FAILED, {
          originalError: error instanceof Error ? error : undefined,
        }),
      })
      return false
    }
  },

  reanalyzeWord: async (wordId: string) => {
    try {
      const userId = get().currentUserId
      if (!userId) {
        logError(
          USER_NOT_AUTHENTICATED_LOG,
          new Error(USER_NOT_AUTHENTICATED_ERROR),
          { wordId },
          'words',
          false
        )
        set({
          error: createStoreError(WORD_REANALYZE_FAILED, {
            category: ErrorCategory.CLIENT,
            context: { reason: USER_NOT_AUTHENTICATED_ERROR },
          }),
        })
        return null
      }

      // Find the word in the store
      const currentWords = get().words
      const currentWord = currentWords.find(w => w.word_id === wordId)

      if (!currentWord) {
        logInfo(
          `Word with ID ${wordId} not found for re-analysis`,
          { wordId, wordsCount: currentWords.length },
          'words'
        )
        set({
          error: createStoreError(WORD_REANALYZE_FAILED, {
            category: ErrorCategory.VALIDATION,
            context: { reason: 'Word not found' },
          }),
        })
        return null
      }

      // Call the AI analysis service with the word's dutch_lemma
      const response = await wordService.analyzeWord(currentWord.dutch_lemma, {
        forceRefresh: true,
      })

      if (!response || !response.data) {
        logError(
          INVALID_ANALYSIS_RESPONSE,
          new Error(INVALID_ANALYSIS_RESPONSE),
          { wordId },
          'words',
          false
        )
        set({
          error: createStoreError(WORD_REANALYZE_FAILED, {
            category: ErrorCategory.SERVER,
            context: { reason: INVALID_ANALYSIS_RESPONSE },
          }),
        })
        return null
      }

      const analysis = response.data

      // Prepare updated word data while preserving SRS progress and identifiers
      const now = new Date().toISOString()
      const updatedWordData: Word = {
        // Preserve identifiers and SRS data
        word_id: currentWord.word_id,
        user_id: currentWord.user_id,
        collection_id: currentWord.collection_id,
        interval_days: currentWord.interval_days,
        repetition_count: currentWord.repetition_count,
        easiness_factor: currentWord.easiness_factor,
        next_review_date: currentWord.next_review_date,
        last_reviewed_at: currentWord.last_reviewed_at,
        created_at: currentWord.created_at,
        // Update with new analysis data
        dutch_lemma: analysis.dutch_lemma,
        dutch_original: currentWord.dutch_original,
        part_of_speech: analysis.part_of_speech || currentWord.part_of_speech,
        is_irregular: analysis.is_irregular ?? currentWord.is_irregular,
        is_reflexive: analysis.is_reflexive ?? currentWord.is_reflexive,
        is_expression: analysis.is_expression ?? currentWord.is_expression,
        expression_type:
          analysis.expression_type ?? currentWord.expression_type,
        is_separable: analysis.is_separable ?? currentWord.is_separable,
        prefix_part: analysis.prefix_part ?? currentWord.prefix_part,
        root_verb: analysis.root_verb ?? currentWord.root_verb,
        article: analysis.article ?? currentWord.article,
        plural: analysis.plural ?? currentWord.plural,
        register: analysis.register ?? currentWord.register,
        translations: analysis.translations,
        examples: analysis.examples || currentWord.examples,
        synonyms: analysis.synonyms || currentWord.synonyms,
        antonyms: analysis.antonyms || currentWord.antonyms,
        conjugation: analysis.conjugation ?? currentWord.conjugation,
        preposition: analysis.preposition ?? currentWord.preposition,
        image_url: analysis.image_url ?? currentWord.image_url,
        tts_url: analysis.tts_url ?? currentWord.tts_url,
        analysis_notes: analysis.analysis_notes ?? currentWord.analysis_notes,
        updated_at: now,
      }

      // Update the existing word in the local database (marks as pending sync).
      // The repository preserves the current semantic key if the refreshed
      // analysis would collide with another active word.
      const persistedWord =
        await wordRepository.updateAnalyzedWord(updatedWordData)

      // Update the store
      const wordIndex = currentWords.findIndex(w => w.word_id === wordId)
      if (wordIndex !== -1) {
        const updatedWords = [...currentWords]
        updatedWords[wordIndex] = persistedWord
        set({ words: updatedWords })
      }

      logInfo(
        `Word re-analyzed successfully: ${currentWord.dutch_lemma}`,
        { wordId, dutch_lemma: currentWord.dutch_lemma },
        'words'
      )

      return persistedWord
    } catch (error) {
      logError('Error re-analyzing word', error, { wordId }, 'words', false)
      Sentry.captureException(error, {
        tags: { operation: 'reanalyzeWord' },
        extra: { wordId, userId: get().currentUserId },
      })
      set({
        error: createStoreError(WORD_REANALYZE_FAILED, {
          originalError: error instanceof Error ? error : undefined,
        }),
      })
      return null
    }
  },
})

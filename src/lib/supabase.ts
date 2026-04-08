import 'react-native-url-polyfill/auto'
import { supabase } from './supabaseClient'
import { calculateNextReview } from '@/utils/srs'
import type { Word } from '@/types/database'
import type { ReviewAssessment } from '@/types/ApplicationStoreTypes'
import { SRS_PARAMS } from '@/constants/SRSConstants'
import * as Sentry from '@sentry/react-native'
import { retrySupabaseFunction } from '@/utils/retryUtils'
import { categorizeSupabaseError, ServerError } from '@/types/ErrorTypes'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { assertNetworkConnection } from '@/utils/network'
import { logWarning } from '@/utils/logger'

// Load environment variables
const devUserEmail = process.env.EXPO_PUBLIC_DEV_USER_EMAIL!
const devUserPassword = process.env.EXPO_PUBLIC_DEV_USER_PASSWORD!

// Error messages
const NO_ACTIVE_SESSION_ERROR = 'No active session found'

if (!devUserEmail || !devUserPassword) {
  throw new Error(
    'Missing development user credentials. Please check your .env file.'
  )
}

// Re-export the client for backward compatibility
export { supabase }

// Create a separate client for Edge Functions (also uses an anon key)
export const supabaseFunctions = supabase

// Development helper to get dev user ID (hardcoded for simplicity)
export const getDevUserId = (): string => {
  // Hardcoded UUID for development
  // In production this will be taken from real authentication
  return (
    process.env.EXPO_PUBLIC_DEV_USER_ID ||
    '00000000-0000-0000-0000-000000000000'
  )
}

// API service functions

// Constants for word analysis
const WORD_ANALYSIS_CATEGORY = 'word.analysis'
const GEMINI_HANDLER_FUNCTION = 'gemini-handler'
const POSTGRES_UNIQUE_VIOLATION_CODE = '23505'
const SEMANTIC_UNIQUE_INDEX = 'idx_words_semantic_unique'
const IMPORT_ACCESS_DENIED_MESSAGE =
  'Unable to import words into the selected collection. Please verify access and try again.'
const IMPORT_ACCESS_ERROR_PATTERNS = [
  'collection not found or access denied',
  'permission denied',
  'row-level security',
]

interface SupabaseLikeError {
  code?: string
  message?: string
  details?: string
}

interface ImportWordsServiceError extends Error {
  code?: string
  sentryHandled?: boolean
  userMessage?: string
  isImportAccessError?: boolean
}

const normalizePartOfSpeech = (value?: string | null): string =>
  value && value.trim() !== '' ? value.trim() : 'unknown'

const SESSION_RETRY_PATTERNS = [
  'jwt expired',
  'invalid jwt',
  'authentication expired',
  'not authenticated',
  'no active session',
  'row-level security',
  'violates row-level security policy',
  'permission denied for table',
]

function isSessionRelatedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const message = String(
    (error as { message?: string }).message ?? ''
  ).toLowerCase()
  const code = (error as { code?: string }).code
  if (code === '42501') return true
  return SESSION_RETRY_PATTERNS.some(pattern => message.includes(pattern))
}

/**
 * Wrap a Supabase operation with session-refresh retry.
 * On auth/RLS error: refresh session, retry once, then return null.
 */
export async function withSessionRetry<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T | null> {
  try {
    return await operation()
  } catch (error) {
    if (!isSessionRelatedError(error)) {
      throw error
    }

    Sentry.addBreadcrumb({
      category: 'auth.retry',
      message: `Session-related error in ${operationName}, refreshing session`,
      level: 'warning',
      data: {
        errorMessage: error instanceof Error ? error.message : 'Unknown',
      },
    })

    const { error: refreshError } = await supabase.auth.refreshSession()
    if (refreshError) {
      Sentry.captureException(refreshError, {
        tags: { operation: operationName, phase: 'session_refresh' },
      })
      return null
    }

    try {
      return await operation()
    } catch (retryError) {
      Sentry.captureException(retryError, {
        tags: { operation: operationName, phase: 'after_session_refresh' },
        extra: { message: `${operationName} failed after session refresh` },
      })
      return null
    }
  }
}

const normalizeArticle = (value?: string | null): string =>
  value && value.trim() !== '' ? value.trim() : ''

const isSemanticDuplicateError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const supabaseError = error as SupabaseLikeError
  const details = `${supabaseError.message || ''} ${supabaseError.details || ''}`
  return (
    supabaseError.code === POSTGRES_UNIQUE_VIOLATION_CODE &&
    details.includes(SEMANTIC_UNIQUE_INDEX)
  )
}

const isImportAccessDeniedError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const supabaseError = error as SupabaseLikeError
  const details =
    `${supabaseError.message || ''} ${supabaseError.details || ''}`.toLowerCase()

  return (
    supabaseError.code === 'P0001' ||
    IMPORT_ACCESS_ERROR_PATTERNS.some(pattern => details.includes(pattern))
  )
}

function toSupabaseLikeError(error: unknown): SupabaseLikeError {
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>
    return {
      message: typeof e.message === 'string' ? e.message : String(error),
      code: typeof e.code === 'string' ? e.code : undefined,
      details: typeof e.details === 'string' ? e.details : undefined,
    }
  }
  return { message: error instanceof Error ? error.message : String(error) }
}

const createImportWordsServiceError = (
  message: string,
  options: {
    code?: string
    sentryHandled?: boolean
    userMessage?: string
    isImportAccessError?: boolean
  } = {}
): ImportWordsServiceError => {
  const error = new Error(message) as ImportWordsServiceError
  error.name = 'ImportWordsServiceError'
  error.code = options.code
  error.sentryHandled = options.sentryHandled
  error.userMessage = options.userMessage
  error.isImportAccessError = options.isImportAccessError
  return error
}

function classifyAndThrowImportError(
  error: unknown,
  collectionId: string,
  wordCount: number
): never {
  const sErr = toSupabaseLikeError(error)

  if (isSemanticDuplicateError(error)) {
    logWarning('Semantic duplicate skipped during word import', {
      operation: 'importWordsToCollection',
      collectionId,
      wordCount,
      code: sErr.code,
      details: sErr.details,
    })
    Sentry.captureMessage('Semantic duplicate skipped during import RPC', {
      level: 'warning',
      tags: {
        operation: 'importWordsToCollection',
        import_error_type: 'semantic_duplicate',
      },
      extra: {
        collectionId,
        wordCount,
        code: sErr.code,
        details: sErr.details,
      },
      fingerprint: ['importWordsToCollection', 'semantic_duplicate'],
    })
    throw createImportWordsServiceError(
      sErr.message || 'Semantic duplicate detected during import',
      { code: sErr.code, sentryHandled: true }
    )
  }

  if (isImportAccessDeniedError(error)) {
    Sentry.captureMessage('Import blocked by access policy', {
      level: 'warning',
      tags: {
        operation: 'importWordsToCollection',
        import_error_type: 'access_denied',
      },
      extra: {
        collectionId,
        wordCount,
        code: sErr.code,
        details: sErr.details,
        message: sErr.message,
      },
      fingerprint: ['importWordsToCollection', 'access_denied'],
    })
    throw createImportWordsServiceError(IMPORT_ACCESS_DENIED_MESSAGE, {
      code: sErr.code,
      sentryHandled: true,
      userMessage: IMPORT_ACCESS_DENIED_MESSAGE,
      isImportAccessError: true,
    })
  }

  Sentry.captureException(
    error instanceof Error ? error : new Error(sErr.message),
    {
      tags: { operation: 'importWordsToCollection' },
      extra: { collectionId, wordCount, code: sErr.code },
    }
  )
  throw createImportWordsServiceError(
    sErr.message || 'Failed to import words',
    {
      code: sErr.code,
      sentryHandled: true,
    }
  )
}

export const wordService = {
  // Analyze word using Gemini AI with retry logic
  async analyzeWord(word: string, options?: { forceRefresh?: boolean }) {
    // Add breadcrumb for tracking
    Sentry.addBreadcrumb({
      category: WORD_ANALYSIS_CATEGORY,
      message: `Starting word analysis for: ${word}`,
      level: 'info',
      data: {
        word,
        forceRefresh: options?.forceRefresh || false,
      },
    })

    try {
      // Check network connectivity before making a request
      // This prevents hanging requests when offline
      await assertNetworkConnection()

      // Wrap Edge Function call with retry logic
      const result = await retrySupabaseFunction(
        async () => {
          const { data, error } = await supabaseFunctions.functions.invoke(
            GEMINI_HANDLER_FUNCTION,
            {
              body: {
                word,
                userId: getDevUserId(),
                forceRefresh: options?.forceRefresh || false,
              },
            }
          )

          // If there's an error, extract details and throw
          if (error) {
            if (error instanceof FunctionsHttpError) {
              let errorBody: string =
                'Edge Function returned a non-2xx status code'
              try {
                const bodyData = await error.context.json()
                errorBody =
                  bodyData?.error ||
                  bodyData?.message ||
                  JSON.stringify(bodyData)
              } catch {
                // Could not parse response body
              }
              throw new ServerError(
                errorBody,
                error.context.status,
                'Word analysis failed. Please try again.',
                error.context.status === 503 ||
                  error.context.status === 504 ||
                  error.context.status === 546,
                error,
                {
                  functionName: GEMINI_HANDLER_FUNCTION,
                  operation: 'analyzeWord',
                }
              )
            }
            throw error
          }

          // Validate response data
          if (!data || !data.success) {
            throw new Error(
              data?.error || 'Invalid response from word analysis'
            )
          }

          return data
        },
        {
          functionName: GEMINI_HANDLER_FUNCTION,
          operation: 'analyzeWord',
        }
      )

      // Add success breadcrumb
      Sentry.addBreadcrumb({
        category: WORD_ANALYSIS_CATEGORY,
        message: `Word analysis completed successfully`,
        level: 'info',
        data: {
          word,
          source: result.meta?.source || 'unknown',
          cacheHit: result.meta?.cache_hit || false,
        },
      })

      return result
    } catch (error) {
      // Categorize the error
      const categorizedError = categorizeSupabaseError(error)

      // Add error breadcrumb
      Sentry.addBreadcrumb({
        category: WORD_ANALYSIS_CATEGORY,
        message: `Word analysis failed: ${categorizedError.category}`,
        level: 'error',
        data: {
          word,
          errorCategory: categorizedError.category,
          errorMessage: categorizedError.message,
          isRetryable: categorizedError.isRetryable,
        },
      })

      // Capture in Sentry with proper categorization
      Sentry.captureException(categorizedError, {
        tags: {
          operation: 'analyzeWord',
          errorCategory: categorizedError.category,
          severity: categorizedError.severity,
        },
        extra: {
          word,
          forceRefresh: options?.forceRefresh || false,
          isRetryable: categorizedError.isRetryable,
          userMessage: categorizedError.userMessage,
        },
        level:
          categorizedError.severity === 'CRITICAL'
            ? 'fatal'
            : categorizedError.severity === 'ERROR'
              ? 'error'
              : 'warning',
      })

      // Throw the categorized error instead of returning null
      throw categorizedError
    }
  },

  // Get all words for the user
  async getUserWords(userId: string) {
    return withSessionRetry(async () => {
      const { data, error } = await supabase
        .from('words')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    }, 'getUserWords')
  },

  // Check if the word already exists (by dutch_lemma + part_of_speech + article)
  async checkWordExists(
    userId: string,
    dutchLemma: string,
    partOfSpeech?: string,
    article?: string
  ) {
    const normalizedLemma = dutchLemma.trim().toLowerCase()
    const normalizedPartOfSpeech = normalizePartOfSpeech(partOfSpeech)
    const normalizedArticle = normalizeArticle(article)

    if (__DEV__) {
      console.log('[wordService.checkWordExists] Query', {
        userId,
        dutchLemma: normalizedLemma,
        partOfSpeech: normalizedPartOfSpeech,
        article: normalizedArticle,
      })
    }

    const data = await withSessionRetry(async () => {
      const { data, error } = await supabase
        .from('words')
        .select('word_id, dutch_lemma, collection_id, part_of_speech, article')
        .eq('user_id', userId)
        .eq('dutch_lemma', normalizedLemma)

      if (error) throw error
      return data
    }, 'checkWordExists')

    if (!data) return null

    const existingWord = (data || []).find(word => {
      const candidatePartOfSpeech = normalizePartOfSpeech(word.part_of_speech)
      const candidateArticle = normalizeArticle(word.article)

      return (
        candidatePartOfSpeech === normalizedPartOfSpeech &&
        candidateArticle === normalizedArticle
      )
    })

    if (__DEV__) {
      console.log('[wordService.checkWordExists] Result', {
        count: data.length,
        wordId: existingWord?.word_id ?? null,
        collectionId: existingWord?.collection_id ?? null,
      })
    }

    return existingWord || null
  },

  // Get words due for review
  async getWordsForReview(userId: string) {
    const today = new Date().toISOString().split('T')[0]

    return withSessionRetry(async () => {
      const { data, error } = await supabase
        .from('words')
        .select('*')
        .eq('user_id', userId)
        .lte('next_review_date', today)
        .order('next_review_date', { ascending: true })

      if (error) throw error
      return data
    }, 'getWordsForReview')
  },

  // Check if a word with the same semantic properties already exists
  async checkSemanticDuplicate(
    userId: string,
    dutchLemma: string,
    partOfSpeech: string = 'unknown',
    article: string = ''
  ): Promise<Word | null> {
    const normalizedLemma = dutchLemma.trim().toLowerCase()
    const normalizedPartOfSpeech = normalizePartOfSpeech(partOfSpeech)
    const normalizedArticle = normalizeArticle(article)

    const data = await withSessionRetry(async () => {
      const { data, error } = await supabase
        .from('words')
        .select('*')
        .eq('user_id', userId)
        .eq('dutch_lemma', normalizedLemma)

      if (error) throw error
      return data
    }, 'checkSemanticDuplicate')

    if (!data) return null

    const existingWord = (data || []).find(word => {
      const candidatePartOfSpeech = normalizePartOfSpeech(word.part_of_speech)
      const candidateArticle = normalizeArticle(word.article)

      return (
        candidatePartOfSpeech === normalizedPartOfSpeech &&
        candidateArticle === normalizedArticle
      )
    })

    return (existingWord as Word | undefined) || null
  },

  // Add new word
  async addWord(wordData: Partial<Word>, userId: string) {
    // Check for semantic duplicate before inserting
    const dutchLemma = wordData.dutch_lemma || wordData.dutch_original || ''
    const partOfSpeech = wordData.part_of_speech || 'unknown'
    const article = wordData.article || '' // Keep as empty string for consistency

    const existingWord = await this.checkSemanticDuplicate(
      userId,
      dutchLemma,
      partOfSpeech,
      article
    )

    if (existingWord) {
      Sentry.captureException(new Error('Duplicate word detected'), {
        tags: { operation: 'addWord' },
        extra: {
          dutchLemma,
          partOfSpeech,
          article,
          message: `Word "${dutchLemma}" with the same properties already exists in your vocabulary`,
        },
      })
      return null
    }

    // Create a clean word object with only valid database fields
    const cleanWordData = {
      dutch_original: wordData.dutch_original || '',
      dutch_lemma: wordData.dutch_lemma || wordData.dutch_original || '',
      part_of_speech: wordData.part_of_speech || 'unknown',
      translations: wordData.translations || { en: [], ru: [] },
      examples: wordData.examples || [],
      synonyms: wordData.synonyms || [],
      antonyms: wordData.antonyms || [],
      conjugation: wordData.conjugation || null,
      preposition: wordData.preposition || null,
      plural: wordData.plural || null,
      image_url: wordData.image_url || '',
      is_expression: wordData.is_expression || false,
      is_irregular: wordData.is_irregular || false,
      is_reflexive: wordData.is_reflexive || false,
      is_separable: wordData.is_separable || false,
      prefix_part: wordData.prefix_part || null,
      root_verb: wordData.root_verb || null,
      article: wordData.article || null,
      expression_type: wordData.expression_type || null,
      tts_url: wordData.tts_url || '',
      analysis_notes: wordData.analysis_notes || null,
      easiness_factor: SRS_PARAMS.INITIAL.EASINESS_FACTOR,
      interval_days: SRS_PARAMS.INITIAL.INTERVAL_DAYS,
      repetition_count: SRS_PARAMS.INITIAL.REPETITION_COUNT,
      next_review_date: new Date().toISOString().split('T')[0],
      user_id: userId,
      collection_id: wordData.collection_id || null,
    }

    return withSessionRetry(async () => {
      const { data, error } = await supabase
        .from('words')
        .insert(cleanWordData)
        .select()
        .single()

      if (error) throw error
      return data
    }, 'addWord')
  },

  // Update word after review (with session-refresh retry on auth/RLS errors)
  async updateWordProgress(wordId: string, assessment: ReviewAssessment) {
    return withSessionRetry(async () => {
      const { data: currentWord, error: fetchError } = await supabase
        .from('words')
        .select('interval_days, repetition_count, easiness_factor')
        .eq('word_id', wordId)
        .single()

      if (fetchError) {
        throw fetchError
      }

      const assessmentValue = assessment.assessment

      const srsUpdate = calculateNextReview({
        interval_days: currentWord.interval_days,
        repetition_count: currentWord.repetition_count,
        easiness_factor: currentWord.easiness_factor,
        assessment: assessmentValue,
      })

      const { data, error } = await supabase
        .from('words')
        .update({
          interval_days: srsUpdate.interval_days,
          repetition_count: srsUpdate.repetition_count,
          easiness_factor: srsUpdate.easiness_factor,
          next_review_date: srsUpdate.next_review_date,
          last_reviewed_at: new Date().toISOString(),
        })
        .eq('word_id', wordId)
        .select()
        .single()

      if (error) {
        throw error
      }

      return data
    }, 'updateWordProgress')
  },

  // Update word image
  async updateWordImage(wordId: string, imageUrl: string) {
    return withSessionRetry(async () => {
      const { data, error } = await supabase
        .from('words')
        .update({ image_url: imageUrl })
        .eq('word_id', wordId)
        .select()
        .single()

      if (error) throw error
      return data
    }, 'updateWordImage')
  },

  // Move word to a different collection
  async moveWordToCollection(wordId: string, newCollectionId: string) {
    return withSessionRetry(async () => {
      const { data, error } = await supabase
        .from('words')
        .update({ collection_id: newCollectionId })
        .eq('word_id', wordId)
        .select()
        .single()

      if (error) throw error
      return data
    }, 'moveWordToCollection')
  },

  // Reset word SRS statistics to initial values
  async resetWordProgress(wordId: string) {
    return withSessionRetry(async () => {
      const { data, error } = await supabase
        .from('words')
        .update({
          easiness_factor: SRS_PARAMS.INITIAL.EASINESS_FACTOR,
          interval_days: SRS_PARAMS.INITIAL.INTERVAL_DAYS,
          repetition_count: SRS_PARAMS.INITIAL.REPETITION_COUNT,
          next_review_date: new Date().toISOString().split('T')[0],
        })
        .eq('word_id', wordId)
        .select()
        .single()

      if (error) throw error
      return data
    }, 'resetWordProgress')
  },

  // Delete word
  async deleteWord(wordId: string) {
    await withSessionRetry(async () => {
      const { error } = await supabase
        .from('words')
        .delete()
        .eq('word_id', wordId)

      if (error) throw error
      return true
    }, 'deleteWord')
  },

  // Import words to a collection using SECURITY DEFINER function
  // This allows read-only users to import words from shared collections
  async importWordsToCollection(
    collectionId: string,
    words: Partial<Word>[]
  ): Promise<Word[]> {
    let result: Word[] | null
    try {
      result = await withSessionRetry(async () => {
        const { data, error } = await supabase.rpc(
          'import_words_to_collection',
          { p_collection_id: collectionId, p_words: words }
        )
        if (error) throw error
        return data || []
      }, 'importWordsToCollection')
    } catch (error) {
      classifyAndThrowImportError(error, collectionId, words.length)
    }

    if (result !== null) {
      return result
    }

    throw createImportWordsServiceError('Session expired during import', {
      sentryHandled: true,
    })
  },
}

export const userService = {
  // Delete a user account and all associated data
  async deleteAccount() {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session) {
      const authError = sessionError || new Error(NO_ACTIVE_SESSION_ERROR)
      Sentry.captureException(authError, {
        tags: { operation: 'deleteAccount' },
        extra: { message: NO_ACTIVE_SESSION_ERROR },
      })
      throw authError
    }

    // Call Edge Function with auth token
    const { data, error } = await supabase.functions.invoke('delete-account', {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    if (error) {
      const deleteError = new Error(
        `Failed to delete account: ${error.message}`
      )
      Sentry.captureException(deleteError, {
        tags: { operation: 'deleteAccount' },
        extra: { message: 'Edge Function error', error },
      })
      throw deleteError
    }

    if (!data?.success) {
      const deletionFailedError = new Error(
        data?.error || 'Account deletion failed'
      )
      Sentry.captureException(deletionFailedError, {
        tags: { operation: 'deleteAccount' },
        extra: { error: data?.error },
      })
      throw deletionFailedError
    }

    // If deletion succeeded, immediately sign out to invalidate any remaining tokens
    await supabase.auth.signOut()

    return { success: true }
  },
}

export const collectionService = {
  // Get user collections
  async getUserCollections(userId: string) {
    const data = await withSessionRetry(async () => {
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data
    }, 'getUserCollections')

    if (!data) return null

    // Filter out null/invalid entries from the response
    if (Array.isArray(data)) {
      return data.filter(collection => collection && collection.collection_id)
    }

    return data
  },

  // Create a new collection
  async createCollection(name: string, userId: string) {
    return withSessionRetry(async () => {
      const { data, error } = await supabase
        .from('collections')
        .insert({ name, user_id: userId })
        .select()
        .single()

      if (error) throw error
      return data
    }, 'createCollection')
  },

  // Update collection
  async updateCollection(
    collectionId: string,
    updates: { name: string },
    userId: string
  ) {
    return withSessionRetry(async () => {
      const { data, error } = await supabase
        .from('collections')
        .update(updates)
        .eq('collection_id', collectionId)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error
      return data
    }, 'updateCollection')
  },

  // Delete collection
  async deleteCollection(collectionId: string, userId: string) {
    await withSessionRetry(async () => {
      // First, delete all words in this collection
      const { error: wordsError } = await supabase
        .from('words')
        .delete()
        .eq('collection_id', collectionId)

      if (wordsError) throw wordsError

      // Then delete the collection itself
      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('collection_id', collectionId)
        .eq('user_id', userId)

      if (error) throw error
      return true
    }, 'deleteCollection')
  },
}

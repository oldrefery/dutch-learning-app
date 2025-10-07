import 'react-native-url-polyfill/auto'
import { supabase } from './supabaseClient'
import { calculateNextReview } from '@/utils/srs'
import type { Word } from '@/types/database'
import type { ReviewAssessment } from '@/types/ApplicationStoreTypes'
import { SRS_PARAMS } from '@/constants/SRSConstants'
import * as Sentry from '@sentry/react-native'
import { retrySupabaseFunction, retryWithBackoff } from '@/utils/retryUtils'
import { categorizeSupabaseError, isJWTExpiredError } from '@/types/ErrorTypes'
import { checkNetworkConnection } from '@/utils/networkUtils'
import { logSupabaseError } from '@/utils/logger'

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

// Handle JWT expired errors by signing out the user
export async function handleAuthError(error: unknown): Promise<void> {
  if (isJWTExpiredError(error)) {
    Sentry.captureException(error, {
      tags: { operation: 'handleAuthError', errorType: 'JWT_EXPIRED' },
      extra: {
        message: 'JWT token expired, signing out user',
      },
    })

    // Sign out user to clear invalid session
    try {
      await supabase.auth.signOut()
    } catch (signOutError) {
      Sentry.captureException(signOutError, {
        tags: { operation: 'handleAuthError', errorType: 'SIGN_OUT_FAILED' },
        extra: { message: 'Failed to sign out after JWT expiration' },
      })
    }
  }
}

// API service functions

// Constants for word analysis
const WORD_ANALYSIS_CATEGORY = 'word.analysis'

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
      // Check network connectivity before making request
      // This prevents hanging requests when offline
      await checkNetworkConnection()

      // Wrap Edge Function call with retry logic
      const result = await retrySupabaseFunction(
        async () => {
          const { data, error } = await supabaseFunctions.functions.invoke(
            'gemini-handler',
            {
              body: {
                word,
                userId: getDevUserId(),
                forceRefresh: options?.forceRefresh || false,
              },
            }
          )

          // If there's an error, throw it so retry logic can handle it
          if (error) {
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
          functionName: 'gemini-handler',
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
    const { data, error } = await supabase
      .from('words')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      logSupabaseError('Failed to fetch words', error, {
        operation: 'getUserWords',
        userId,
      })
      return null
    }

    return data
  },

  // Check if the word already exists (by dutch_lemma + part_of_speech + article)
  async checkWordExists(
    userId: string,
    dutchLemma: string,
    partOfSpeech?: string,
    article?: string
  ) {
    const normalizedLemma = dutchLemma.trim().toLowerCase()
    const normalizedPartOfSpeech = partOfSpeech || 'unknown'
    // Normalize article: empty string or undefined should be treated as null for proper DB comparison
    const normalizedArticle =
      article && article.trim() !== '' ? article.trim() : null

    let query = supabase
      .from('words')
      .select('word_id, dutch_lemma, collection_id, part_of_speech, article')
      .eq('user_id', userId)
      .eq('dutch_lemma', normalizedLemma)
      .eq('part_of_speech', normalizedPartOfSpeech)

    // Handle null vs non-null article properly
    if (normalizedArticle === null) {
      query = query.is('article', null)
    } else {
      query = query.eq('article', normalizedArticle)
    }

    const { data, error } = await query

    if (error) {
      logSupabaseError('Failed to check word existence', error, {
        operation: 'checkWordExists',
        userId,
        dutchLemma,
        partOfSpeech,
        article,
      })
      return null
    }

    return data.length > 0 ? data[0] : null
  },

  // Get words due for review
  async getWordsForReview(userId: string) {
    try {
      // Check network connectivity before making request
      await checkNetworkConnection()

      const today = new Date().toISOString().split('T')[0]

      // Wrap database query with retry logic for network resilience
      return await retryWithBackoff(
        async () => {
          const { data, error } = await supabase
            .from('words')
            .select('*')
            .eq('user_id', userId)
            .lte('next_review_date', today)
            .order('next_review_date', { ascending: true })

          if (error) {
            throw error
          }

          return data
        },
        {
          maxRetries: 3,
          initialDelayMs: 1000,
          maxDelayMs: 30000,
        }
      )
    } catch (error) {
      const categorizedError = categorizeSupabaseError(error)
      logSupabaseError('Failed to fetch review words', error, {
        operation: 'getWordsForReview',
        userId,
        errorCategory: categorizedError.category,
        isRetryable: categorizedError.isRetryable,
      })
      return null
    }
  },

  // Check if word with same semantic properties already exists
  async checkSemanticDuplicate(
    userId: string,
    dutchLemma: string,
    partOfSpeech: string = 'unknown',
    article: string = ''
  ): Promise<Word | null> {
    // Normalize article: empty string should be treated as null for the query
    const normalizedArticle = article || null
    const normalizedPartOfSpeech = partOfSpeech || 'unknown'

    let query = supabase
      .from('words')
      .select('*')
      .eq('user_id', userId)
      .eq('dutch_lemma', dutchLemma)
      .eq('part_of_speech', normalizedPartOfSpeech)

    // Handle null vs empty string for article
    if (normalizedArticle === null) {
      query = query.is('article', null)
    } else {
      query = query.eq('article', normalizedArticle)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      Sentry.captureException(error, {
        tags: { operation: 'checkSemanticDuplicate' },
        extra: {
          userId,
          dutchLemma,
          partOfSpeech,
          article,
          message: 'Failed to check for duplicate',
        },
      })
      return null
    }

    return data
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

    const { data, error } = await supabase
      .from('words')
      .insert(cleanWordData)
      .select()
      .single()

    if (error) {
      logSupabaseError('Failed to add word', error, {
        operation: 'addWord',
        userId,
        dutchLemma,
      })
      return null
    }

    return data
  },

  // Update word after review
  async updateWordProgress(wordId: string, assessment: ReviewAssessment) {
    // First, get current word data
    const { data: currentWord, error: fetchError } = await supabase
      .from('words')
      .select('interval_days, repetition_count, easiness_factor')
      .eq('word_id', wordId)
      .single()

    if (fetchError) {
      Sentry.captureException(fetchError, {
        tags: { operation: 'updateWordProgress' },
        extra: { wordId, message: 'Failed to fetch current word data' },
      })
      return null
    }

    // Extract the assessment string from the assessment object
    const assessmentValue = assessment.assessment

    // Calculate new SRS values using the existing function
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
      logSupabaseError('Failed to update word progress', error, {
        operation: 'updateWordProgress',
        wordId,
      })
      return null
    }

    return data
  },

  // Update word image
  async updateWordImage(wordId: string, imageUrl: string) {
    const { data, error } = await supabase
      .from('words')
      .update({ image_url: imageUrl })
      .eq('word_id', wordId)
      .select()
      .single()

    if (error) {
      logSupabaseError('Failed to update word image', error, {
        operation: 'updateWordImage',
        wordId,
        imageUrl,
      })
      return null
    }

    return data
  },

  // Move word to a different collection
  async moveWordToCollection(wordId: string, newCollectionId: string) {
    const { data, error } = await supabase
      .from('words')
      .update({ collection_id: newCollectionId })
      .eq('word_id', wordId)
      .select()
      .single()

    if (error) {
      logSupabaseError('Failed to move word to collection', error, {
        operation: 'moveWordToCollection',
        wordId,
        newCollectionId,
      })
      return null
    }

    return data
  },

  // Reset word SRS statistics to initial values
  async resetWordProgress(wordId: string) {
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

    if (error) {
      logSupabaseError('Failed to reset word progress', error, {
        operation: 'resetWordProgress',
        wordId,
      })
      return null
    }

    return data
  },

  // Delete word
  async deleteWord(wordId: string) {
    const { error } = await supabase
      .from('words')
      .delete()
      .eq('word_id', wordId)

    if (error) {
      logSupabaseError('Failed to delete word', error, {
        operation: 'deleteWord',
        wordId,
      })
      return
    }
  },

  // Import words to collection using SECURITY DEFINER function
  // This allows read-only users to import words from shared collections
  async importWordsToCollection(
    collectionId: string,
    words: Partial<Word>[]
  ): Promise<Word[]> {
    try {
      // Call the database RPC function which uses SECURITY DEFINER to bypass RLS
      // Supabase RPC automatically serializes to JSON, no need for JSON.stringify
      const { data, error } = await supabase.rpc('import_words_to_collection', {
        p_collection_id: collectionId,
        p_words: words,
      })

      if (error) {
        logSupabaseError('Failed to import words', error, {
          operation: 'importWordsToCollection',
          collectionId,
          wordCount: words.length,
        })
        throw error
      }

      return data || []
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'importWordsToCollection' },
        extra: { collectionId, wordCount: words.length },
      })
      throw error
    }
  },
}

export const userService = {
  // Delete a user account and all associated data
  async deleteAccount() {
    try {
      // Get the current session for authorization
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session) {
        Sentry.captureException(
          sessionError || new Error(NO_ACTIVE_SESSION_ERROR),
          {
            tags: { operation: 'deleteAccount' },
            extra: { message: NO_ACTIVE_SESSION_ERROR },
          }
        )
        throw new Error(NO_ACTIVE_SESSION_ERROR)
      }

      // Call Edge Function with auth token
      const { data, error } = await supabase.functions.invoke(
        'delete-account',
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      )

      // If deletion succeeded, immediately sign out to invalidate any remaining tokens
      if (!error && data?.success) {
        await supabase.auth.signOut()
      }

      if (error) {
        Sentry.captureException(
          new Error(`Failed to delete account: ${error.message}`),
          {
            tags: { operation: 'deleteAccount' },
            extra: { message: 'Edge Function error', error },
          }
        )
      }

      if (!data.success) {
        Sentry.captureException(new Error('Account deletion failed'), {
          tags: { operation: 'deleteAccount' },
          extra: { error: data.error },
        })
      }

      return { success: true }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'deleteAccount' },
        extra: { message: 'Account deletion error' },
      })
    }
  },
}

export const collectionService = {
  // Get user collections
  async getUserCollections(userId: string) {
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      logSupabaseError('Failed to fetch collections', error, {
        operation: 'getUserCollections',
        userId,
      })
      return null
    }

    return data
  },

  // Create a new collection
  async createCollection(name: string, userId: string) {
    const { data, error } = await supabase
      .from('collections')
      .insert({ name, user_id: userId })
      .select()
      .single()

    if (error) {
      logSupabaseError('Failed to create collection', error, {
        operation: 'createCollection',
        name,
        userId,
      })
      return null
    }

    return data
  },

  // Update collection
  async updateCollection(
    collectionId: string,
    updates: { name: string },
    userId: string
  ) {
    const { data, error } = await supabase
      .from('collections')
      .update(updates)
      .eq('collection_id', collectionId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      logSupabaseError('Failed to update collection', error, {
        operation: 'updateCollection',
        collectionId,
        updates,
        userId,
      })
      return null
    }

    return data
  },

  // Delete collection
  async deleteCollection(collectionId: string, userId: string) {
    // First, delete all words in this collection
    const { error: wordsError } = await supabase
      .from('words')
      .delete()
      .eq('collection_id', collectionId)

    if (wordsError) {
      Sentry.captureException(wordsError, {
        tags: { operation: 'deleteCollection' },
        extra: {
          collectionId,
          userId,
          message: 'Failed to delete words in collection',
        },
      })
      return
    }

    // Then delete the collection itself
    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('collection_id', collectionId)
      .eq('user_id', userId)

    if (error) {
      logSupabaseError('Failed to delete collection', error, {
        operation: 'deleteCollection',
        collectionId,
        userId,
      })
      return
    }
  },
}

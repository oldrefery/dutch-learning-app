import 'react-native-url-polyfill/auto'
import { supabase } from './supabaseClient'
import { calculateNextReview } from '@/utils/srs'
import type { Word } from '@/types/database'
import type { ReviewAssessment } from '@/types/ApplicationStoreTypes'
import { SRS_PARAMS } from '@/constants/SRSConstants'
import * as Sentry from '@sentry/react-native'

// Load environment variables
const devUserEmail = process.env.EXPO_PUBLIC_DEV_USER_EMAIL!
const devUserPassword = process.env.EXPO_PUBLIC_DEV_USER_PASSWORD!

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

export const wordService = {
  // Analyze word using Gemini AI
  async analyzeWord(word: string, options?: { forceRefresh?: boolean }) {
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

    if (error) {
      throw new Error(`Word analysis failed: ${error.message}`)
    }

    return data
  },

  // Get all words for the user
  async getUserWords(userId: string) {
    const { data, error } = await supabase
      .from('words')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to fetch words: ${error.message}`)
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
      throw new Error(`Failed to check word existence: ${error.message}`)
    }

    return data.length > 0 ? data[0] : null
  },

  // Get words due for review
  async getWordsForReview(userId: string) {
    const today = new Date().toISOString().split('T')[0]

    const { data, error } = await supabase
      .from('words')
      .select('*')
      .eq('user_id', userId)
      .lte('next_review_date', today)
      .order('next_review_date', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch review words: ${error.message}`)
    }

    return data
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

    const { data, error } = await query.single()

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" which is expected when no duplicate exists
      throw new Error(`Failed to check for duplicate: ${error.message}`)
    }

    return data || null
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
      throw new Error(
        `Word "${dutchLemma}" with the same properties already exists in your vocabulary`
      )
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
      throw new Error(`Failed to add word: ${error.message}`)
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
      throw new Error(
        `Failed to fetch current word data: ${fetchError.message}`
      )
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
      throw new Error(`Failed to update word progress: ${error.message}`)
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
      throw new Error(`Failed to update word image: ${error.message}`)
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
      throw new Error(`Failed to move word to collection: ${error.message}`)
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
      throw new Error(`Failed to delete word: ${error.message}`)
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
          '❌ No active session found:',
          sessionError?.message
        )
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
          '❌ Edge Function error:',
          error,
          `\nFailed to delete account: ${error.message}`
        )
      }

      if (!data.success) {
        Sentry.captureException('❌ Account deletion failed:', data.error)
      }

      return { success: true }
    } catch (error) {
      Sentry.captureException('💥 Account deletion error:', error)
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
      throw new Error(`Failed to fetch collections: ${error.message}`)
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
      throw new Error(`Failed to create collection: ${error.message}`)
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
      throw new Error(`Failed to update collection: ${error.message}`)
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
      throw new Error(
        `Failed to delete words in collection: ${wordsError.message}`
      )
    }

    // Then delete the collection itself
    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('collection_id', collectionId)
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to delete collection: ${error.message}`)
    }
  },
}

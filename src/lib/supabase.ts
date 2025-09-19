import 'react-native-url-polyfill/auto'
import { supabase } from './supabaseClient'
import { calculateNextReview } from '@/utils/srs'
import type { Word } from '@/types/database'
import type { ReviewAssessment } from '@/types/ApplicationStoreTypes'
import { SRS_PARAMS } from '@/constants/SRSConstants'

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

// Development helper: sign in as a dev user for RLS to work
export const initDevSession = async () => {
  const devUserId = getDevUserId()

  try {
    // For development, we'll use the existing user session if available
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || user.id !== devUserId) {
      // Sign in with a real development user
      // In production, this will be replaced with real authentication
      const { error } = await supabase.auth.signInWithPassword({
        email: devUserEmail,
        password: devUserPassword,
      })

      if (error) {
        console.error('Dev auth error:', error.message)
        throw new Error(`Development authentication failed: ${error.message}`)
      }
    }
  } catch {
    // Continue without auth - we'll handle this gracefully
  }
}

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
  async analyzeWord(word: string) {
    const { data, error } = await supabaseFunctions.functions.invoke(
      'gemini-handler',
      {
        body: {
          word,
          userId: getDevUserId(),
        },
      }
    )

    if (error) {
      throw new Error(`Word analysis failed: ${error.message}`)
    }

    return data.data
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

  // Check if the word already exists (by dutch_lemma)
  async checkWordExists(userId: string, dutchLemma: string) {
    const normalizedLemma = dutchLemma.trim().toLowerCase()

    const { data, error } = await supabase
      .from('words')
      .select('word_id, dutch_lemma, collection_id')
      .eq('user_id', userId)
      .eq('dutch_lemma', normalizedLemma)

    if (error) {
      throw new Error(`Failed to check word existence: ${error.message}`)
    }

    return data.length > 0 ? data[0] : null
  },

  // Get duplicate words (same dutch_lemma)
  async getDuplicateWords(userId: string) {
    const { data, error } = await supabase
      .from('words')
      .select('dutch_lemma, word_id, created_at')
      .eq('user_id', userId)
      .order('dutch_lemma')

    if (error) {
      throw new Error(
        `Failed to fetch words for duplicate check: ${error.message}`
      )
    }

    // Group by dutch_lemma and find duplicates
    const grouped = data.reduce(
      (acc, word) => {
        const lemma = word.dutch_lemma
        if (!acc[lemma]) {
          acc[lemma] = []
        }
        acc[lemma].push(word)
        return acc
      },
      {} as Record<
        string,
        { dutch_lemma: string; word_id: string; created_at: string }[]
      >
    )

    // Return only groups with more than one word
    return Object.values(grouped).filter(group => group.length > 1)
  },

  // Remove duplicate word (keep the oldest one)
  async removeDuplicateWord(userId: string, wordId: string) {
    const { error } = await supabase
      .from('words')
      .delete()
      .eq('word_id', wordId)
      .eq('user_id', userId)

    if (error) {
      throw new Error(`Failed to remove duplicate word: ${error.message}`)
    }
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

  // Add new word
  async addWord(wordData: Partial<Word>, userId: string) {
    // Ensure required fields are present
    const wordToInsert = {
      dutch_original: wordData.dutch_original || '',
      dutch_lemma: wordData.dutch_lemma || wordData.dutch_original || '',
      part_of_speech: wordData.part_of_speech || 'unknown',
      translations: wordData.translations || { en: [], ru: [] },
      examples: wordData.examples || [],
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
      easiness_factor: SRS_PARAMS.INITIAL.EASINESS_FACTOR,
      interval_days: SRS_PARAMS.INITIAL.INTERVAL_DAYS,
      repetition_count: SRS_PARAMS.INITIAL.REPETITION_COUNT,
      next_review_date: new Date().toISOString().split('T')[0],
      user_id: userId,
      ...wordData, // Override with any additional fields from the wordData
    }

    // Use the prepared word data directly
    const cleanWordData = wordToInsert

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
      console.log('🗑️ Starting account deletion process...')

      // Get the current session for authorization
      console.log('📱 Getting current session...')
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      console.log('📱 Session result:', {
        sessionExists: !!session,
        sessionError: sessionError?.message,
        userId: session?.user?.id,
        tokenExists: !!session?.access_token,
      })

      if (sessionError || !session) {
        console.error('❌ No active session found:', sessionError?.message)
        throw new Error('No active session found')
      }

      // Call Edge Function with auth token
      console.log('🚀 Calling delete-account Edge Function...')
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
        console.log(
          '🔐 Account deleted successfully, signing out to invalidate tokens...'
        )
        await supabase.auth.signOut()
      }

      console.log('🚀 Edge Function response:', {
        data,
        error: error?.message,
        errorDetails: error,
      })

      if (error) {
        console.error('❌ Edge Function error:', error)
        throw new Error(`Failed to delete account: ${error.message}`)
      }

      if (!data.success) {
        console.error('❌ Account deletion failed:', data.error)
        throw new Error(data.error || 'Account deletion failed')
      }

      console.log('✅ Account successfully deleted!')
      return { success: true }
    } catch (error) {
      console.error('💥 Account deletion error:', error)
      throw error
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

import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import { calculateNextReview } from '../utils/srs'

// Load environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.EXPO_PUBLIC_SUPABASE_SERVICE_KEY!
const devUserEmail = process.env.EXPO_PUBLIC_DEV_USER_EMAIL!
const devUserPassword = process.env.EXPO_PUBLIC_DEV_USER_PASSWORD!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env file.'
  )
}

if (!devUserEmail || !devUserPassword) {
  throw new Error(
    'Missing development user credentials. Please check your .env file.'
  )
}

// Create Supabase client with anon key (standard approach)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// Development helper: sign in as dev user for RLS to work
export const initDevSession = async () => {
  const devUserId = getDevUserId()

  try {
    // For development, we'll use the existing user session if available
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || user.id !== devUserId) {
      console.log('Setting up development session for user:', devUserId)

      // Sign in with real development user
      // In production, this will be replaced with real authentication
      const { data, error } = await supabase.auth.signInWithPassword({
        email: devUserEmail,
        password: devUserPassword,
      })

      if (error) {
        console.error('Dev auth error:', error.message)
        throw new Error(`Development authentication failed: ${error.message}`)
      } else {
        console.log('Dev session established:', data.user?.id)
      }
    } else {
      console.log('Using existing session for user:', user.id)
    }
  } catch (error) {
    console.log('Dev session setup error:', error)
    // Continue without auth - we'll handle this gracefully
  }
}

// Create separate client for Edge Functions (also uses anon key)
export const supabaseFunctions = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// Development helper to get dev user ID (hardcoded for simplicity)
export const getDevUserId = (): string => {
  // Захардкоженный UUID для разработки
  // В продакшене это будет браться из реальной авторизации
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
        body: { word },
      }
    )

    if (error) {
      throw new Error(`Word analysis failed: ${error.message}`)
    }

    return data
  },

  // Get all words for user
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
  async addWord(wordData: any, userId: string) {
    const { data, error } = await supabase
      .from('words')
      .insert({ ...wordData, user_id: userId })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to add word: ${error.message}`)
    }

    return data
  },

  // Update word after review
  async updateWordProgress(wordId: string, assessment: any) {
    // First get current word data
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

    // Calculate new SRS values using existing function
    const srsUpdate = calculateNextReview({
      interval_days: currentWord.interval_days,
      repetition_count: currentWord.repetition_count,
      easiness_factor: currentWord.easiness_factor,
      assessment: assessment.quality,
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

  // Create new collection
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
}

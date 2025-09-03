import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'

// Load environment variables
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Missing Supabase environment variables. Please check your .env file.'
    )
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // For development, we'll use the dev user ID
        // In production, this will be handled by actual authentication
        persistSession: true,
        autoRefreshToken: true,
    },
})

// Development helper to get dev user ID
export const getDevUserId = (): string => {
    const devUserId = process.env.DEV_USER_ID
    if (!devUserId) {
        throw new Error('DEV_USER_ID not found in environment variables')
    }
    return devUserId
}

// API service functions

export const wordService = {
    // Analyze word using Gemini AI
    async analyzeWord(word: string) {
        const { data, error } = await supabase.functions.invoke('gemini-handler', {
            body: { word },
        })

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
    async updateWordProgress(wordId: string, srsData: any) {
        const { data, error } = await supabase
            .from('words')
            .update({
                ...srsData,
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

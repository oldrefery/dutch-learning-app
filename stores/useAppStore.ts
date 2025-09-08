import { create } from 'zustand'
import type {
  Word,
  Collection,
  ReviewSession,
  AppError,
} from '../types/database'
import {
  wordService,
  collectionService,
  getDevUserId,
  initDevSession,
} from '../lib/supabase'

interface AppState {
  // User data
  currentUserId: string | null

  // Words
  words: Word[]
  wordsLoading: boolean

  // Collections
  collections: Collection[]
  collectionsLoading: boolean

  // Review session
  reviewSession: ReviewSession | null
  reviewLoading: boolean

  // Errors
  error: AppError | null

  // Actions
  initializeApp: () => Promise<void>

  // Word actions
  fetchWords: () => Promise<void>
  addNewWord: (word: string) => Promise<Word>
  updateWordAfterReview: (wordId: string, assessment: any) => Promise<void>

  // Collection actions
  fetchCollections: () => Promise<void>
  createNewCollection: (name: string) => Promise<Collection>

  // Review session actions
  startReviewSession: () => Promise<void>
  submitReviewAssessment: (assessment: any) => Promise<void>
  endReviewSession: () => void

  // Error handling
  setError: (error: AppError | null) => void
  clearError: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  currentUserId: null,
  words: [],
  wordsLoading: false,
  collections: [],
  collectionsLoading: false,
  reviewSession: null,
  reviewLoading: false,
  error: null,

  // Initialize app
  initializeApp: async () => {
    try {
      // Initialize development session for RLS to work
      await initDevSession()

      // For development, use the dev user ID
      const devUserId = getDevUserId()
      set({ currentUserId: devUserId })

      console.log('Initializing app for user:', devUserId)

      // Fetch initial data
      await Promise.all([get().fetchWords(), get().fetchCollections()])
    } catch (error) {
      console.error('App initialization error:', error)
      get().setError({
        message: 'Failed to initialize app',
        details: error,
      })
    }
  },

  // Word actions
  fetchWords: async () => {
    const { currentUserId } = get()
    if (!currentUserId) return

    set({ wordsLoading: true })
    try {
      const words = await wordService.getUserWords(currentUserId)
      set({ words, wordsLoading: false })
    } catch (error) {
      get().setError({
        message: 'Failed to fetch words',
        details: error,
      })
      set({ wordsLoading: false })
    }
  },

  addNewWord: async (word: string) => {
    const { currentUserId, words } = get()
    if (!currentUserId) throw new Error('No user ID')

    // FIRST CHECK: Exact word match (before AI call to save API requests)
    const exactMatch = words.find(
      w =>
        w.dutch_lemma.toLowerCase() === word.toLowerCase() ||
        w.dutch_original?.toLowerCase() === word.toLowerCase()
    )

    if (exactMatch) {
      throw new Error(`Word "${word}" already exists in your collection`)
    }

    try {
      // Analyze the word with AI to get the lemma
      const analysis = await wordService.analyzeWord(word)

      // SECOND CHECK: Lemma match (after AI call to prevent duplicate base forms)
      const lemmaMatch = words.find(
        w => w.dutch_lemma.toLowerCase() === analysis.lemma.toLowerCase()
      )

      if (lemmaMatch) {
        throw new Error(
          `Word with lemma "${analysis.lemma}" already exists in your collection (as "${lemmaMatch.dutch_original}")`
        )
      }

      // Prepare word data for database
      const wordData = {
        dutch_lemma: analysis.lemma,
        dutch_original: word,
        part_of_speech: analysis.part_of_speech,
        is_irregular: analysis.is_irregular || false,
        article: analysis.article || null, // Include article for nouns
        translations: analysis.translations,
        examples: analysis.examples,
        tts_url: analysis.tts_url,
        image_url: analysis.image_url || null, // Include associated image
        // Initial SRS values
        interval_days: 1,
        repetition_count: 0,
        easiness_factor: 2.5,
        next_review_date: new Date().toISOString().split('T')[0],
      }

      // Add to database
      const newWord = await wordService.addWord(wordData, currentUserId)

      // Update local state
      set(state => ({
        words: [newWord, ...state.words],
      }))

      return newWord
    } catch (error) {
      get().setError({
        message: 'Failed to add word',
        details: error,
      })
      throw error
    }
  },

  updateWordAfterReview: async (wordId: string, srsData: any) => {
    try {
      const updatedWord = await wordService.updateWordProgress(wordId, srsData)

      // Update local state
      set(state => ({
        words: state.words.map(word =>
          word.word_id === wordId ? updatedWord : word
        ),
      }))
    } catch (error) {
      get().setError({
        message: 'Failed to update word progress',
        details: error,
      })
      throw error
    }
  },

  updateWordImage: async (wordId: string, imageUrl: string) => {
    try {
      const updatedWord = await wordService.updateWordImage(wordId, imageUrl)

      // Update local state
      set(state => ({
        words: state.words.map(word =>
          word.word_id === wordId ? { ...word, image_url: imageUrl } : word
        ),
        // Also update review session if this word is currently being reviewed
        reviewSession: state.reviewSession
          ? {
              ...state.reviewSession,
              words: state.reviewSession.words.map(word =>
                word.word_id === wordId
                  ? { ...word, image_url: imageUrl }
                  : word
              ),
            }
          : null,
      }))

      return updatedWord
    } catch (error) {
      get().setError({
        message: 'Failed to update word image',
        details: error,
      })
      throw error
    }
  },

  // Collection actions
  fetchCollections: async () => {
    const { currentUserId } = get()
    if (!currentUserId) return

    set({ collectionsLoading: true })
    try {
      const collections =
        await collectionService.getUserCollections(currentUserId)
      set({ collections, collectionsLoading: false })
    } catch (error) {
      get().setError({
        message: 'Failed to fetch collections',
        details: error,
      })
      set({ collectionsLoading: false })
    }
  },

  createNewCollection: async (name: string) => {
    const { currentUserId } = get()
    if (!currentUserId) throw new Error('No user ID')

    try {
      const newCollection = await collectionService.createCollection(
        name,
        currentUserId
      )

      set(state => ({
        collections: [newCollection, ...state.collections],
      }))

      return newCollection
    } catch (error) {
      get().setError({
        message: 'Failed to create collection',
        details: error,
      })
      throw error
    }
  },

  // Review session actions
  startReviewSession: async () => {
    const { currentUserId } = get()
    if (!currentUserId) return

    set({ reviewLoading: true })
    try {
      const reviewWords = await wordService.getWordsForReview(currentUserId)

      if (reviewWords.length === 0) {
        get().setError({
          message: 'No words available for review',
        })
        set({ reviewLoading: false })
        return
      }

      const session: ReviewSession = {
        words: reviewWords,
        currentIndex: 0,
        completedCount: 0,
        againQueue: [],
      }

      set({ reviewSession: session, reviewLoading: false })
    } catch (error) {
      get().setError({
        message: 'Failed to start review session',
        details: error,
      })
      set({ reviewLoading: false })
    }
  },

  submitReviewAssessment: async (assessment: any) => {
    const { reviewSession } = get()
    if (!reviewSession) return

    try {
      // Update the word in database with SRS logic
      await get().updateWordAfterReview(assessment.wordId, assessment)

      const currentWord = reviewSession.words[reviewSession.currentIndex]

      // Handle "Again" - add to repeat queue for current session
      if (assessment.quality === 'again') {
        set(state => ({
          reviewSession: state.reviewSession
            ? {
                ...state.reviewSession,
                againQueue: [...state.reviewSession.againQueue, currentWord],
              }
            : null,
        }))
      }

      // Move to next word
      const nextIndex = reviewSession.currentIndex + 1
      if (nextIndex < reviewSession.words.length) {
        set(state => ({
          reviewSession: state.reviewSession
            ? {
                ...state.reviewSession,
                currentIndex: nextIndex,
                completedCount: state.reviewSession.completedCount + 1,
              }
            : null,
        }))
      } else {
        // Check if there are words in again queue
        if (reviewSession.againQueue.length > 0) {
          // Move first word from again queue to current position
          const nextAgainWord = reviewSession.againQueue[0]
          set(state => ({
            reviewSession: state.reviewSession
              ? {
                  ...state.reviewSession,
                  words: [...state.reviewSession.words, nextAgainWord],
                  againQueue: state.reviewSession.againQueue.slice(1),
                }
              : null,
          }))
        } else {
          // Session completed
          set(state => ({
            reviewSession: state.reviewSession
              ? {
                  ...state.reviewSession,
                  currentIndex: nextIndex,
                  completedCount: state.reviewSession.completedCount + 1,
                }
              : null,
          }))
        }
      }
    } catch (error) {
      console.error('Failed to submit review assessment:', error)
      throw error
    }
  },

  endReviewSession: () => {
    set({ reviewSession: null })
  },

  // Error handling
  setError: (error: AppError | null) => {
    set({ error })
  },

  clearError: () => {
    set({ error: null })
  },
}))

// Export hook for easy usage in components
export default useAppStore

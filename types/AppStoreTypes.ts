import type { Word, Collection, ReviewSession, AppError } from './database'

export interface AppState {
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
  currentWord: Word | null

  // Errors
  error: AppError | null

  // Actions
  initializeApp: () => Promise<void>

  // Word actions
  fetchWords: () => Promise<void>
  addNewWord: (word: string) => Promise<Word>
  saveAnalyzedWord: (analyzedWord: any, collectionId?: string) => Promise<Word>
  updateWordAfterReview: (wordId: string, assessment: any) => Promise<void>
  deleteWord: (wordId: string) => Promise<void>

  // Collection actions
  fetchCollections: () => Promise<void>
  createNewCollection: (name: string) => Promise<Collection>

  // Review session actions
  startReviewSession: () => Promise<void>
  submitReviewAssessment: (assessment: any) => Promise<void>
  endReviewSession: () => void
  markCorrect: () => void
  markIncorrect: () => void
  flipCard: () => void

  // Error handling
  setError: (error: AppError) => void
  clearError: () => void
}

export interface ReviewAssessment {
  wordId: string
  assessment: 'again' | 'hard' | 'good' | 'easy'
  responseTime?: number
  timestamp: Date
}

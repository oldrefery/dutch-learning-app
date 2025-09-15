import type {
  Word,
  Collection,
  ReviewSession,
  AppError,
  GeminiWordAnalysis,
  SRSAssessment,
  WordTranslations,
  WordExample,
} from './database'

export type { AppError }

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
  initializeApp: (userId?: string) => Promise<void>

  // Word actions
  fetchWords: () => Promise<void>
  addNewWord: (word: string, collectionId?: string) => Promise<Word>
  saveAnalyzedWord: (
    analyzedWord: AnalyzedWord | GeminiWordAnalysis,
    collectionId?: string
  ) => Promise<Word>
  updateWordAfterReview: (
    wordId: string,
    assessment: ReviewAssessment
  ) => Promise<void>
  deleteWord: (wordId: string) => Promise<void>

  // Collection actions
  fetchCollections: () => Promise<void>
  createNewCollection: (name: string) => Promise<Collection>
  deleteCollection: (collectionId: string) => Promise<void>

  // Review session actions
  startReviewSession: () => Promise<void>
  submitReviewAssessment: (assessment: ReviewAssessment) => Promise<void>
  endReviewSession: () => void
  markCorrect: () => void
  markIncorrect: () => void
  flipCard: () => void
  goToNextWord: () => void
  goToPreviousWord: () => void
  deleteWordFromReview: (wordId: string) => void

  // Error handling
  setError: (error: AppError) => void
  clearError: () => void
}

export interface ReviewAssessment {
  wordId: string
  assessment: SRSAssessment
  responseTime?: number
  timestamp: Date
}

export interface AnalyzedWord {
  dutch_lemma: string
  dutch_original?: string
  translations: WordTranslations
  part_of_speech: string
  examples?: WordExample[]
  image_url?: string
  tts_url?: string
  analysis_metadata?: Record<string, unknown>
  collection_id?: string
  is_irregular?: boolean
  is_reflexive?: boolean
  is_expression?: boolean
  expression_type?: 'idiom' | 'phrase' | 'collocation' | 'compound'
  is_separable?: boolean
  prefix_part?: string
  root_verb?: string
  article?: 'de' | 'het'
}

export interface StoreSetFunction {
  (partial: Partial<AppState>): void
  (fn: (state: AppState) => Partial<AppState>): void
}

export interface StoreGetFunction {
  (): AppState
}

import type {
  Word,
  Collection,
  ReviewSession,
  AppError,
  GeminiWordAnalysis,
  SRSAssessment,
  WordTranslations,
  WordExample,
  AccessLevel,
} from './database'
import { ExpressionType } from './ExpressionTypes'

export type { AppError }

export interface ApplicationState {
  // User data
  currentUserId: string | null
  userAccessLevel: AccessLevel | null

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

  // Settings
  autoPlayPronunciation: boolean

  // Errors
  error: AppError | null

  // Actions
  initializeApp: (userId?: string) => Promise<void>
  fetchUserAccessLevel: () => Promise<void>

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
  updateWordImage: (wordId: string, imageUrl: string) => Promise<void>
  moveWordToCollection: (
    wordId: string,
    newCollectionId: string
  ) => Promise<Word | null>
  resetWordProgress: (wordId: string) => Promise<Word | undefined>
  addWordsToCollection: (
    collectionId: string,
    words: Partial<Word>[],
    isImportFromShared?: boolean
  ) => Promise<boolean>

  // Collection actions
  fetchCollections: () => Promise<void>
  createNewCollection: (name: string) => Promise<Collection | null>
  deleteCollection: (collectionId: string) => Promise<void>
  renameCollection: (collectionId: string, newName: string) => Promise<void>

  // Collection sharing actions
  shareCollection: (collectionId: string) => Promise<string | null>
  unshareCollection: (collectionId: string) => Promise<boolean>
  getCollectionShareStatus: (collectionId: string) => Promise<{
    is_shared: boolean
    share_token: string | null
    shared_at: string | null
  } | null>

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
  updateCurrentWordImage: (imageUrl: string) => void

  // Error handling
  setError: (error: AppError) => void
  clearError: () => void

  // Settings actions
  setAutoPlayPronunciation: (enabled: boolean) => void
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
  expression_type?: ExpressionType
  is_separable?: boolean
  prefix_part?: string
  root_verb?: string
  article?: 'de' | 'het'
}

export interface StoreSetFunction {
  (partial: Partial<ApplicationState>): void
  (fn: (state: ApplicationState) => Partial<ApplicationState>): void
}

export interface StoreGetFunction {
  (): ApplicationState
}

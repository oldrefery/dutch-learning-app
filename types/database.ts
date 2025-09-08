// Database types based on our Supabase schema

export interface User {
  id: string
  username: string | null
  created_at: string
}

export interface Collection {
  collection_id: string
  user_id: string
  name: string
  created_at: string
}

export interface WordTranslations {
  en: string[]
  ru?: string[]
}

export interface WordExample {
  nl: string
  en: string
  ru?: string
}

export interface Word {
  word_id: string
  user_id: string
  collection_id: string | null
  dutch_lemma: string
  dutch_original: string | null
  part_of_speech: string | null
  is_irregular: boolean
  is_reflexive: boolean
  is_expression: boolean
  expression_type?: 'idiom' | 'phrase' | 'collocation' | 'compound'
  article: 'de' | 'het' | null // Article for nouns
  translations: WordTranslations
  examples: WordExample[] | null
  image_url: string | null
  tts_url: string
  // SRS fields
  interval_days: number
  repetition_count: number
  easiness_factor: number
  next_review_date: string
  last_reviewed_at: string | null
  created_at: string
}

// API Response types

export interface GeminiWordAnalysis {
  lemma: string
  part_of_speech: string
  is_irregular?: boolean
  is_reflexive?: boolean
  is_expression?: boolean
  expression_type?: 'idiom' | 'phrase' | 'collocation' | 'compound'
  article?: 'de' | 'het' // Article for nouns
  translations: WordTranslations
  examples: WordExample[]
  tts_url: string
  image_url?: string // Associated image for visual learning
}

// SRS Assessment types

export type SRSAssessment = 'again' | 'hard' | 'good' | 'easy'

export interface SRSResult {
  interval_days: number
  repetition_count: number
  easiness_factor: number
  next_review_date: string
}

// App state types

export interface ReviewSession {
  words: Word[]
  currentIndex: number
  completedCount: number
  againQueue: Word[]
}

export interface AppError {
  message: string
  code?: string
  details?: any
}

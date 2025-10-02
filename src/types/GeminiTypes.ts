// Types for Gemini AI word analysis
import { ExpressionType } from './ExpressionTypes'

export interface WordAnalysisRequest {
  word: string
  collectionId?: string
}

export interface WordAnalysisResponse {
  // Basic word information
  dutch_lemma: string
  part_of_speech: string
  translations: {
    en: string[]
    ru: string[]
  }
  examples: {
    nl: string
    en: string
    ru: string
  }[]

  // Synonyms and antonyms
  synonyms: string[]
  antonyms: string[]

  // Article and plural for nouns
  article: 'de' | 'het' | null
  plural: string | null

  // Verb properties
  is_irregular?: boolean
  is_reflexive?: boolean
  is_separable?: boolean
  prefix_part?: string | null
  root_verb?: string | null
  conjugation?: {
    present: string
    simple_past: string
    simple_past_plural?: string
    past_participle: string
  } | null
  preposition?: string | null

  // Expression properties
  is_expression?: boolean
  expression_type?: ExpressionType | null

  // Image URL
  image_url?: string

  // Metadata
  confidence_score?: number
  analysis_notes?: string
}

export interface GeminiAnalysisResult {
  dutch_lemma: string
  part_of_speech: string
  translations: {
    en: string[]
    ru: string[]
  }
  examples: {
    nl: string
    en: string
    ru: string
  }[]
  synonyms: string[]
  antonyms: string[]
  article: 'de' | 'het' | null
  plural: string | null
  is_irregular?: boolean
  is_reflexive?: boolean
  is_separable?: boolean
  prefix_part?: string | null
  root_verb?: string | null
  conjugation?: {
    present: string
    simple_past: string
    simple_past_plural?: string
    past_participle: string
  } | null
  preposition?: string | null
  is_expression?: boolean
  expression_type?: ExpressionType | null
  image_url?: string
  confidence_score?: number
  analysis_notes?: string
}

export interface SeparableVerbAnalysis {
  is_separable: boolean
  prefix_part: string | null
  root_verb: string | null
}

export interface ImageSearchResult {
  url: string
  alt_description?: string
  width: number
  height: number
}

export interface UnsplashResponse {
  results: {
    id: string
    urls: {
      small: string
      regular: string
      full: string
    }
    alt_description?: string
    width: number
    height: number
  }[]
  total: number
  total_pages: number
}

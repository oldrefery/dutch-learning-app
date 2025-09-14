// Types for Gemini AI word analysis

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
  examples: string[]

  // Article for nouns
  article?: 'de' | 'het'

  // Verb properties
  is_irregular?: boolean
  is_reflexive?: boolean
  is_separable?: boolean
  prefix_part?: string | null
  root_verb?: string | null

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
  examples: string[]
  article?: 'de' | 'het'
  is_irregular?: boolean
  is_reflexive?: boolean
  is_separable?: boolean
  prefix_part?: string | null
  root_verb?: string | null
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

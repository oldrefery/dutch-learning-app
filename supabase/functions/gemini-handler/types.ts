export interface WordAnalysisRequest {
  word: string
  collectionId?: string
  userId: string
}

export interface WordAnalysisResponse {
  success: boolean
  data?: WordAnalysisResult
  error?: string
}

export interface WordAnalysisResult {
  dutch_original: string
  dutch_lemma: string
  part_of_speech: string
  translations: {
    en: string[]
    ru: string[]
  }
  examples: Array<{
    nl: string
    en: string
    ru?: string
  }>
  image_url: string
  is_expression: boolean
  is_irregular: boolean
  is_reflexive: boolean
  is_separable: boolean
  prefix_part?: string
  root_verb?: string
  article?: string
  expression_type?: string
  tts_url: string
}

export interface GeminiAnalysisResult {
  dutch_original: string
  dutch_lemma: string
  part_of_speech: string
  translations: {
    en: string[]
    ru: string[]
  }
  examples: Array<{
    nl: string
    en: string
    ru?: string
  }>
  is_expression: boolean
  is_irregular: boolean
  is_reflexive: boolean
  is_separable: boolean
  prefix_part?: string
  root_verb?: string
  article?: string
  expression_type?: string
}

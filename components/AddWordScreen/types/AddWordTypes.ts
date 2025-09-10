import type { Collection } from '@/types/database'

export interface AnalysisResult {
  dutch_lemma: string
  part_of_speech: string
  is_irregular: boolean
  article?: 'de' | 'het' // Article for nouns
  is_reflexive?: boolean // For reflexive verbs
  is_expression?: boolean // For expressions/idioms
  expression_type?: 'idiom' | 'phrase' | 'collocation' | 'compound' // Type of expression
  is_separable?: boolean // For separable verbs
  prefix_part?: string // Separable prefix (op, aan, etc.)
  root_verb?: string // Root verb part
  translations: {
    en: string[]
    ru?: string[]
  }
  examples: {
    nl: string
    en: string
    ru?: string
  }[]
  tts_url?: string
  image_url?: string // Associated image for visual learning
}

export interface WordInputSectionProps {
  inputWord: string
  setInputWord: (word: string) => void
  onAnalyze: () => void
  isAnalyzing: boolean
  isCheckingDuplicate?: boolean
}

export interface AnalysisResultCardProps {
  analysisResult: AnalysisResult
  isPlayingAudio: boolean
  onPlayPronunciation: (url: string) => void
  onImageChange: (url: string) => void
  onShowImageSelector: () => void
  isAlreadyInCollection?: boolean
  isCheckingDuplicate?: boolean
}

export interface AddToCollectionSectionProps {
  selectedCollection: Collection | null
  onCollectionSelect: (collection: Collection | null) => void
  onAddWord: () => void
  onCancel: () => void
  isAdding: boolean
  collections: Collection[]
}

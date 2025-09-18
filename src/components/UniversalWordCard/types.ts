import type { Word } from '@/types/database'
import type { WordAnalysisResponse } from '@/types/GeminiTypes'
import type { AnalysisResult } from '@/components/AddWordScreen/types/AddWordTypes'

export type WordCardData = Word | WordAnalysisResponse | AnalysisResult

export interface WordCardConfig {
  // Content sections visibility
  showHeader?: boolean
  showTranslations?: boolean
  showExamples?: boolean
  showImage?: boolean
  showSynonyms?: boolean
  showAntonyms?: boolean
  showGrammarInfo?: boolean
  showConjugation?: boolean

  // Interactive features
  enablePronunciation?: boolean
  enableImageChange?: boolean

  // Layout options
  scrollable?: boolean
  compact?: boolean
}

export interface WordCardActionConfig {
  // Review mode actions
  showDeleteButton?: boolean
  onDelete?: () => void

  // Modal mode actions
  showProgressInfo?: boolean
  showStatusInfo?: boolean

  // Analysis mode actions
  showDuplicateCheck?: boolean
  isDuplicateChecking?: boolean
  isAlreadyInCollection?: boolean

  // Save to collection
  showSaveButton?: boolean
  onSave?: () => void
}

export interface UniversalWordCardProps {
  word: WordCardData
  config?: Partial<WordCardConfig> // Опциональный, принимает частичные изменения
  actions?: WordCardActionConfig

  // Audio functionality
  isPlayingAudio?: boolean
  onPlayPronunciation?: (url: string) => void

  // Image functionality
  onChangeImage?: () => void

  // Custom styling
  style?: any
  contentStyle?: any
}

export interface WordSectionProps {
  word: WordCardData
  config: WordCardConfig
  isPlayingAudio?: boolean
  onPlayPronunciation?: (url: string) => void
  onChangeImage?: () => void
}

// Helper type guards
export function isGeminiAnalysisResult(
  word: WordCardData
): word is WordAnalysisResponse {
  return 'confidence_score' in word || 'analysis_notes' in word
}

export function isLegacyAnalysisResult(
  word: WordCardData
): word is AnalysisResult {
  return 'lemma' in word && 'tts_url' in word
}

export function isAnalysisResult(
  word: WordCardData
): word is WordAnalysisResponse | AnalysisResult {
  return isGeminiAnalysisResult(word) || isLegacyAnalysisResult(word)
}

export function isWordFromDB(word: WordCardData): word is Word {
  return 'word_id' in word && 'created_at' in word
}

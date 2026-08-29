import type { Collection, Word } from '@/types/database'

export type ImportableWord = Omit<
  Word,
  | 'user_id'
  | 'easiness_factor'
  | 'interval_days'
  | 'repetition_count'
  | 'next_review_date'
  | 'last_reviewed_at'
>

export interface ImportCollectionSummary extends Pick<Collection, 'name'> {
  collection_id?: string
  word_count?: number
}

export interface ImportPreviewData {
  collection: ImportCollectionSummary
  words: ImportableWord[]
}

export interface ImportTargetCollection {
  collection_id: string
  name: string
}

export interface WordSelectionItem {
  word: ImportableWord
  selected: boolean
  isDuplicate: boolean
  existingInCollection?: string
}

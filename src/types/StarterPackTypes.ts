import type {
  WordConjugation,
  WordExample,
  WordRegister,
  WordTranslations,
} from '@/types/database'
import type { ExpressionType } from '@/types/ExpressionTypes'

export const STARTER_PACK_SCHEMA_VERSION = 1 as const

export type StarterPackReviewStatus = 'pending' | 'approved'

export interface StarterPackContentReview {
  status: StarterPackReviewStatus
  reviewed_by: string | null
  reviewed_at: string | null
  notes: string
}

export interface StarterPackLicense {
  name: string
  url: string | null
  notes: string
}

export interface StarterPackProvenance {
  origin: 'original-project-content' | 'existing-project-library'
  source_snapshot_at?: string
  source_card_count?: number
  source_unique_semantic_count?: number
  selection_method?: string
  notes: string
  excluded_sources: string[]
}

export interface StarterPackEntry {
  entry_id: string
  dutch_lemma: string
  dutch_original?: string | null
  part_of_speech: string
  translations: WordTranslations
  examples?: WordExample[]
  is_irregular?: boolean
  is_reflexive?: boolean
  is_expression?: boolean
  expression_type?: ExpressionType | null
  is_separable?: boolean
  prefix_part?: string | null
  root_verb?: string | null
  article?: 'de' | 'het' | null
  plural?: string | null
  register?: WordRegister | null
  synonyms?: string[]
  antonyms?: string[]
  conjugation?: WordConjugation | null
  preposition?: string | null
  analysis_notes?: string | null
}

export interface StarterPackManifest {
  schema_version: typeof STARTER_PACK_SCHEMA_VERSION
  pack_id: string
  version: string
  title: string
  description: string
  source_language: 'nl'
  translation_languages: string[]
  created_at: string
  license: StarterPackLicense
  provenance: StarterPackProvenance
  content_review: StarterPackContentReview
  entries: StarterPackEntry[]
}

export interface StarterPackValidationIssue {
  path: string
  message: string
}

export type StarterPackValidationResult =
  | { success: true; data: StarterPackManifest }
  | { success: false; issues: StarterPackValidationIssue[] }

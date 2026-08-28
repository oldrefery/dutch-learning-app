import type {
  ReviewMode,
  ReviewScope,
  ReviewSessionConfig,
} from '@/types/ReviewTypes'

export const REVIEW_MODE = {
  RECOGNITION: 'recognition',
  MEANING_RECALL: 'meaning-recall',
  DUTCH_PRODUCTION: 'dutch-production',
} as const satisfies Record<string, ReviewMode>

export const REVIEW_SCOPE = {
  ALL_DUE: 'all-due',
  COLLECTION_DUE: 'collection-due',
  DIFFICULT_DUE: 'difficult-due',
} as const satisfies Record<string, ReviewScope>

export const DEFAULT_REVIEW_SESSION_CONFIG = {
  mode: REVIEW_MODE.MEANING_RECALL,
  scope: REVIEW_SCOPE.ALL_DUE,
} as const satisfies ReviewSessionConfig

export const DIFFICULT_EASINESS_FACTOR_THRESHOLD = 2.1

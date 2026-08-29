import type {
  ReviewMode,
  ReviewScope,
  ReviewSessionConfig,
  ReviewSessionMode,
} from '@/types/ReviewTypes'

export const REVIEW_MODE = {
  RECOGNITION: 'recognition',
  MEANING_RECALL: 'meaning-recall',
  DUTCH_PRODUCTION: 'dutch-production',
} as const satisfies Record<string, ReviewMode>

export const REVIEW_SESSION_MODE = {
  ...REVIEW_MODE,
  ADAPTIVE: 'adaptive',
} as const satisfies Record<string, ReviewSessionMode>

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

export const MAX_REVIEW_RESPONSE_TIME_MS = 60 * 60 * 1000

/**
 * A word is mastered after three successful repetitions.
 * This matches the existing progress definition used across collection stats.
 */
export const MASTERED_MIN_REPETITIONS = 3

export const REVIEW_MODE_OPTIONS = [
  {
    mode: REVIEW_SESSION_MODE.ADAPTIVE,
    title: 'Adaptive',
    description: 'Automatically choose the right challenge for each word.',
  },
  {
    mode: REVIEW_MODE.RECOGNITION,
    title: 'Recognition',
    description: 'Choose the correct meaning from several options.',
  },
  {
    mode: REVIEW_MODE.MEANING_RECALL,
    title: 'Meaning Recall',
    description: 'See the Dutch word and recall its meaning.',
  },
  {
    mode: REVIEW_MODE.DUTCH_PRODUCTION,
    title: 'Dutch Production',
    description: 'See a translation and produce the Dutch word.',
  },
] as const satisfies readonly {
  mode: ReviewSessionMode
  title: string
  description: string
}[]

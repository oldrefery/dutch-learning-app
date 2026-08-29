import type { SRSAssessment, Word } from './database'

export type ReviewMode = 'recognition' | 'meaning-recall' | 'dutch-production'

export type ReviewScope = 'all-due' | 'collection-due' | 'difficult-due'

interface BaseReviewSessionConfig {
  mode: ReviewMode
}

export type ReviewSessionConfig =
  | (BaseReviewSessionConfig & {
      scope: 'all-due'
      collectionId?: never
    })
  | (BaseReviewSessionConfig & {
      scope: 'collection-due'
      collectionId: string
    })
  | (BaseReviewSessionConfig & {
      scope: 'difficult-due'
      collectionId?: never
    })

export interface ReviewSession {
  words: Word[]
  currentIndex: number
  completedCount: number
  config: ReviewSessionConfig
}

export interface ReviewEvent {
  event_id: string
  user_id: string
  word_id: string
  assessment: SRSAssessment
  review_mode: ReviewMode
  answered_correctly: boolean | null
  response_time_ms: number | null
  previous_interval_days: number
  next_interval_days: number
  previous_easiness_factor: number
  next_easiness_factor: number
  reviewed_at: string
  created_at: string
}

export type ReviewEventDraft = Omit<ReviewEvent, 'created_at'>

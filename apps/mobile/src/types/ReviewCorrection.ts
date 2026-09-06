import type { SRSAssessment } from './database'

export interface ReviewCorrectionCommand {
  correction_id: string
  event_id: string
  word_id: string
  user_id: string
  expected_revision: number
  assessment: SRSAssessment
}

export interface PendingReviewCorrection extends ReviewCorrectionCommand {
  sequence: number
  status: 'pending' | 'conflict'
  error: string | null
}

export interface ReviewCorrectionReceipt extends ReviewCorrectionCommand {
  revision: number
  next_interval_days: number
  next_repetition_count: number
  next_easiness_factor: number
  created_at: string
}

export interface LocalReviewCorrection extends ReviewCorrectionCommand {
  status: 'pending' | 'conflict' | 'synced'
  resolved_at: string | null
  error: string | null
}

export interface ReviewCorrectionProgress {
  word_id: string
  user_id: string
  interval_days: number
  repetition_count: number
  easiness_factor: number
  next_review_date: string
  last_reviewed_at: string | null
}

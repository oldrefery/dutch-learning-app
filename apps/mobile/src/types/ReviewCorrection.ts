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

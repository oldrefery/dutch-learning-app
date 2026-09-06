import type { Database } from '@woordenaar/supabase-contracts'
import type { ReviewAssessment, ReviewProgressUpdate } from './types'

export interface ReviewCorrectionInput {
  userId: string
  wordId: string
  eventId: string
  correctionId: string
  expectedRevision: number
  assessment: ReviewAssessment
}

export interface ReviewCorrectionAcknowledgement {
  correction_id: string
  event_id: string
  accepted_revision: number
  effective_revision: number
  effective_assessment: string
  word_id: string
  interval_days: number
  repetition_count: number
  easiness_factor: number
  next_review_date: string
  last_reviewed_at: string | null
}

export type ReviewCorrectionResult =
  | {
      status: 'success'
      correctionId: string
      eventId: string
      acceptedRevision: number
      effectiveRevision: number
      assessment: ReviewAssessment
      update: Omit<ReviewProgressUpdate, 'lastReviewedAt'> & {
        lastReviewedAt: string | null
      }
    }
  | {
      status: 'unavailable' | 'conflict' | 'invalid' | 'retry'
      message: string
    }

export type ReviewCorrectionRefreshInput = Pick<
  ReviewCorrectionInput,
  'userId' | 'wordId' | 'eventId'
>
export type ReviewCorrectionRefreshResult =
  | {
      status: 'success'
      userId: string
      wordId: string
      eventId: string
      correctionsAvailable: boolean
      progress:
        Extract<ReviewCorrectionResult, { status: 'success' }>['update'] | null
      event: { assessment: ReviewAssessment; revision: number } | null
    }
  | { status: 'error'; message: string }

/** Planned additive schema, scoped to capability-aware callers only.
 * Keep generated/deployed Database metadata unchanged until migration rollout.
 */
export type ReviewCorrectionDatabase = Omit<Database, 'public'> & {
  public: Omit<Database['public'], 'Functions' | 'Views'> & {
    Functions: Database['public']['Functions'] & {
      review_correction_protocol: {
        Args: Record<string, never>
        Returns: number
      }
      correct_review_assessment: {
        Args: {
          p_word_id: string
          p_event_id: string
          p_correction_id: string
          p_expected_revision: number
          p_assessment: string
        }
        Returns: ReviewCorrectionAcknowledgement[]
      }
    }
    Views: Database['public']['Views'] & {
      effective_review_events: {
        Row: Database['public']['Tables']['review_events']['Row'] & {
          original_assessment: string
          revision: number
        }
        Relationships: []
      }
    }
  }
}

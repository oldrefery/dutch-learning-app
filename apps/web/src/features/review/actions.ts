'use server'

import { revalidatePath } from 'next/cache'
import { requireAuthContext } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import {
  isReviewAssessment,
  isReviewMode,
  MAX_REVIEW_RESPONSE_TIME_MS,
} from './review-domain'
import type { ReviewSubmissionInput, ReviewSubmissionResult } from './types'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const isValidSubmission = (input: ReviewSubmissionInput) =>
  UUID_PATTERN.test(input.wordId) &&
  UUID_PATTERN.test(input.eventId) &&
  isReviewAssessment(input.assessment) &&
  isReviewMode(input.reviewMode) &&
  DATE_PATTERN.test(input.reviewDate) &&
  Number.isFinite(Date.parse(input.reviewedAt)) &&
  Number.isInteger(input.responseTimeMs) &&
  input.responseTimeMs >= 0 &&
  input.responseTimeMs <= MAX_REVIEW_RESPONSE_TIME_MS &&
  (input.answeredCorrectly === null ||
    typeof input.answeredCorrectly === 'boolean')

export async function submitReviewAssessment(
  input: ReviewSubmissionInput
): Promise<ReviewSubmissionResult> {
  await requireAuthContext()

  if (!isValidSubmission(input)) {
    return { status: 'error', message: 'The review result is invalid.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('record_review_assessment', {
    p_answered_correctly: input.answeredCorrectly,
    p_assessment: input.assessment,
    p_event_id: input.eventId,
    p_response_time_ms: input.responseTimeMs,
    p_review_date: input.reviewDate,
    p_review_mode: input.reviewMode,
    p_reviewed_at: input.reviewedAt,
    p_word_id: input.wordId,
  })
  const update = data?.[0]

  if (error || !update) {
    return {
      status: 'error',
      message: 'Could not save this review. Please try again.',
    }
  }

  revalidatePath('/app/collections')
  revalidatePath('/app/review')

  return {
    status: 'success',
    update: {
      easinessFactor: update.easiness_factor,
      intervalDays: update.interval_days,
      lastReviewedAt: update.last_reviewed_at,
      nextReviewDate: update.next_review_date,
      repetitionCount: update.repetition_count,
      wordId: update.word_id,
    },
  }
}

'use server'

import * as Sentry from '@sentry/nextjs'
import { requireAuthContext } from '@/lib/auth/session'
import {
  createCorrectionClient,
  readCorrectionCapability,
} from './correction-client'
import {
  isReviewCorrectionAcknowledgement,
  isReviewCorrectionInput,
} from './correction-validation'
import type {
  ReviewCorrectionInput,
  ReviewCorrectionResult,
} from './correction-contract'
import type { ReviewAssessment } from './types'

const RETRY_MESSAGE =
  'Could not confirm the correction. Retry the same edit before changing the assessment again.'

export async function submitReviewCorrection(
  input: ReviewCorrectionInput
): Promise<ReviewCorrectionResult> {
  const auth = await requireAuthContext()
  if (!isReviewCorrectionInput(input) || input.userId !== auth.userId) {
    return {
      status: 'invalid',
      message:
        'The review correction is invalid or the signed-in account changed.',
    }
  }
  try {
    const client = await createCorrectionClient()
    if (!(await readCorrectionCapability(client))) {
      return {
        status: 'unavailable',
        message: 'Assessment corrections are not available on this server yet.',
      }
    }
    const { data, error } = await client.rpc('correct_review_assessment', {
      p_word_id: input.wordId,
      p_event_id: input.eventId,
      p_correction_id: input.correctionId,
      p_expected_revision: input.expectedRevision,
      p_assessment: input.assessment,
    })
    if (error?.code === 'PT409' || error?.code === '40001') {
      return {
        status: 'conflict',
        message:
          'This word was changed elsewhere or reviewed again. Refresh its progress before making another edit.',
      }
    }
    if (error?.code === '22023' || error?.code === '42501') {
      return {
        status: 'invalid',
        message:
          'This review cannot be corrected. It may no longer be available or eligible.',
      }
    }
    if (error) throw new Error('Review correction request failed')
    const row = data?.[0]
    if (data?.length !== 1 || !isReviewCorrectionAcknowledgement(row, input)) {
      throw new Error('Invalid review correction acknowledgement')
    }
    return {
      status: 'success',
      correctionId: row.correction_id,
      eventId: row.event_id,
      acceptedRevision: row.accepted_revision,
      effectiveRevision: row.effective_revision,
      assessment: row.effective_assessment as ReviewAssessment,
      update: {
        wordId: row.word_id,
        intervalDays: row.interval_days,
        repetitionCount: row.repetition_count,
        easinessFactor: row.easiness_factor,
        nextReviewDate: row.next_review_date,
        lastReviewedAt: row.last_reviewed_at,
      },
    }
  } catch {
    // Never send raw provider responses, identities, or word contents to telemetry.
    Sentry.captureException(
      new Error('Review correction could not be confirmed'),
      {
        tags: { operation: 'correct_review_assessment' },
      }
    )
    return { status: 'retry', message: RETRY_MESSAGE }
  }
}

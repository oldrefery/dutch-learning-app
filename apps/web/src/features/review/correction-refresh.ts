'use server'

import { requireAuthContext } from '@/lib/auth/session'
import { isUuid } from '@/features/words/word-detail'
import {
  createCorrectionClient,
  readCorrectionCapability,
} from './correction-client'
import { isReviewAssessment } from './review-domain'
import type {
  ReviewCorrectionRefreshInput,
  ReviewCorrectionRefreshResult,
} from './correction-contract'

/** Read-only conflict resolution; never retries or replaces an assessment. */
export async function loadReviewCorrectionState(
  input: ReviewCorrectionRefreshInput
): Promise<ReviewCorrectionRefreshResult> {
  const auth = await requireAuthContext()
  if (
    !input ||
    input.userId !== auth.userId ||
    typeof input.wordId !== 'string' ||
    !isUuid(input.wordId) ||
    typeof input.eventId !== 'string' ||
    !isUuid(input.eventId)
  ) {
    return {
      status: 'error',
      message: 'This review is not available for the signed-in account.',
    }
  }
  try {
    const client = await createCorrectionClient()
    const correctionsAvailable = await readCorrectionCapability(client)
    const word = await client
      .from('words')
      .select(
        'word_id, interval_days, repetition_count, easiness_factor, next_review_date, last_reviewed_at'
      )
      .eq('user_id', auth.userId)
      .eq('word_id', input.wordId)
      .is('deleted_at', null)
      .maybeSingle()
    if (word.error) throw new Error('Progress unavailable')
    const event =
      correctionsAvailable && word.data
        ? await client
            .from('effective_review_events')
            .select('assessment, revision')
            .eq('user_id', auth.userId)
            .eq('word_id', input.wordId)
            .eq('event_id', input.eventId)
            .maybeSingle()
        : { data: null, error: null }
    if (
      event.error ||
      (event.data &&
        (!isReviewAssessment(event.data.assessment) ||
          !Number.isSafeInteger(event.data.revision) ||
          event.data.revision < 0))
    ) {
      throw new Error('Effective review unavailable')
    }
    return {
      status: 'success',
      userId: auth.userId,
      wordId: input.wordId,
      eventId: input.eventId,
      correctionsAvailable,
      progress: word.data
        ? {
            wordId: word.data.word_id,
            intervalDays: word.data.interval_days,
            repetitionCount: word.data.repetition_count,
            easinessFactor: word.data.easiness_factor,
            nextReviewDate: word.data.next_review_date,
            lastReviewedAt: word.data.last_reviewed_at,
          }
        : null,
      event:
        event.data && isReviewAssessment(event.data.assessment)
          ? { assessment: event.data.assessment, revision: event.data.revision }
          : null,
    }
  } catch {
    return {
      status: 'error',
      message:
        'Could not refresh server progress. Try again before continuing.',
    }
  }
}

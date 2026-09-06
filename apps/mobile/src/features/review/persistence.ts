import { reviewEventRepository } from '@/db/reviewEventRepository'
import { wordRepository } from '@/db/wordRepository'
import { calculateNextReview } from '@/utils/srs'
import { toLocalDateKey } from '@woordenaar/domain'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { learningOperationQueue } from '@/services/learningOperationQueue'
import { reviewCorrectionRecoveryRepository } from '@/db/reviewCorrectionRecoveryRepository'
import type { NativeReviewSubmission } from './controller'

/** Keep the full local persistence payload stable through a failed acknowledgement. */
export function createNativeReviewPersistence(userId: string) {
  let pending:
    Parameters<typeof reviewEventRepository.recordAssessment>[0] | null = null
  const persist = async (input: NativeReviewSubmission): Promise<void> => {
    if (
      input.userId !== userId ||
      useApplicationStore.getState().currentUserId !== userId
    ) {
      throw new Error('Review account changed')
    }
    await reviewCorrectionRecoveryRepository.assertReady(userId)
    if (!pending) {
      const word = await wordRepository.getWordByIdAndUserId(
        input.wordId,
        userId
      )
      if (!word) throw new Error('Review word unavailable')
      const progress = calculateNextReview(
        { ...word, assessment: input.assessment },
        new Date(input.reviewedAt)
      )
      pending = {
        idempotent: true,
        progress,
        event: {
          event_id: input.eventId,
          user_id: userId,
          word_id: input.wordId,
          assessment: input.assessment,
          review_mode: input.reviewMode,
          answered_correctly: input.answeredCorrectly,
          response_time_ms: input.responseTimeMs,
          previous_interval_days: word.interval_days,
          previous_easiness_factor: word.easiness_factor,
          next_interval_days: progress.interval_days,
          next_easiness_factor: progress.easiness_factor,
          reviewed_at: input.reviewedAt,
          review_date: toLocalDateKey(new Date(input.reviewedAt)),
        },
      }
    }
    if (pending.event.event_id !== input.eventId)
      throw new Error('Resolve the pending answer first')
    if (useApplicationStore.getState().currentUserId !== userId)
      throw new Error('Review account changed')
    await reviewEventRepository.recordAssessment(pending)
    const word = await wordRepository.getWordByIdAndUserId(input.wordId, userId)
    if (useApplicationStore.getState().currentUserId === userId && word) {
      useApplicationStore.setState(state => ({
        words: state.words.map(existing =>
          existing.word_id === word.word_id ? word : existing
        ),
      }))
    }
    pending = null
  }
  return (input: NativeReviewSubmission): Promise<void> => {
    const command = { ...input }
    return learningOperationQueue.run(() => persist(command))
  }
}

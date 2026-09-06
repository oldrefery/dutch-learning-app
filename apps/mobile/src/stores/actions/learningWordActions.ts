import { randomUUID } from 'expo-crypto'
import { addLocalCalendarDays, toLocalDateKey } from '@woordenaar/domain'
import { wordRepository } from '@/db/wordRepository'
import { reviewEventRepository } from '@/db/reviewEventRepository'
import { learningOperationQueue } from '@/services/learningOperationQueue'
import { reviewCorrectionRecoveryRepository } from '@/db/reviewCorrectionRecoveryRepository'
import { calculateNextReview } from '@/utils/srs'
import { logError } from '@/utils/logger'
import { createStoreError } from '@/types/ErrorTypes'
import type {
  ApplicationState,
  ReviewAssessment,
  StoreGetFunction,
  StoreSetFunction,
} from '@/types/ApplicationStoreTypes'
import {
  DEFAULT_REVIEW_SESSION_CONFIG,
  MAX_REVIEW_RESPONSE_TIME_MS,
} from '@/constants/ReviewConstants'

const REVIEW_FAILED = 'Failed to update word progress'
const RESET_FAILED = 'Failed to reset word progress'

export function createLearningWordActions(
  set: StoreSetFunction,
  get: StoreGetFunction
): Pick<ApplicationState, 'updateWordAfterReview' | 'resetWordProgress'> {
  const activeReviews = new Set<string>()
  const activeResets = new Set<string>()
  const sameAccount = (userId: string | null) => get().currentUserId === userId
  const report = (
    userId: string | null,
    message: string,
    error: unknown,
    context: Record<string, unknown>,
    reset = false
  ) => {
    if (!sameAccount(userId)) return
    logError(message, error, context, 'words', false)
    set({
      error: createStoreError(reset ? RESET_FAILED : REVIEW_FAILED, {
        originalError: error instanceof Error ? error : undefined,
      }),
    })
  }
  return {
    updateWordAfterReview: async (wordId, assessment) => {
      const userId = get().currentUserId
      const key = JSON.stringify([userId, wordId])
      // Claim before waiting for sync. A duplicate must not advance the caller.
      if (activeReviews.has(key)) return false
      activeReviews.add(key)
      const session = get().reviewSession
      const mode =
        session?.config.mode === 'adaptive'
          ? session.adaptiveModeByWordId[wordId]?.mode
          : session?.config.mode
      const command: ReviewAssessment = {
        ...assessment,
        reviewMode:
          assessment?.reviewMode ?? mode ?? DEFAULT_REVIEW_SESSION_CONFIG.mode,
        timestamp: new Date(
          assessment?.timestamp instanceof Date &&
            Number.isFinite(assessment.timestamp.getTime())
            ? assessment.timestamp.getTime()
            : Date.now()
        ),
      }
      try {
        return await learningOperationQueue.run(async () => {
          if (!sameAccount(userId)) return false
          if (
            !userId ||
            !wordId ||
            !['again', 'hard', 'good', 'easy'].includes(command.assessment)
          )
            throw new Error('Invalid review identity or assessment')
          await reviewCorrectionRecoveryRepository.assertReady(userId)
          const word = await wordRepository.getWordByIdAndUserId(wordId, userId)
          if (!sameAccount(userId)) return false
          if (!word) throw new Error('Review word not found')
          const progress = calculateNextReview(
            { ...word, assessment: command.assessment },
            command.timestamp
          )
          const reviewedAt = command.timestamp.toISOString()
          const responseTime = command.responseTime
          await reviewEventRepository.recordAssessment({
            progress,
            event: {
              event_id: randomUUID(),
              user_id: userId,
              word_id: wordId,
              assessment: command.assessment,
              review_mode: command.reviewMode!,
              answered_correctly:
                command.reviewMode === 'recognition'
                  ? (command.answeredCorrectly ?? null)
                  : null,
              response_time_ms:
                responseTime === undefined || !Number.isFinite(responseTime)
                  ? null
                  : Math.min(
                      MAX_REVIEW_RESPONSE_TIME_MS,
                      Math.max(0, Math.round(responseTime))
                    ),
              previous_interval_days: word.interval_days,
              next_interval_days: progress.interval_days,
              previous_easiness_factor: word.easiness_factor,
              next_easiness_factor: progress.easiness_factor,
              reviewed_at: reviewedAt,
            },
          })
          if (!sameAccount(userId)) return false
          // Merge progress into fresh cache entries; do not restore stale metadata.
          set({
            words: get().words.map(current =>
              current.word_id === wordId && current.user_id === userId
                ? {
                    ...current,
                    ...progress,
                    last_reviewed_at: reviewedAt,
                    updated_at: reviewedAt,
                  }
                : current
            ),
          })
          return true
        })
      } catch (error) {
        report(userId, 'Error updating word after review', error, {
          wordId,
          assessment,
        })
        return false
      } finally {
        activeReviews.delete(key)
      }
    },
    resetWordProgress: async wordId => {
      const userId = get().currentUserId
      const key = JSON.stringify([userId, wordId])
      if (activeResets.has(key)) return
      activeResets.add(key)
      try {
        return await learningOperationQueue.run(async () => {
          if (!sameAccount(userId)) return
          if (!userId || !wordId) throw new Error('Invalid reset identity')
          await reviewCorrectionRecoveryRepository.assertReady(userId)
          await wordRepository.resetWordProgress(wordId, userId)
          if (!sameAccount(userId)) return
          const now = new Date()
          const words = get().words.map(word =>
            word.word_id === wordId && word.user_id === userId
              ? {
                  ...word,
                  interval_days: 1,
                  repetition_count: 0,
                  easiness_factor: 2.5,
                  next_review_date: toLocalDateKey(
                    addLocalCalendarDays(now, 1)
                  ),
                  last_reviewed_at: null,
                  updated_at: now.toISOString(),
                }
              : word
          )
          set({ words })
          return words.find(
            word => word.word_id === wordId && word.user_id === userId
          )
        })
      } catch (error) {
        report(userId, 'Error resetting word progress', error, { wordId }, true)
      } finally {
        activeResets.delete(key)
      }
    },
  }
}

import { randomUUID } from 'expo-crypto'
import type { ReviewSession } from '@/types/ReviewTypes'
import { useApplicationStore } from '@/stores/useApplicationStore'
import {
  createNativeReviewController,
  type NativeReviewController,
} from './controller'
import { createNativeReviewPersistence } from './persistence'
import {
  prepareNativeReviewQuestions,
  prepareNativeReviewQuestionsAsync,
} from './questions'
import { createNativeCorrectionTransport } from './correctionTransport'
import { measureReviewPreparation } from './preparationTelemetry'

// Route remounts reuse the same in-memory session. App restart does not restore
// a session, but committed assessments remain in the durable SQLite queue.
const controllers = new WeakMap<ReviewSession, NativeReviewController>()
export function getNativeReviewSession(
  session: ReviewSession,
  userId: string,
  manualRecognition: boolean,
  questions?: ReturnType<typeof prepareNativeReviewQuestions>
) {
  const existing = controllers.get(session)
  if (existing?.getSnapshot().userId === userId) return existing
  const controller = createNativeReviewController(
    {
      sessionId: randomUUID(),
      userId,
      manualRecognition,
      now: Date.now(),
      questions:
        questions ??
        prepareNativeReviewQuestions(
          session,
          useApplicationStore.getState().words,
          userId
        ),
    },
    createNativeReviewPersistence(userId),
    randomUUID,
    createNativeCorrectionTransport(userId)
  )
  controllers.set(session, controller)
  return controller
}

export async function loadNativeReviewSession(
  session: ReviewSession,
  userId: string,
  manualRecognition: boolean,
  signal: AbortSignal,
  onProgress: (completed: number) => void
) {
  const existing = controllers.get(session)
  if (existing?.getSnapshot().userId === userId) return existing
  if (signal.aborted) return null
  const vocabulary = useApplicationStore.getState().words
  return measureReviewPreparation(
    {
      wordCount: session.words.length,
      vocabularyCount: vocabulary.length,
      mode: session.config.mode,
    },
    signal,
    async () => {
      const questions = await prepareNativeReviewQuestionsAsync(
        session,
        vocabulary,
        userId,
        signal,
        onProgress
      )
      if (!questions || signal.aborted) return null
      return getNativeReviewSession(
        session,
        userId,
        manualRecognition,
        questions
      )
    }
  )
}

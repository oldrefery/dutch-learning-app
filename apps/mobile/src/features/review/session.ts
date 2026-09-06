import { randomUUID } from 'expo-crypto'
import type { ReviewSession } from '@/types/ReviewTypes'
import { useApplicationStore } from '@/stores/useApplicationStore'
import {
  createNativeReviewController,
  type NativeReviewController,
} from './controller'
import { createNativeReviewPersistence } from './persistence'
import { prepareNativeReviewQuestions } from './questions'

// Route remounts reuse the same in-memory session. App restart does not restore
// a session, but committed assessments remain in the durable SQLite queue.
const controllers = new WeakMap<ReviewSession, NativeReviewController>()
export function getNativeReviewSession(
  session: ReviewSession,
  userId: string,
  manualRecognition: boolean
) {
  const existing = controllers.get(session)
  if (existing?.getSnapshot().userId === userId) return existing
  const controller = createNativeReviewController(
    {
      sessionId: randomUUID(),
      userId,
      manualRecognition,
      now: Date.now(),
      questions: prepareNativeReviewQuestions(
        session,
        useApplicationStore.getState().words,
        userId
      ),
    },
    createNativeReviewPersistence(userId),
    randomUUID
  )
  controllers.set(session, controller)
  return controller
}

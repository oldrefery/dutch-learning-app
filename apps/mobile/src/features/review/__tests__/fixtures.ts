import { createMockWord } from '@/__tests__/helpers/factories'
import type { ReviewSession } from '@/types/ReviewTypes'
import { prepareNativeReviewQuestions } from '../questions'
import { createNativeReviewController } from '../controller'
import type { NativeCorrectionTransport } from '../correctionController'

export const userId = 'review-qa'
export const vocabulary = ['house', 'chair', 'table', 'door'].map(
  (translation, index) =>
    createMockWord({
      word_id: `word-${index}`,
      user_id: userId,
      dutch_lemma: `woord-${index}`,
      translations: { en: [translation] },
    })
)
export const makeSession = (
  mode: ReviewSession['config']['mode'] = 'recognition'
): ReviewSession => ({
  words: vocabulary.slice(0, 3),
  currentIndex: 0,
  completedCount: 0,
  config: { mode, scope: 'all-due' },
  adaptiveModeByWordId: {},
})
export const makeController = (
  persist = jest.fn().mockResolvedValue(undefined),
  manualRecognition = false,
  correctionTransport?: NativeCorrectionTransport
) => {
  let sequence = 0
  return createNativeReviewController(
    {
      userId,
      sessionId: 'session',
      now: Date.now(),
      manualRecognition,
      questions: prepareNativeReviewQuestions(
        makeSession(),
        vocabulary,
        userId
      ),
    },
    persist,
    () => `event-${++sequence}`,
    correctionTransport
  )
}
export function deferred() {
  let resolve: () => void = () => {}
  let reject: (error: Error) => void = () => {}
  const promise = new Promise<void>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

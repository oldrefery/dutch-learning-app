import type { ReviewFlowQuestion } from '@woordenaar/domain'
import type { Word } from '@/types/database'
import type { ReviewSession } from '@/types/ReviewTypes'
import {
  createRecognitionOptionBuilder,
  getPreferredTranslation,
} from '@/utils/reviewDistractors'
import { getAdaptiveReviewModeExplanation } from '@/utils/reviewModePolicy'

export interface NativeReviewPayload {
  word: Word
  translation: string | null
  explanation: string | null
}

export function prepareNativeReviewQuestions(
  session: ReviewSession,
  vocabulary: Word[],
  userId: string
): ReviewFlowQuestion<NativeReviewPayload>[] {
  return [...iterateNativeReviewQuestions(session, vocabulary, userId)]
}

function* iterateNativeReviewQuestions(
  session: ReviewSession,
  vocabulary: Word[],
  userId: string
): Generator<ReviewFlowQuestion<NativeReviewPayload>> {
  const ownedVocabulary = vocabulary.filter(word => word.user_id === userId)
  const buildOptions = createRecognitionOptionBuilder(ownedVocabulary)
  let index = 0
  for (const source of session.words) {
    if (source.user_id !== userId) continue
    // Database words contain only JSON values; keep history independent of live edits.
    const word: Word = JSON.parse(JSON.stringify(source))
    const decision = session.adaptiveModeByWordId[word.word_id]
    let mode =
      session.config.mode === 'adaptive'
        ? (decision?.mode ?? 'recognition')
        : session.config.mode
    let explanation =
      session.config.mode === 'adaptive' && decision
        ? getAdaptiveReviewModeExplanation(decision)
        : null
    const translation = getPreferredTranslation(word)
    const options = mode === 'recognition' ? buildOptions(word) : null
    if (
      (mode === 'recognition' && !options) ||
      (mode === 'dutch-production' && !translation)
    ) {
      mode = 'meaning-recall'
      explanation =
        'Not enough distinct translations. Using Meaning Recall for this word.'
    }
    yield {
      id: `${index++}:${word.word_id}`,
      wordId: word.word_id,
      mode,
      options: options ?? [],
      payload: { word, translation, explanation },
    }
  }
}

/** Yield to native input/painting between bounded batches; never truncate the queue. */
export async function prepareNativeReviewQuestionsAsync(
  session: ReviewSession,
  vocabulary: Word[],
  userId: string,
  signal: AbortSignal,
  onProgress: (completed: number) => void,
  yieldToUI = () => new Promise<void>(resolve => setTimeout(resolve, 0))
) {
  const questions: ReviewFlowQuestion<NativeReviewPayload>[] = []
  const iterator = iterateNativeReviewQuestions(session, vocabulary, userId)
  while (!signal.aborted) {
    await yieldToUI()
    if (signal.aborted) return null
    const started = Date.now()
    for (let count = 0; count < 50; count++) {
      const next = iterator.next()
      if (next.done) return questions
      questions.push(next.value)
      if (Date.now() - started >= 8) break
    }
    onProgress(questions.length)
  }
  return null
}

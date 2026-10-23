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

const copyWord = (word: Word): Word => JSON.parse(JSON.stringify(word)) as Word

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
  userId: string,
  copyWords = true
): Generator<ReviewFlowQuestion<NativeReviewPayload>> {
  const ownedVocabulary = vocabulary.filter(word => word.user_id === userId)
  const buildOptions = createRecognitionOptionBuilder(ownedVocabulary)
  const ownedWords = session.words.filter(word => word.user_id === userId)
  const sourceWords = copyWords ? ownedWords.map(copyWord) : ownedWords
  let index = 0
  for (const word of sourceWords) {
    // Database words contain only JSON values; keep history independent of live edits.
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
  if (signal.aborted) return null
  // Capture all content before the first yield. A sync during preparation must
  // not give later questions or distractors a different shared revision/CEFR.
  const capturedSession: ReviewSession = {
    ...session,
    config: { ...session.config },
    adaptiveModeByWordId: Object.fromEntries(
      Object.entries(session.adaptiveModeByWordId).map(([id, decision]) => [
        id,
        { ...decision },
      ])
    ),
    words: session.words.filter(word => word.user_id === userId).map(copyWord),
  }
  const capturedVocabulary = vocabulary
    .filter(word => word.user_id === userId)
    .map(word => ({
      ...word,
      translations: {
        en: [...word.translations.en],
        ru: word.translations.ru ? [...word.translations.ru] : undefined,
      },
    }))
  const questions: ReviewFlowQuestion<NativeReviewPayload>[] = []
  const iterator = iterateNativeReviewQuestions(
    capturedSession,
    capturedVocabulary,
    userId,
    false
  )
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

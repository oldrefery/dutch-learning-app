import type { ReviewFlowQuestion } from '@woordenaar/domain'
import {
  buildRecognitionOptions,
  groupAdaptiveDecisions,
} from './review-domain'
import type {
  ReviewEventEvidence,
  ReviewSessionMode,
  ReviewWord,
} from './types'

export interface ReviewQuestionPayload {
  word: ReviewWord
  adaptiveMessage: string | null
}

export function prepareReviewQuestions(
  selected: readonly ReviewWord[],
  vocabulary: readonly ReviewWord[],
  events: readonly ReviewEventEvidence[],
  mode: ReviewSessionMode
): ReviewFlowQuestion<ReviewQuestionPayload>[] {
  const decisions = groupAdaptiveDecisions(selected, events)
  return selected.map(word => {
    const configured = mode === 'adaptive' ? decisions[word.id].mode : mode
    const options =
      configured === 'recognition'
        ? buildRecognitionOptions(word, vocabulary)
        : null
    const effective =
      configured === 'recognition' && !options ? 'meaning-recall' : configured
    return {
      id: crypto.randomUUID(),
      wordId: word.id,
      mode: effective,
      options: options ?? [],
      payload: {
        word: {
          ...word,
          translations: JSON.parse(
            JSON.stringify(word.translations)
          ) as ReviewWord['translations'],
        },
        adaptiveMessage:
          mode === 'adaptive' ? `Adaptive challenge: ${effective}.` : null,
      },
    }
  })
}

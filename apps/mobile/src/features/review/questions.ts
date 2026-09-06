import type { ReviewFlowQuestion } from '@woordenaar/domain'
import type { Word } from '@/types/database'
import type { ReviewSession } from '@/types/ReviewTypes'
import {
  buildRecognitionOptions,
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
  const ownedVocabulary = vocabulary.filter(word => word.user_id === userId)
  return session.words
    .filter(word => word.user_id === userId)
    .map((source, index) => {
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
      const options =
        mode === 'recognition'
          ? buildRecognitionOptions(word, ownedVocabulary)
          : null
      if (
        (mode === 'recognition' && !options) ||
        (mode === 'dutch-production' && !translation)
      ) {
        mode = 'meaning-recall'
        explanation =
          'Not enough distinct translations. Using Meaning Recall for this word.'
      }
      return {
        id: `${index}:${word.word_id}`,
        wordId: word.word_id,
        mode,
        options: options ?? [],
        payload: { word, translation, explanation },
      }
    })
}

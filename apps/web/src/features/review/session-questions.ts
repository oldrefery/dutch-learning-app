import type { ReviewFlowQuestion } from '@woordenaar/domain'
import {
  createRecognitionOptionBuilder,
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

export interface ReviewPreparationOptions {
  onProgress?: (completed: number, total: number) => void
  signal?: AbortSignal
  yieldToBrowser?: () => Promise<void>
}

const cloneWord = (word: ReviewWord): ReviewWord => ({
  ...word,
  translations: JSON.parse(
    JSON.stringify(word.translations)
  ) as ReviewWord['translations'],
})

const createQuestion = (
  word: ReviewWord,
  mode: ReviewSessionMode,
  decisionMode: Exclude<ReviewSessionMode, 'adaptive'>,
  buildRecognitionOptions: ReturnType<typeof createRecognitionOptionBuilder>
): ReviewFlowQuestion<ReviewQuestionPayload> => {
  const options =
    decisionMode === 'recognition' ? buildRecognitionOptions(word) : null
  const effective =
    decisionMode === 'recognition' && !options ? 'meaning-recall' : decisionMode

  return {
    id: crypto.randomUUID(),
    wordId: word.id,
    mode: effective,
    options: options ?? [],
    payload: {
      word: cloneWord(word),
      adaptiveMessage:
        mode === 'adaptive' ? `Adaptive challenge: ${effective}.` : null,
    },
  }
}

const throwIfAborted = (signal: AbortSignal | undefined) => {
  if (signal?.aborted) throw signal.reason ?? new Error('Preparation cancelled')
}

const defaultYieldToBrowser = () => {
  const scheduler = (
    globalThis as typeof globalThis & {
      scheduler?: { yield?: () => Promise<void> }
    }
  ).scheduler
  if (scheduler?.yield) return scheduler.yield()
  return new Promise<void>(resolve => window.setTimeout(resolve, 0))
}

export function prepareReviewQuestions(
  selected: readonly ReviewWord[],
  vocabulary: readonly ReviewWord[],
  events: readonly ReviewEventEvidence[],
  mode: ReviewSessionMode
): ReviewFlowQuestion<ReviewQuestionPayload>[] {
  const decisions =
    mode === 'adaptive' ? groupAdaptiveDecisions(selected, events) : null
  const buildRecognitionOptions = createRecognitionOptionBuilder(vocabulary)
  return selected.map(word =>
    createQuestion(
      word,
      mode,
      mode === 'adaptive' ? (decisions?.[word.id].mode ?? 'recognition') : mode,
      buildRecognitionOptions
    )
  )
}

/** Cooperatively prepares complete immutable question snapshots for a web session. */
export async function prepareReviewQuestionsAsync(
  selected: readonly ReviewWord[],
  vocabulary: readonly ReviewWord[],
  events: readonly ReviewEventEvidence[],
  mode: ReviewSessionMode,
  {
    onProgress,
    signal,
    yieldToBrowser = defaultYieldToBrowser,
  }: ReviewPreparationOptions = {}
): Promise<ReviewFlowQuestion<ReviewQuestionPayload>[]> {
  throwIfAborted(signal)
  onProgress?.(0, selected.length)
  // A real task boundary lets the preparing state paint before index construction.
  await yieldToBrowser()
  throwIfAborted(signal)

  const decisions =
    mode === 'adaptive' ? groupAdaptiveDecisions(selected, events) : null
  const buildRecognitionOptions = createRecognitionOptionBuilder(vocabulary)
  const questions: ReviewFlowQuestion<ReviewQuestionPayload>[] = []
  let batchStartedAt = performance.now()

  for (const [index, word] of selected.entries()) {
    throwIfAborted(signal)
    questions.push(
      createQuestion(
        word,
        mode,
        mode === 'adaptive'
          ? (decisions?.[word.id].mode ?? 'recognition')
          : mode,
        buildRecognitionOptions
      )
    )
    onProgress?.(index + 1, selected.length)
    if (
      index + 1 < selected.length &&
      ((index + 1) % 50 === 0 || performance.now() - batchStartedAt >= 8)
    ) {
      await yieldToBrowser()
      throwIfAborted(signal)
      batchStartedAt = performance.now()
    }
  }

  return questions
}

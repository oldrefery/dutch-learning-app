import type { Json } from '@woordenaar/supabase-contracts'
import type {
  AdaptiveReviewModeDecision,
  RecognitionOption,
  ReviewAssessment,
  ReviewEventEvidence,
  ReviewMode,
  ReviewScope,
  ReviewWord,
} from './types'

export const DIFFICULT_EASINESS_FACTOR_THRESHOLD = 2.1
export const MAX_REVIEW_RESPONSE_TIME_MS = 60 * 60 * 1000

const MODE_SEQUENCE: readonly ReviewMode[] = [
  'recognition',
  'meaning-recall',
  'dutch-production',
]

const isJsonRecord = (
  value: Json
): value is { [key: string]: Json | undefined } =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const getTranslationValues = (translations: Json): string[] => {
  if (!isJsonRecord(translations)) return []

  return [translations.en, translations.ru]
    .flatMap(value => (Array.isArray(value) ? value : []))
    .filter((value): value is string => typeof value === 'string')
    .map(value => value.trim())
    .filter(Boolean)
}

const normalizeAnswer = (answer: string) =>
  answer.trim().replace(/\s+/g, ' ').toLocaleLowerCase()

const stableHash = (value: string) => {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

const getLocalDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const isReviewMode = (value: string): value is ReviewMode =>
  MODE_SEQUENCE.includes(value as ReviewMode)

export const isReviewAssessment = (value: string): value is ReviewAssessment =>
  ['again', 'hard', 'good', 'easy'].includes(value)

export const isDueOnLocalDate = (value: string, date = new Date()) => {
  const datePart = value.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) && datePart <= getLocalDate(date)
}

export const selectReviewWords = (
  words: readonly ReviewWord[],
  scope: ReviewScope,
  collectionId: string | null,
  date = new Date()
) =>
  words.filter(word => {
    if (!isDueOnLocalDate(word.nextReviewDate, date)) return false
    if (scope === 'collection-due') return word.collectionId === collectionId
    if (scope === 'difficult-due') {
      return word.easinessFactor <= DIFFICULT_EASINESS_FACTOR_THRESHOLD
    }
    return true
  })

export const getPreferredTranslation = (word: ReviewWord) =>
  getTranslationValues(word.translations)[0] ?? null

export const getDutchProductionAnswer = (word: ReviewWord) =>
  word.partOfSpeech === 'noun' && word.article
    ? `${word.article} ${word.dutchLemma}`
    : word.dutchLemma

export const getReviewAnswer = (word: ReviewWord, mode: ReviewMode) =>
  mode === 'dutch-production'
    ? getDutchProductionAnswer(word)
    : (getPreferredTranslation(word) ?? 'Translation unavailable')

const getTranslationKeys = (word: ReviewWord) =>
  new Set(getTranslationValues(word.translations).map(normalizeAnswer))

export const buildRecognitionOptions = (
  currentWord: ReviewWord,
  vocabulary: readonly ReviewWord[],
  maximumOptions = 4
): RecognitionOption[] | null => {
  const correctLabel = getPreferredTranslation(currentWord)
  if (!correctLabel || maximumOptions < 3) return null

  const currentKeys = getTranslationKeys(currentWord)
  const usedKeys = new Set(currentKeys)
  const candidates = vocabulary
    .filter(word => word.id !== currentWord.id)
    .map(word => ({
      word,
      label: getPreferredTranslation(word),
      keys: getTranslationKeys(word),
    }))
    .filter(
      (candidate): candidate is typeof candidate & { label: string } =>
        Boolean(candidate.label) &&
        ![...candidate.keys].some(key => currentKeys.has(key))
    )
    .sort((left, right) => {
      const leftMatches = left.word.partOfSpeech === currentWord.partOfSpeech
      const rightMatches = right.word.partOfSpeech === currentWord.partOfSpeech
      if (leftMatches !== rightMatches) return leftMatches ? -1 : 1
      return (
        stableHash(`${currentWord.id}:${left.word.id}`) -
          stableHash(`${currentWord.id}:${right.word.id}`) ||
        left.word.id.localeCompare(right.word.id)
      )
    })
    .filter(candidate => {
      if ([...candidate.keys].some(key => usedKeys.has(key))) return false
      candidate.keys.forEach(key => usedKeys.add(key))
      return true
    })
    .slice(0, maximumOptions - 1)

  if (candidates.length < 2) return null

  return [
    { id: currentWord.id, isCorrect: true, label: correctLabel },
    ...candidates.map(candidate => ({
      id: candidate.word.id,
      isCorrect: false,
      label: candidate.label,
    })),
  ].sort(
    (left, right) =>
      stableHash(`${currentWord.id}:option:${left.id}`) -
        stableHash(`${currentWord.id}:option:${right.id}`) ||
      left.id.localeCompare(right.id)
  )
}

const isSuccessfulReview = (event: ReviewEventEvidence) =>
  event.assessment !== 'again' &&
  (event.reviewMode !== 'recognition' || event.answeredCorrectly === true)

export const resolveAdaptiveReviewMode = (
  events: readonly ReviewEventEvidence[]
): AdaptiveReviewModeDecision => {
  let mode: ReviewMode = 'recognition'
  let decision: AdaptiveReviewModeDecision = {
    mode,
    previousMode: null,
    reason: 'default',
  }
  let window: ReviewEventEvidence[] = []

  for (const event of [...events].sort(
    (left, right) =>
      left.reviewedAt.localeCompare(right.reviewedAt) ||
      left.eventId.localeCompare(right.eventId)
  )) {
    if (event.reviewMode !== mode) continue
    window = [...window.slice(-2), event]

    const modeIndex = MODE_SEQUENCE.indexOf(mode)
    const againCount = window.filter(item => item.assessment === 'again').length
    if (modeIndex > 0 && window.length === 3 && againCount >= 2) {
      const previousMode = mode
      mode = MODE_SEQUENCE[modeIndex - 1]
      decision = { mode, previousMode, reason: 'demotion' }
      window = []
      continue
    }

    if (
      modeIndex < MODE_SEQUENCE.length - 1 &&
      window.length === 3 &&
      window.every(isSuccessfulReview)
    ) {
      const previousMode = mode
      mode = MODE_SEQUENCE[modeIndex + 1]
      decision = { mode, previousMode, reason: 'promotion' }
      window = []
    }
  }

  return decision
}

export const groupAdaptiveDecisions = (
  words: readonly ReviewWord[],
  events: readonly ReviewEventEvidence[]
) => {
  const eventsByWord = new Map<string, ReviewEventEvidence[]>()
  for (const event of events) {
    const wordEvents = eventsByWord.get(event.wordId) ?? []
    if (wordEvents.length < 100) wordEvents.push(event)
    eventsByWord.set(event.wordId, wordEvents)
  }

  return Object.fromEntries(
    words.map(word => [
      word.id,
      resolveAdaptiveReviewMode(eventsByWord.get(word.id) ?? []),
    ])
  )
}

export const getLocalReviewDate = () => getLocalDate(new Date())

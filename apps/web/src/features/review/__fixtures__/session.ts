import type {
  ReviewSubmissionResult,
  ReviewWord,
  ReviewWorkspaceData,
} from '../types'

export const makeWord = (
  id: string,
  translation: string,
  overrides: Partial<ReviewWord> = {}
): ReviewWord => ({
  article: null,
  collectionId: 'collection-1',
  dutchLemma: `woord-${id}`,
  dutchOriginal: null,
  easinessFactor: 2.5,
  id,
  imageUrl: null,
  intervalDays: 0,
  lastReviewedAt: null,
  nextReviewDate: '2020-01-01',
  partOfSpeech: 'noun',
  repetitionCount: 0,
  translations: { en: [translation] },
  ttsUrl: null,
  ...overrides,
})
export const makeData = (
  words: ReviewWord[] = ['house', 'tree', 'street', 'book'].map(
    (label, index) => makeWord(`word-${index + 1}`, label)
  )
): ReviewWorkspaceData => ({
  collections: [{ id: 'collection-1', name: 'Test collection' }],
  events: [],
  words,
})
export const successfulResult = (
  wordId: string
): Extract<ReviewSubmissionResult, { status: 'success' }> => ({
  status: 'success',
  update: {
    easinessFactor: 2.5,
    intervalDays: 1,
    lastReviewedAt: '2026-09-06T12:00:00.000Z',
    nextReviewDate: '2026-09-07',
    repetitionCount: 1,
    wordId,
  },
})

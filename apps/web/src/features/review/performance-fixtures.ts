import type { ReviewWord, ReviewWorkspaceData } from './types'

export const createPerformanceWorkspace = (
  wordCount: number
): ReviewWorkspaceData => ({
  collections: [{ id: 'performance-collection', name: 'Performance fixture' }],
  events: [],
  words: Array.from({ length: wordCount }, (_, index): ReviewWord => ({
    article: index % 3 === 0 ? 'de' : null,
    collectionId: 'performance-collection',
    dutchLemma: `woord-${String(index).padStart(5, '0')}`,
    dutchOriginal: null,
    easinessFactor: index % 7 === 0 ? 2.1 : 2.5,
    id: `performance-word-${index}`,
    imageUrl: null,
    intervalDays: index % 6,
    lastReviewedAt: null,
    nextReviewDate: '2026-09-12',
    partOfSpeech: index % 2 === 0 ? 'noun' : 'verb',
    repetitionCount: index % 4,
    translations: { en: [`meaning-${index}`], ru: [`значение-${index}`] },
    ttsUrl: null,
  })),
})

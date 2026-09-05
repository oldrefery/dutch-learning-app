import { act, renderHook } from '@testing-library/react'
import { submitReviewAssessment } from './actions'
import type {
  ReviewSubmissionResult,
  ReviewWord,
  ReviewWorkspaceData,
} from './types'
import { useReviewSession } from './useReviewSession'

jest.mock('./actions', () => ({
  submitReviewAssessment: jest.fn(),
}))

const mockSubmitReviewAssessment = jest.mocked(submitReviewAssessment)

const makeWord = (
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

const makeData = (words: ReviewWord[]): ReviewWorkspaceData => ({
  collections: [{ id: 'collection-1', name: 'Test collection' }],
  events: [],
  words,
})

const successfulResult = (
  wordId: string
): Extract<ReviewSubmissionResult, { status: 'success' }> => ({
  status: 'success',
  update: {
    easinessFactor: 2.6,
    intervalDays: 1,
    lastReviewedAt: '2026-09-04T12:00:00.000Z',
    nextReviewDate: '2026-09-05',
    repetitionCount: 1,
    wordId,
  },
})

describe('useReviewSession', () => {
  beforeEach(() => {
    mockSubmitReviewAssessment.mockReset()
  })

  test('completes a session and applies the returned SRS update', async () => {
    const word = makeWord('word-1', 'house')
    mockSubmitReviewAssessment.mockResolvedValue(successfulResult(word.id))
    const { result } = renderHook(() =>
      useReviewSession(makeData([word]), 'all-due', null, 'meaning-recall')
    )

    expect(result.current.stage).toBe('setup')
    expect(result.current.dueCount).toBe(1)

    act(() => result.current.start())
    expect(result.current.stage).toBe('review')
    expect(result.current.currentWord?.id).toBe(word.id)

    await act(async () => result.current.submit('good'))

    expect(result.current.stage).toBe('complete')
    expect(result.current.assessmentCounts.good).toBe(1)
    expect(result.current.sessionWords[0]).toMatchObject({
      easinessFactor: 2.6,
      intervalDays: 1,
      nextReviewDate: '2026-09-05',
      repetitionCount: 1,
    })
    expect(mockSubmitReviewAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        answeredCorrectly: null,
        assessment: 'good',
        reviewMode: 'meaning-recall',
        wordId: word.id,
      })
    )
  })

  test('keeps a failed submission retryable with the same event id', async () => {
    const word = makeWord('word-1', 'house')
    mockSubmitReviewAssessment.mockResolvedValueOnce({
      status: 'error',
      message: 'Could not persist review.',
    })
    const { result } = renderHook(() =>
      useReviewSession(makeData([word]), 'all-due', null, 'meaning-recall')
    )

    act(() => result.current.start())
    await act(async () => result.current.submit('easy'))

    expect(result.current.error).toBe('Could not persist review.')
    expect(result.current.stage).toBe('review')
    const firstInput = mockSubmitReviewAssessment.mock.calls[0][0]

    mockSubmitReviewAssessment.mockResolvedValueOnce(successfulResult(word.id))
    await act(async () => result.current.submit('easy'))

    expect(mockSubmitReviewAssessment.mock.calls[1][0].eventId).toBe(
      firstInput.eventId
    )
    expect(result.current.stage).toBe('complete')
  })

  test('records whether a selected recognition option was correct', async () => {
    const words = [
      makeWord('word-1', 'house'),
      makeWord('word-2', 'tree'),
      makeWord('word-3', 'street'),
      makeWord('word-4', 'book'),
    ]
    mockSubmitReviewAssessment.mockResolvedValue(successfulResult('word-1'))
    const { result } = renderHook(() =>
      useReviewSession(makeData(words), 'all-due', null, 'recognition')
    )

    act(() => result.current.start())
    const correctOption = result.current.recognitionOptions?.find(
      option => option.isCorrect
    )
    if (!correctOption) throw new Error('Expected a correct recognition option')

    act(() => result.current.selectOption(correctOption))
    await act(async () => result.current.submit('good'))

    expect(mockSubmitReviewAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        answeredCorrectly: true,
        reviewMode: 'recognition',
      })
    )
    expect(result.current.currentIndex).toBe(1)
  })

  test('reports an empty scope without entering review', () => {
    const futureWord = makeWord('word-1', 'house', {
      nextReviewDate: '2999-01-01',
    })
    const { result } = renderHook(() =>
      useReviewSession(makeData([futureWord]), 'all-due', null)
    )

    act(() => result.current.start())

    expect(result.current.stage).toBe('setup')
    expect(result.current.emptyMessage).toBe(
      'No words are due in this scope. Try another scope.'
    )
  })
})

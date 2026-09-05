import { act, renderHook, waitFor } from '@testing-library/react-native'
import { createMockWord } from '@/__tests__/helpers/factories'
import { REVIEW_MODE, REVIEW_SCOPE } from '@/constants/ReviewConstants'
import { useReviewScreen } from '../useReviewScreen'
import { useApplicationStore } from '@/stores/useApplicationStore'
import type { ReviewSession } from '@/types/ReviewTypes'

jest.mock('@/hooks/useAudioPlayer', () => ({
  useAudioPlayer: () => ({
    playAudio: jest.fn(),
    isPlaying: false,
  }),
}))

const firstWord = createMockWord({
  word_id: 'first-word',
  dutch_lemma: 'huis',
})
const secondWord = createMockWord({
  word_id: 'second-word',
  dutch_lemma: 'tafel',
})

const createSession = (
  mode: ReviewSession['config']['mode'],
  currentIndex = 0
): ReviewSession => ({
  words: [firstWord, secondWord],
  currentIndex,
  completedCount: currentIndex,
  config: { mode, scope: REVIEW_SCOPE.ALL_DUE },
  adaptiveModeByWordId: {},
})

describe('useReviewScreen', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  beforeEach(() => {
    useApplicationStore.setState({
      words: [firstWord, secondWord],
      reviewSession: createSession(REVIEW_MODE.MEANING_RECALL),
      currentWord: firstWord,
      reviewLoading: false,
    })
  })

  it('resets reveal state when the current word changes', async () => {
    const { result } = renderHook(() => useReviewScreen())

    act(() => result.current.revealAnswer())
    expect(result.current.isFlipped).toBe(true)

    act(() => {
      useApplicationStore.setState({
        reviewSession: createSession(REVIEW_MODE.MEANING_RECALL, 1),
        currentWord: secondWord,
      })
    })

    await waitFor(() => expect(result.current.isFlipped).toBe(false))
  })

  it('resets reveal state when the session mode changes', async () => {
    const { result } = renderHook(() => useReviewScreen())

    act(() => result.current.revealAnswer())

    act(() => {
      useApplicationStore.setState({
        reviewSession: createSession(REVIEW_MODE.DUTCH_PRODUCTION),
      })
    })

    await waitFor(() => expect(result.current.isFlipped).toBe(false))
  })

  it('records response time with the submitted assessment', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-28T12:00:00.000Z'))
    const submitReviewAssessment = jest.fn().mockResolvedValue(undefined)
    useApplicationStore.setState({ submitReviewAssessment })
    const { result } = renderHook(() => useReviewScreen())

    act(() => {
      jest.setSystemTime(new Date('2026-08-28T12:00:01.250Z'))
      result.current.revealAnswer()
    })

    await act(async () => {
      jest.setSystemTime(new Date('2026-08-28T12:00:03.000Z'))
      await result.current.handleGood({
        reviewMode: REVIEW_MODE.RECOGNITION,
        answeredCorrectly: true,
      })
    })

    expect(submitReviewAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        responseTime: 1250,
        reviewMode: REVIEW_MODE.RECOGNITION,
        answeredCorrectly: true,
      })
    )
  })

  it('keeps the completed session summary after the store clears it', async () => {
    const { result } = renderHook(() => useReviewScreen())

    act(() => {
      useApplicationStore.setState({
        reviewSession: null,
        currentWord: null,
      })
    })

    await waitFor(() => expect(result.current.sessionComplete).toBe(true))
    expect(result.current.reviewWords).toHaveLength(2)
    expect(result.current.totalWords).toBe(2)
  })
  it('clears the previous summary when choosing another mode', () => {
    const endReviewSession = jest.fn(() => {
      useApplicationStore.setState({ reviewSession: null, currentWord: null })
    })
    useApplicationStore.setState({ endReviewSession })
    const { result } = renderHook(() => useReviewScreen())
    act(() => result.current.chooseAnotherMode())
    expect(result.current.sessionComplete).toBe(false)
    expect(result.current.reviewWords).toEqual([])
  })

  it('starts timing the next word again after revealing the previous word', async () => {
    jest.useFakeTimers().setSystemTime(1000)
    const submitReviewAssessment = jest.fn().mockResolvedValue(undefined)
    useApplicationStore.setState({ submitReviewAssessment })
    const { result } = renderHook(() => useReviewScreen())
    act(() => {
      jest.setSystemTime(2500)
      result.current.revealAnswer()
    })
    act(() => {
      jest.setSystemTime(5000)
      useApplicationStore.setState({
        reviewSession: createSession(REVIEW_MODE.MEANING_RECALL, 1),
        currentWord: secondWord,
      })
    })
    await act(async () => {
      jest.setSystemTime(5700)
      await result.current.handleGood()
    })
    expect(submitReviewAssessment).toHaveBeenCalledWith(
      expect.objectContaining({
        wordId: secondWord.word_id,
        responseTime: 700,
      })
    )
  })
})

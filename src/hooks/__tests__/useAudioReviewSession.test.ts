import { act, renderHook, waitFor } from '@testing-library/react-native'
import { AccessibilityInfo, AppState, type AppStateStatus } from 'react-native'
import * as Haptics from 'expo-haptics'
import { createMockWord } from '@/__tests__/helpers/factories'
import { REVIEW_MODE, REVIEW_SCOPE } from '@/constants/ReviewConstants'
import { useAudio } from '@/contexts/AudioContext'
import { useAudioReviewSession } from '@/hooks/useAudioReviewSession'
import { useReviewScreen } from '@/hooks/useReviewScreen'
import type { ReviewSession } from '@/types/ReviewTypes'

jest.mock('@/contexts/AudioContext')
jest.mock('@/hooks/useReviewScreen')
jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  impactAsync: jest.fn().mockResolvedValue(undefined),
  selectionAsync: jest.fn().mockResolvedValue(undefined),
}))

const mockUseAudio = useAudio as jest.MockedFunction<typeof useAudio>
const mockUseReviewScreen = useReviewScreen as jest.MockedFunction<
  typeof useReviewScreen
>
const AUDIO_URL = 'https://audio.example/huis.mp3'

const word = createMockWord({
  word_id: 'audio-word',
  dutch_lemma: 'huis',
  tts_url: AUDIO_URL,
  translations: { en: ['house'] },
})

const reviewSession: ReviewSession = {
  words: [word],
  currentIndex: 0,
  completedCount: 0,
  config: {
    mode: REVIEW_MODE.MEANING_RECALL,
    scope: REVIEW_SCOPE.ALL_DUE,
  },
  adaptiveModeByWordId: {},
}

const playWord = jest.fn().mockResolvedValue(undefined)
const pauseAudio = jest.fn()
const resumeAudio = jest.fn()
const stopAudio = jest.fn().mockResolvedValue(undefined)
const startSession = jest.fn().mockResolvedValue(true)
const revealAnswer = jest.fn()
const handleAgain = jest.fn().mockResolvedValue(undefined)
const handleGood = jest.fn().mockResolvedValue(undefined)
const chooseAnotherMode = jest.fn()

const createReviewState = (
  overrides: Partial<ReturnType<typeof useReviewScreen>> = {}
): ReturnType<typeof useReviewScreen> =>
  ({
    reviewSession,
    currentWord: word,
    currentIndex: 0,
    sessionComplete: false,
    reviewWords: [word],
    availableWords: [word],
    totalWords: 1,
    currentWordNumber: 1,
    isLoading: false,
    isFlipped: false,
    isPlayingAudio: false,
    sessionEmpty: false,
    playAudio: jest.fn(),
    handleCorrect: jest.fn(),
    handleIncorrect: jest.fn(),
    handleAgain,
    handleHard: jest.fn(),
    handleGood,
    handleEasy: jest.fn(),
    handleDeleteWord: jest.fn(),
    handleEndSession: jest.fn(),
    handleImageChange: jest.fn(),
    startSession,
    restartSession: jest.fn(),
    chooseAnotherMode,
    handleFlipCard: jest.fn(),
    revealAnswer,
    goToNextWord: jest.fn(),
    goToPreviousWord: jest.fn(),
    ...overrides,
  }) as ReturnType<typeof useReviewScreen>

describe('useAudioReviewSession', () => {
  let appStateHandler: ((state: AppStateStatus) => void) | null

  beforeEach(() => {
    jest.clearAllMocks()
    appStateHandler = null

    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_type, listener) => {
        appStateHandler = listener
        return { remove: jest.fn() }
      })
    jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(jest.fn())

    mockUseAudio.mockReturnValue({
      playWord,
      pauseAudio,
      resumeAudio,
      stopAudio,
      isPlaying: false,
      currentWord: null,
    })
    mockUseReviewScreen.mockReturnValue(createReviewState())
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('plays the Dutch prompt automatically and stops audio on unmount', async () => {
    const { unmount } = renderHook(() => useAudioReviewSession())

    await waitFor(() =>
      expect(playWord).toHaveBeenCalledWith('huis', AUDIO_URL)
    )

    unmount()

    expect(stopAudio).toHaveBeenCalled()
  })

  it('starts a Meaning Recall session when no session exists', async () => {
    mockUseReviewScreen.mockReturnValue(
      createReviewState({
        reviewSession: null,
        currentWord: null,
        totalWords: 0,
        currentWordNumber: 1,
      })
    )

    renderHook(() => useAudioReviewSession())

    await waitFor(() =>
      expect(startSession).toHaveBeenCalledWith({
        mode: REVIEW_MODE.MEANING_RECALL,
        scope: REVIEW_SCOPE.ALL_DUE,
      })
    )
  })

  it('reveals and announces the answer before replaying Dutch audio', async () => {
    const { result } = renderHook(() => useAudioReviewSession())
    playWord.mockClear()

    await act(async () => {
      await result.current.revealAnswer()
    })

    expect(revealAnswer).toHaveBeenCalledTimes(1)
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Answer: house'
    )
    expect(playWord).toHaveBeenCalledWith('huis', AUDIO_URL)
    expect(Haptics.selectionAsync).toHaveBeenCalled()
  })

  it('prevents duplicate rapid assessments for one card', async () => {
    let resolveAssessment: (() => void) | null = null
    handleGood.mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          resolveAssessment = resolve
        })
    )
    mockUseReviewScreen.mockReturnValue(createReviewState({ isFlipped: true }))
    const { result } = renderHook(() => useAudioReviewSession())

    let firstSubmission: Promise<void> | undefined
    act(() => {
      firstSubmission = result.current.submitGood()
      void result.current.submitGood()
    })

    expect(handleGood).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveAssessment?.()
      await firstSubmission
    })
  })

  it('stops playback and exposes a recoverable paused state in background', () => {
    const { result } = renderHook(() => useAudioReviewSession())

    act(() => {
      appStateHandler?.('background')
    })

    expect(stopAudio).toHaveBeenCalled()
    expect(result.current.isPaused).toBe(true)

    act(() => {
      result.current.togglePause()
    })

    expect(resumeAudio).toHaveBeenCalled()
    expect(result.current.isPaused).toBe(false)
  })
})

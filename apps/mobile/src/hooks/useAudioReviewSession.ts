import { useCallback, useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, AppState, type AppStateStatus } from 'react-native'
import * as Haptics from 'expo-haptics'
import { useAudio } from '@/contexts/AudioContext'
import { REVIEW_MODE, REVIEW_SCOPE } from '@/constants/ReviewConstants'
import { useReviewScreen } from '@/hooks/useReviewScreen'
import type { ReviewAssessment } from '@/types/ApplicationStoreTypes'
import { getPreferredTranslation } from '@/utils/reviewDistractors'

const AUDIO_REVIEW_CONFIG = {
  mode: REVIEW_MODE.MEANING_RECALL,
  scope: REVIEW_SCOPE.ALL_DUE,
} as const

type AudioReviewAssessment = Pick<
  ReviewAssessment,
  'reviewMode' | 'answeredCorrectly'
>

const AUDIO_REVIEW_ASSESSMENT: AudioReviewAssessment = {
  reviewMode: REVIEW_MODE.MEANING_RECALL,
  answeredCorrectly: null,
}

export function useAudioReviewSession() {
  const {
    reviewSession,
    currentWord,
    currentWordNumber,
    totalWords,
    isFlipped,
    isPlayingAudio,
    isLoading,
    sessionEmpty,
    sessionComplete,
    startSession,
    revealAnswer: revealReviewAnswer,
    handleAgain,
    handleGood,
    chooseAnotherMode,
  } = useReviewScreen()
  const { pauseAudio, playWord, resumeAudio, stopAudio } = useAudio()
  const [isStarting, setIsStarting] = useState(!reviewSession)
  const [isPaused, setIsPaused] = useState(false)
  const [isAssessing, setIsAssessing] = useState(false)
  const startedRef = useRef(false)
  const mountedRef = useRef(true)
  const assessmentInFlightRef = useRef(false)

  const wordId = currentWord?.word_id
  const [previousWordId, setPreviousWordId] = useState(wordId)
  if (previousWordId !== wordId) {
    setPreviousWordId(wordId)
    setIsPaused(false)
  }

  const preferredTranslation = currentWord
    ? getPreferredTranslation(currentWord)
    : null

  const dutchLemma = currentWord?.dutch_lemma
  const ttsUrl = currentWord?.tts_url
  const playCurrentWord = useCallback(async () => {
    if (!dutchLemma) return
    await playWord(dutchLemma, ttsUrl)
  }, [dutchLemma, ttsUrl, playWord])

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    if (reviewSession) return

    const start = async () => {
      try {
        await startSession(AUDIO_REVIEW_CONFIG)
      } finally {
        if (mountedRef.current) {
          setIsStarting(false)
        }
      }
    }

    void start()
  }, [reviewSession, startSession])

  useEffect(() => {
    if (currentWord?.word_id) {
      void playCurrentWord()
    }
  }, [currentWord?.word_id, playCurrentWord])

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') return

      setIsPaused(true)
      void stopAudio()
    }

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange
    )

    return () => {
      mountedRef.current = false
      subscription.remove()
      void stopAudio()
    }
  }, [stopAudio])

  const revealAnswer = useCallback(async () => {
    if (!currentWord) return

    if (!isFlipped) {
      revealReviewAnswer()
    }

    if (preferredTranslation) {
      AccessibilityInfo.announceForAccessibility(
        `Answer: ${preferredTranslation}`
      )
    }

    void Haptics.selectionAsync().catch(() => undefined)
    setIsPaused(false)
    await playCurrentWord()
  }, [
    currentWord,
    playCurrentWord,
    preferredTranslation,
    isFlipped,
    revealReviewAnswer,
  ])

  const replayPrompt = useCallback(async () => {
    void Haptics.selectionAsync().catch(() => undefined)
    setIsPaused(false)
    await playCurrentWord()
  }, [playCurrentWord])

  const togglePause = useCallback(() => {
    if (isPaused) {
      resumeAudio()
      setIsPaused(false)
      return
    }

    pauseAudio()
    setIsPaused(true)
  }, [isPaused, pauseAudio, resumeAudio])

  const submitAssessment = useCallback(
    async (
      submit: (context?: AudioReviewAssessment) => void | Promise<void>
    ) => {
      if (!isFlipped || assessmentInFlightRef.current || !currentWord) {
        return
      }

      assessmentInFlightRef.current = true
      setIsAssessing(true)

      try {
        await submit(AUDIO_REVIEW_ASSESSMENT)
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
          () => undefined
        )
      } finally {
        assessmentInFlightRef.current = false
        if (mountedRef.current) {
          setIsAssessing(false)
        }
      }
    },
    [currentWord, isFlipped]
  )

  const submitAgain = useCallback(
    () => submitAssessment(handleAgain),
    [handleAgain, submitAssessment]
  )

  const submitGood = useCallback(
    () => submitAssessment(handleGood),
    [handleGood, submitAssessment]
  )

  const exitSession = useCallback(async () => {
    await stopAudio()
    chooseAnotherMode()
  }, [chooseAnotherMode, stopAudio])

  return {
    currentWord,
    preferredTranslation,
    currentWordNumber,
    totalWords,
    isRevealed: isFlipped,
    isPlaying: isPlayingAudio,
    isStarting: isStarting || isLoading,
    isPaused,
    isAssessing,
    sessionEmpty,
    sessionComplete,
    revealAnswer,
    replayPrompt,
    togglePause,
    submitAgain,
    submitGood,
    exitSession,
  }
}

import { useState, useEffect, useCallback, useRef } from 'react'
import * as Haptics from 'expo-haptics'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { SRS_ASSESSMENT } from '@/constants/SRSConstants'
import { Sentry } from '@/lib/sentry'
import type { ReviewSession, ReviewSessionConfig } from '@/types/ReviewTypes'
import type { ReviewAssessment } from '@/types/ApplicationStoreTypes'

type ReviewAssessmentContext = Pick<
  ReviewAssessment,
  'reviewMode' | 'answeredCorrectly'
>

export const useReviewScreen = () => {
  const {
    reviewSession,
    currentWord,
    words,
    endReviewSession,
    deleteWord,
    deleteWordFromReview,
    startReviewSession,
    reviewLoading,
    goToNextWord,
    goToPreviousWord,
    updateCurrentWordImage,
  } = useApplicationStore()

  const { playAudio, isPlaying: isPlayingAudio } = useAudioPlayer()
  const [isFlipped, setIsFlipped] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [lastTouchTime, setLastTouchTime] = useState(0)
  const [sessionEmpty, setSessionEmpty] = useState(false)
  const [completedSession, setCompletedSession] =
    useState<ReviewSession | null>(null)
  const isMountedRef = useRef(true)
  const [previousReviewSession, setPreviousReviewSession] =
    useState<ReviewSession | null>(reviewSession)
  const responseStartedAtRef = useRef(0)
  const responseTimeRef = useRef<number | null>(null)

  // Cleanup on unmounting
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const [observedSession, setObservedSession] = useState(reviewSession)
  if (reviewSession !== observedSession) {
    setObservedSession(reviewSession)
  }
  if (reviewSession !== observedSession && reviewSession) {
    setPreviousReviewSession(reviewSession)
    setCompletedSession(null)
    setSessionEmpty(false)
  } else if (
    !reviewSession &&
    !currentWord &&
    previousReviewSession &&
    !sessionEmpty
  ) {
    setCompletedSession(previousReviewSession)
    setPreviousReviewSession(null)
  }

  const wordId = currentWord?.word_id
  const mode = reviewSession?.config.mode
  const [responseKey, setResponseKey] = useState({ wordId, mode })
  if (responseKey.wordId !== wordId || responseKey.mode !== mode) {
    setResponseKey({ wordId, mode })
    setIsFlipped(false)
    setLastTouchTime(0)
  }

  useEffect(() => {
    responseStartedAtRef.current = Date.now()
    responseTimeRef.current = null
  }, [wordId, mode])

  const recordResponseTime = useCallback(() => {
    if (responseTimeRef.current === null) {
      responseTimeRef.current = Math.max(
        0,
        Date.now() - responseStartedAtRef.current
      )
    }
  }, [])

  const handlePlayAudio = useCallback(
    (url?: string) => {
      if (!currentWord?.dutch_lemma) return
      playAudio(url, currentWord.dutch_lemma, currentWord.tts_url)
    },
    [playAudio, currentWord]
  )

  const handleAssessment = useCallback(
    async (
      assessment: keyof typeof SRS_ASSESSMENT,
      context: ReviewAssessmentContext = {}
    ) => {
      if (!currentWord) return

      setIsLoading(true)
      try {
        // Get the store actions
        const store = useApplicationStore.getState()

        // Call submitReviewAssessment directly with the correct assessment
        await store.submitReviewAssessment({
          wordId: currentWord.word_id,
          assessment: SRS_ASSESSMENT[assessment],
          ...context,
          responseTime:
            responseTimeRef.current ??
            Math.max(0, Date.now() - responseStartedAtRef.current),
          timestamp: new Date(),
        })

        // No toast for 'again' - it's a normal retry, not an error
      } catch (error) {
        Sentry.captureException(error, {
          tags: { operation: 'handleAssessment' },
          extra: { message: 'Assessment error', assessment },
        })
        ToastService.show('Failed to submit assessment', ToastType.ERROR)
      } finally {
        // Check if the component is still mounted before updating the state
        try {
          setIsLoading(false)
        } catch (stateError) {
          Sentry.captureException(stateError, {
            tags: { operation: 'handleAssessment' },
            extra: { message: 'Component unmounted during assessment' },
          })
        }
      }
    },
    [currentWord]
  )

  const handleAgain = useCallback(
    (context?: ReviewAssessmentContext) => handleAssessment('AGAIN', context),
    [handleAssessment]
  )
  const handleHard = useCallback(
    (context?: ReviewAssessmentContext) => handleAssessment('HARD', context),
    [handleAssessment]
  )
  const handleGood = useCallback(
    (context?: ReviewAssessmentContext) => handleAssessment('GOOD', context),
    [handleAssessment]
  )
  const handleEasy = useCallback(
    (context?: ReviewAssessmentContext) => handleAssessment('EASY', context),
    [handleAssessment]
  )

  // Keep old functions for compatibility
  const handleCorrect = handleGood
  const handleIncorrect = handleAgain

  const handleDeleteWord = useCallback(async () => {
    if (!currentWord) return

    try {
      // Strongest haptic feedback for destructive action
      // Note: Don't await - haptics can crash if called on the wrong thread
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {
          // Ignore haptic errors - they're not critical
        }
      )

      // Delete word from the database and global state
      await deleteWord(currentWord.word_id)

      deleteWordFromReview(currentWord.word_id)

      setIsFlipped(false)

      ToastService.show('Word deleted', ToastType.SUCCESS)
    } catch {
      ToastService.show('Failed to delete word', ToastType.ERROR)
    }
  }, [currentWord, deleteWord, deleteWordFromReview])

  const handleEndSession = useCallback(() => {
    endReviewSession()
    ToastService.show('Great job! Review session finished.', ToastType.SUCCESS)
  }, [endReviewSession])

  const handleImageChange = useCallback(
    async (imageUrl: string) => {
      if (!currentWord) return

      try {
        const store = useApplicationStore.getState()
        // Update in database
        await store.updateWordImage(currentWord.word_id, imageUrl)
        // Update in the current review session
        updateCurrentWordImage(imageUrl)
        ToastService.show('Image updated', ToastType.SUCCESS)
      } catch {
        ToastService.show('Failed to update image', ToastType.ERROR)
      }
    },
    [currentWord, updateCurrentWordImage]
  )

  const startSession = useCallback(
    async (config: ReviewSessionConfig) => {
      setPreviousReviewSession(null)
      setCompletedSession(null)
      setSessionEmpty(false)
      await startReviewSession(config)

      const nextSession = useApplicationStore.getState().reviewSession
      if (!nextSession && isMountedRef.current) {
        setSessionEmpty(true)
      }

      return Boolean(nextSession)
    },
    [startReviewSession]
  )

  const restartSession = useCallback(() => {
    const config =
      reviewSession?.config ??
      completedSession?.config ??
      previousReviewSession?.config

    if (config) {
      void startSession(config)
    }
  }, [
    completedSession?.config,
    reviewSession?.config,
    previousReviewSession?.config,
    startSession,
  ])

  const chooseAnotherMode = useCallback(() => {
    setPreviousReviewSession(null)
    setCompletedSession(null)
    setSessionEmpty(false)
    endReviewSession()
  }, [endReviewSession])

  // Simple flip function for external use
  const handleFlipCard = useCallback(() => {
    if (isMountedRef.current) {
      const now = Date.now()
      if (now - lastTouchTime < 300) {
        return
      }
      if (!isFlipped) {
        recordResponseTime()
      }
      setLastTouchTime(now)
      setIsFlipped(prev => !prev)
    }
  }, [isFlipped, lastTouchTime, recordResponseTime])

  const revealAnswer = useCallback(() => {
    recordResponseTime()
    setIsFlipped(true)
  }, [recordResponseTime])

  const sessionComplete = completedSession !== null
  const lastCompletedSession = completedSession
  const reviewWords = reviewSession?.words ?? lastCompletedSession?.words ?? []
  const currentIndex = reviewSession?.currentIndex || 0
  const totalWords = reviewWords.length
  const currentWordNumber = currentIndex + 1

  return {
    // State from useReviewSession compatibility
    reviewSession,
    currentWord,
    currentIndex,
    sessionComplete,
    reviewWords,
    availableWords: words,
    totalWords,
    currentWordNumber,
    isLoading: isLoading || reviewLoading,

    // useReviewScreen specific state
    isFlipped,
    isPlayingAudio,
    sessionEmpty,

    // Actions
    playAudio: handlePlayAudio,
    handleCorrect,
    handleIncorrect,
    handleAgain,
    handleHard,
    handleGood,
    handleEasy,
    handleDeleteWord,
    handleEndSession,
    handleImageChange,
    startSession,
    restartSession,
    chooseAnotherMode,
    handleFlipCard,
    revealAnswer,
    goToNextWord,
    goToPreviousWord,
  }
}

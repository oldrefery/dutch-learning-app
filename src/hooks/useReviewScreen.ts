import { useState, useEffect, useCallback } from 'react'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useAudioPlayer } from '@/hooks/useAudioPlayer'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import {
  Gesture,
  PanGestureHandlerEventPayload,
} from 'react-native-gesture-handler'
import { scheduleOnRN } from 'react-native-worklets'
import { SRS_ASSESSMENT } from '@/constants/SRSConstants'

export const useReviewScreen = () => {
  const {
    reviewSession,
    currentWord,
    flipCard,
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
  const [isScrolling] = useState(false)

  // Start review session when component mounts - only once
  useEffect(() => {
    startReviewSession()
  }, []) // Remove startReviewSession from deps to prevent infinite loop

  // Reset card state when the word changes
  useEffect(() => {
    setIsFlipped(false)
  }, [currentWord?.word_id])

  const handlePlayAudio = useCallback(
    (url?: string) => {
      if (!currentWord?.dutch_lemma) return
      playAudio(url, currentWord.dutch_lemma, currentWord.tts_url)
    },
    [playAudio, currentWord?.dutch_lemma, currentWord?.tts_url]
  )

  const handleAssessment = useCallback(
    async (assessment: keyof typeof SRS_ASSESSMENT) => {
      if (!currentWord) return

      setIsLoading(true)
      try {
        // Get the store actions
        const store = useApplicationStore.getState()

        // Call submitReviewAssessment directly with the correct assessment
        await store.submitReviewAssessment({
          wordId: currentWord.word_id,
          assessment: SRS_ASSESSMENT[assessment],
          timestamp: new Date(),
        })

        // No toast for 'again' - it's a normal retry, not an error
      } catch (error) {
        console.error('Assessment error:', error)
        ToastService.show('Failed to mark as incorrect', ToastType.ERROR)
      } finally {
        setIsLoading(false)
      }
    },
    [currentWord]
  )

  const handleAgain = useCallback(
    () => handleAssessment('AGAIN'),
    [handleAssessment]
  )
  const handleHard = useCallback(
    () => handleAssessment('HARD'),
    [handleAssessment]
  )
  const handleGood = useCallback(
    () => handleAssessment('GOOD'),
    [handleAssessment]
  )
  const handleEasy = useCallback(
    () => handleAssessment('EASY'),
    [handleAssessment]
  )

  // Keep old functions for compatibility
  const handleCorrect = handleGood
  const handleIncorrect = handleAgain

  const handleDeleteWord = useCallback(async () => {
    if (!currentWord) return

    try {
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

  const restartSession = useCallback(() => {
    // TODO: Implement restartSession in store
    // For now, just show a message
    ToastService.show(
      'Session restart functionality coming soon',
      ToastType.INFO
    )
  }, [])

  // Create a tap gesture for card flip - remove dependencies to prevent recreation
  const tapGesture = useCallback(() => {
    return Gesture.Tap()
      .maxDuration(200) // Very short tap duration
      .maxDistance(5) // Very small movement allowed
      .onBegin(() => {
        'worklet'
        console.log('🟢 TAP GESTURE: onBegin triggered')
      })
      .onStart(() => {
        'worklet'
        console.log('🟡 TAP GESTURE: onStart triggered')
      })
      .onEnd(() => {
        'worklet'
        try {
          console.log('🔴 TAP GESTURE: onEnd triggered')
          scheduleOnRN(() => {
            const now = Date.now()
            if (now - lastTouchTime < 300) {
              console.log('❌ TAP GESTURE: Prevented double tap')
              return
            }

            console.log('✅ TAP GESTURE: Flipping card')
            setLastTouchTime(now)
            flipCard()
            setIsFlipped(prev => !prev)
          })
        } catch (error) {
          console.log('💥 TAP GESTURE: Error occurred:', error)
        }
      })
  }, [flipCard])

  // Create a double tap gesture for word detail
  const doubleTapGesture = useCallback(() => {
    return Gesture.Tap()
      .numberOfTaps(2)
      .maxDuration(400)
      .maxDistance(10)
      .onEnd(() => {
        'worklet'
        if (!isScrolling) {
          // This will be handled by the parent component
          // We'll pass a callback function
        }
      })
  }, [isScrolling])

  // Create a pan gesture for swipe navigation - remove isFlipped dependency
  const panGesture = useCallback(() => {
    return Gesture.Pan()
      .minDistance(20) // Minimum distance to start pan (higher than tap maxDistance)
      .onEnd((event: PanGestureHandlerEventPayload) => {
        'worklet'
        const swipeThreshold = 50

        // Only handle navigation if it's a significant swipe
        if (Math.abs(event.translationX) > swipeThreshold) {
          if (event.translationX < -swipeThreshold) {
            // Swipe left - go to the next word
            scheduleOnRN(goToNextWord)
          } else if (event.translationX > swipeThreshold) {
            // Swipe right - go to the previous word
            scheduleOnRN(goToPreviousWord)
          }
        }
      })
  }, [goToNextWord, goToPreviousWord])

  const reviewWords = reviewSession?.words || []
  const currentIndex = reviewSession?.currentIndex || 0
  const totalWords = reviewWords.length
  const currentWordNumber = currentIndex + 1
  const sessionComplete = currentIndex >= reviewWords.length && !currentWord

  return {
    // State from useReviewSession compatibility
    reviewSession,
    currentWord,
    currentIndex,
    sessionComplete,
    reviewWords,
    totalWords,
    currentWordNumber,
    isLoading: isLoading || reviewLoading,

    // useReviewScreen specific state
    isFlipped,
    isPlayingAudio,

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
    restartSession,
    tapGesture,
    doubleTapGesture,
    panGesture,
  }
}

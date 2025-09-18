import { useState, useEffect, useCallback } from 'react'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { createAudioPlayer, AudioPlayer } from 'expo-audio'
import { ToastService } from '@/components/AppToast'
import { ToastMessageType } from '@/constants/ToastConstants'
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
  } = useApplicationStore()

  const [audioPlayer, setAudioPlayer] = useState<AudioPlayer | null>(null)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [lastTouchTime, setLastTouchTime] = useState(0)
  const [isScrolling] = useState(false)

  // Initialize audio player
  useEffect(() => {
    const initAudio = async () => {
      try {
        const player = await createAudioPlayer()
        setAudioPlayer(player)
      } catch (error) {
        console.error('Failed to initialize audio player:', error)
      }
    }

    initAudio()

    return () => {
      // Cleanup handled by component unmount
    }
  }, [])

  // Cleanup audio player when component unmounts
  useEffect(() => {
    return () => {
      if (audioPlayer) {
        audioPlayer.remove()
      }
    }
  }, [audioPlayer])

  // Start review session when component mounts - only once
  useEffect(() => {
    startReviewSession()
  }, [startReviewSession])

  // Reset card state when word changes
  useEffect(() => {
    setIsFlipped(false)
  }, [currentWord?.word_id])

  const playAudio = useCallback(
    async (url?: string) => {
      if (!audioPlayer || !currentWord?.dutch_lemma) return

      try {
        const audioUrl =
          url ||
          currentWord.tts_url ||
          `https://api.dictionaryapi.dev/api/v2/entries/en/${currentWord.dutch_lemma}`
        audioPlayer.replace({
          uri: audioUrl,
        })
        audioPlayer.play()
      } catch (error) {
        console.error('Failed to play audio:', error)
        ToastService.showError(ToastMessageType.AUDIO_PLAYBACK_FAILED)
      }
    },
    [audioPlayer, currentWord?.dutch_lemma, currentWord?.tts_url]
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
        ToastService.showError(ToastMessageType.MARK_INCORRECT_FAILED)
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
      // Delete word from database and global state
      await deleteWord(currentWord.word_id)

      deleteWordFromReview(currentWord.word_id)

      setIsFlipped(false)

      ToastService.showSuccess(ToastMessageType.WORD_DELETED)
    } catch {
      ToastService.showError(ToastMessageType.DELETE_WORD_FAILED)
    }
  }, [currentWord, deleteWord, deleteWordFromReview])

  const handleEndSession = useCallback(() => {
    endReviewSession()
    ToastService.showReviewMessage('complete')
  }, [endReviewSession])

  const handleImageChange = useCallback(
    async (imageUrl: string) => {
      if (!currentWord) return

      try {
        // TODO: Implement updateWordImage in store
        // await updateWordImage(currentWord.word_id, imageUrl)
        ToastService.showSuccess(ToastMessageType.IMAGE_UPDATED)
      } catch {
        ToastService.showError(ToastMessageType.UPDATE_IMAGE_FAILED)
      }
    },
    [currentWord]
  )

  const restartSession = useCallback(() => {
    // TODO: Implement restartSession in store
    // For now, just show a message
    ToastService.showInfo(ToastMessageType.RESTART_SESSION)
  }, [])

  // Create tap gesture for card flip
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
          if (!isScrolling) {
            const now = Date.now()
            if (now - lastTouchTime < 300) {
              console.log('❌ TAP GESTURE: Prevented double tap')
              return
            }

            console.log('✅ TAP GESTURE: Flipping card')
            scheduleOnRN(setLastTouchTime, now)
            scheduleOnRN(flipCard)
            scheduleOnRN(setIsFlipped, !isFlipped)
          } else {
            console.log('❌ TAP GESTURE: Prevented due to scrolling')
          }
        } catch (error) {
          console.log('💥 TAP GESTURE: Error occurred:', error)
        }
      })
  }, [isScrolling, lastTouchTime, flipCard, isFlipped])

  // Create double tap gesture for word detail
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

  // Create pan gesture for swipe navigation
  const panGesture = useCallback(() => {
    return Gesture.Pan()
      .minDistance(20) // Minimum distance to start pan (higher than tap maxDistance)
      .onEnd((event: PanGestureHandlerEventPayload) => {
        'worklet'
        const swipeThreshold = 50

        // Only handle navigation if it's a significant swipe
        if (Math.abs(event.translationX) > swipeThreshold) {
          if (event.translationX < -swipeThreshold) {
            // Swipe left - go to next word
            scheduleOnRN(goToNextWord)
          } else if (event.translationX > swipeThreshold) {
            // Swipe right - go to previous word
            scheduleOnRN(goToPreviousWord)
          }
        }
      })
      .enabled(!isFlipped) // Only enable swiping on front side
  }, [isFlipped, goToNextWord, goToPreviousWord])

  return {
    // State
    reviewSession,
    currentWord,
    isFlipped,
    isLoading: isLoading || reviewLoading,
    audioPlayer,

    // Actions
    playAudio,
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

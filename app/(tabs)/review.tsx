import React, { useState, useEffect } from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  View as RNView,
  GestureResponderEvent,
} from 'react-native'
import { createAudioPlayer } from 'expo-audio'
import Toast from 'react-native-toast-message'
import { Text, View } from '@/components/Themed'
import { useAppStore } from '@/stores/useAppStore'
import ImageSelector from '@/components/ImageSelector'
import { CardFront } from '@/components/ReviewCard/CardFront'
import { CardBack } from '@/components/ReviewCard/CardBack'
import { TOUCH_CONFIG, UI_CONFIG } from '@/constants/AppConfig'

const { width } = Dimensions.get('window')

export default function ReviewScreen() {
  const {
    reviewSession,
    reviewLoading,
    startReviewSession,
    submitReviewAssessment,
    clearError,
    error,
  } = useAppStore()

  const [showAnswer, setShowAnswer] = useState(false)
  const [, setIsLoading] = useState(false)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)

  // Touch handling state
  const [touchStart, setTouchStart] = useState<{
    time: number
    x: number
    y: number
  } | null>(null)

  // Image selector state
  const [showImageSelector, setShowImageSelector] = useState(false)

  useEffect(() => {
    // Initialize review session when component mounts
    if (!reviewSession && !reviewLoading) {
      startReviewSession()
    }
  }, [reviewSession, reviewLoading, startReviewSession])

  const reviewWords = reviewSession?.words || []
  const currentIndex = reviewSession?.currentIndex || 0
  const sessionComplete = currentIndex >= reviewWords.length

  const currentWord = reviewWords[currentIndex]

  const playPronunciation = async (ttsUrl: string) => {
    if (isPlayingAudio) return

    setIsPlayingAudio(true)
    try {
      // Use expo-audio createAudioPlayer API
      const player = createAudioPlayer({ uri: ttsUrl })

      // Play the audio
      await player.play()

      // Simple timeout to reset state (since event listeners might be complex)
      setTimeout(() => {
        setIsPlayingAudio(false)
        player.release() // Clean up resources
      }, 3000) // 3 seconds should be enough for TTS
    } catch (error) {
      console.error('Error playing audio:', error)
      setIsPlayingAudio(false)
      Toast.show({
        type: 'error',
        text1: 'Audio Error',
        text2: 'Could not play pronunciation. Please try again.',
      })
    }
  }

  const handleCardFlip = () => {
    setShowAnswer(!showAnswer)
  }

  const handleTouchStart = (event: GestureResponderEvent) => {
    const { pageX, pageY } = event.nativeEvent
    setTouchStart({
      time: Date.now(),
      x: pageX,
      y: pageY,
    })
  }

  const handleTouchEnd = (event: GestureResponderEvent) => {
    if (!touchStart) return

    const { pageX, pageY } = event.nativeEvent
    const touchEnd = {
      time: Date.now(),
      x: pageX,
      y: pageY,
    }

    // Calculate touch duration and distance
    const touchDuration = touchEnd.time - touchStart.time
    const touchDistance = Math.sqrt(
      Math.pow(touchEnd.x - touchStart.x, 2) +
        Math.pow(touchEnd.y - touchStart.y, 2)
    )

    // Use constants for gesture recognition
    const isQuickTap =
      touchDuration < TOUCH_CONFIG.MAX_TAP_DURATION &&
      touchDistance < TOUCH_CONFIG.MAX_TAP_DISTANCE

    if (isQuickTap) {
      handleCardFlip()
    }

    // Reset touch state
    setTouchStart(null)
  }

  const handleSRSResponse = async (
    difficulty: 'again' | 'hard' | 'good' | 'easy'
  ) => {
    if (!showAnswer) {
      Toast.show({
        type: 'info',
        text1: 'Review First',
        text2: 'Tap the card to see the translation and examples',
      })
      return
    }

    if (!currentWord) return

    setIsLoading(true)

    try {
      // Submit the assessment through the store
      await submitReviewAssessment({
        wordId: currentWord.word_id,
        quality: difficulty,
      })

      console.log(`Marked word "${currentWord.dutch_lemma}" as ${difficulty}`)

      // Move to next word or complete session
      if (currentIndex < reviewWords.length - 1) {
        // Next word logic handled by store
        setShowAnswer(false)
      } else {
        // Session completed - handled by store
      }
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to save progress. Please try again.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const restartSession = () => {
    setShowAnswer(false)
    startReviewSession()
  }

  const handleImageChange = async (newImageUrl: string) => {
    if (!currentWord) return

    try {
      // Here you would call a function to update the word's image in the database
      // For now, we'll just update the local state
      const { updateWordImage } = useAppStore.getState()
      await updateWordImage(currentWord.word_id, newImageUrl)

      Toast.show({
        type: 'success',
        text1: 'Image Updated',
        text2: 'Word image has been changed successfully.',
      })
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: 'Could not update image. Please try again.',
      })
    }
  }

  // Loading state
  if (reviewLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading review session...</Text>
        </View>
      </View>
    )
  }

  // Error state
  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error.message}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              clearError()
              startReviewSession()
            }}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  if (reviewWords.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No words to review! 🎉</Text>
          <Text style={styles.emptySubtitle}>
            All your words are scheduled for future review. Come back later or
            add new words to practice.
          </Text>
        </View>
      </View>
    )
  }

  if (sessionComplete) {
    return (
      <View style={styles.container}>
        <View style={styles.completionCard}>
          <Text style={styles.completionTitle}>Session Complete! 🎉</Text>
          <Text style={styles.completionStats}>
            You reviewed {reviewWords.length} words
          </Text>
          <TouchableOpacity
            style={styles.restartButton}
            onPress={restartSession}
          >
            <Text style={styles.restartButtonText}>Review Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const renderCard = () => {
    if (!currentWord) return null

    return (
      <RNView
        style={styles.flashcard}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <View style={styles.cardContent}>
          {!showAnswer ? (
            <CardFront
              currentWord={currentWord}
              isPlayingAudio={isPlayingAudio}
              onPlayPronunciation={playPronunciation}
            />
          ) : (
            <CardBack
              currentWord={currentWord}
              onChangeImage={() => setShowImageSelector(true)}
              isPlayingAudio={isPlayingAudio}
              onPlayPronunciation={playPronunciation}
            />
          )}
        </View>
      </RNView>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.progressText}>
          {currentIndex + 1} / {reviewWords.length}
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${((currentIndex + 1) / reviewWords.length) * 100}%` },
            ]}
          />
        </View>
      </View>

      {renderCard()}

      {showAnswer && (
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.srsButton, styles.againButton]}
            onPress={() => handleSRSResponse('again')}
          >
            <Text style={styles.buttonText}>Again</Text>
            <Text style={styles.buttonSubtext}>{'< 1min'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.srsButton, styles.hardButton]}
            onPress={() => handleSRSResponse('hard')}
          >
            <Text style={styles.buttonText}>Hard</Text>
            <Text style={styles.buttonSubtext}>{'< 6min'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.srsButton, styles.goodButton]}
            onPress={() => handleSRSResponse('good')}
          >
            <Text style={styles.buttonText}>Good</Text>
            <Text style={styles.buttonSubtext}>{'< 10min'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.srsButton, styles.easyButton]}
            onPress={() => handleSRSResponse('easy')}
          >
            <Text style={styles.buttonText}>Easy</Text>
            <Text style={styles.buttonSubtext}>4 days</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Image Selector Modal */}
      {currentWord && (
        <ImageSelector
          visible={showImageSelector}
          onClose={() => setShowImageSelector(false)}
          onSelect={handleImageChange}
          currentImageUrl={currentWord.image_url || undefined}
          englishTranslation={currentWord.translations.en[0] || ''}
          partOfSpeech={currentWord.part_of_speech || ''}
          examples={currentWord.examples || undefined}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  header: {
    marginBottom: 20,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
    color: '#374151',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 4,
  },
  flashcard: {
    width: width - 32,
    minHeight: UI_CONFIG.CARD_MIN_HEIGHT,
    marginBottom: 20,
  },
  cardContent: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
  },
  cardFront: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBack: {
    flex: 1,
  },
  dutchWord: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  dutchWordSmall: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 20,
  },
  wordWithPronunciation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  wordWithPronunciationSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  pronunciationButton: {
    marginLeft: 12,
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  pronunciationButtonSmall: {
    marginLeft: 8,
    padding: 6,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
  },
  partOfSpeech: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  tapHint: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  wordHeader: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  metadataRow: {
    marginTop: 8,
  },
  metadataText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  translationsSection: {
    marginBottom: 16,
  },
  translationGroup: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    textAlign: 'left',
  },
  languageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 6,
  },
  translationText: {
    fontSize: 15,
    color: '#1f2937',
    marginBottom: 4,
    marginLeft: 16,
    lineHeight: 20,
  },
  examplesSection: {
    marginBottom: 16,
  },
  exampleItem: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  exampleDutch: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 6,
    lineHeight: 20,
  },
  exampleTranslation: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
    lineHeight: 18,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  srsButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 60,
    justifyContent: 'center',
  },
  againButton: {
    backgroundColor: '#dc2626',
  },
  hardButton: {
    backgroundColor: '#f59e0b',
  },
  goodButton: {
    backgroundColor: '#10b981',
  },
  easyButton: {
    backgroundColor: '#2563eb',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonSubtext: {
    color: 'white',
    fontSize: 12,
    opacity: 0.8,
    marginTop: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  completionCard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  completionTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  completionStats: {
    fontSize: 18,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  restartButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  restartButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  // Loading states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
  },
  // Error states
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  imageSection: {
    marginBottom: 16,
  },
  imageSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  changeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
  },
  changeImageText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
    fontWeight: '500',
  },
  wordImage: {
    width: '100%',
    height: 140,
    borderRadius: 8,
    marginTop: 8,
  },
})

import React, { useRef, useState, useCallback, useMemo } from 'react'
import {
  TouchableOpacity,
  ActivityIndicator,
  View,
  ScrollView,
  RefreshControl,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { scheduleOnRN } from 'react-native-worklets'
import { TextThemed, ViewThemed } from '@/components/Themed'
import ImageSelector from '@/components/ImageSelector'
import WordDetailModal from '@/components/WordDetailModal'
import { CardFront } from '@/components/ReviewCard/CardFront'
import {
  UniversalWordCard,
  WordCardPresets,
} from '@/components/UniversalWordCard'
import { GestureErrorBoundary } from '@/components/GestureErrorBoundary'
import { useReviewScreen } from '@/hooks/useReviewScreen'
import { useImageSelector } from '@/hooks/useImageSelector'
import { reviewScreenStyles } from '@/styles/ReviewScreenStyles'
import { Colors } from '@/constants/Colors'
import { useApplicationStore } from '@/stores/useApplicationStore'
import type { Word } from '@/types/database'

export default function ReviewScreen() {
  const [selectedWord, setSelectedWord] = useState<Word | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const pronunciationRef = useRef<View>(null)

  const {
    // State
    currentWord,
    sessionComplete,
    reviewWords,
    isLoading,
    totalWords,
    currentWordNumber,
    isFlipped,
    isPlayingAudio,
    // Actions
    playAudio,
    handleAgain,
    handleHard,
    handleGood,
    handleEasy,
    handleDeleteWord,
    handleImageChange,
    restartSession,
    tapGesture,
    panGesture,
    flipCard,
    goToNextWord,
    goToPreviousWord,
  } = useReviewScreen()

  console.log('🔍 REVIEW SCREEN: Hooks initialized, isFlipped:', isFlipped)

  const { showImageSelector, openImageSelector, closeImageSelector } =
    useImageSelector()

  console.log(
    '🔍 REVIEW SCREEN: Session state - currentWord:',
    currentWord?.dutch_lemma,
    'isLoading:',
    isLoading,
    'sessionComplete:',
    sessionComplete
  )

  // Get startReviewSession from the store
  const startReviewSession = useApplicationStore(
    state => state.startReviewSession
  )

  const handleWordPress = useCallback(() => {
    if (currentWord) {
      setSelectedWord(currentWord)
      setModalVisible(true)
    }
  }, [currentWord])

  const handleCloseModal = useCallback(() => {
    setModalVisible(false)
    setSelectedWord(null)
  }, [])

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await startReviewSession()
    } catch (error) {
      console.error('Error refreshing review session:', error)
    } finally {
      setRefreshing(false)
    }
  }, [startReviewSession])

  // Create completely stable gestures to prevent recreation
  const tapGestureInstance = useMemo(() => {
    return Gesture.Tap()
      .maxDuration(200)
      .maxDistance(5)
      .onBegin(() => {
        'worklet'
        console.log('🟢 TAP GESTURE: onBegin triggered')
      })
      .onEnd(() => {
        'worklet'
        scheduleOnRN(() => {
          const now = Date.now()
          // flipCard already handles the state change
          flipCard()
        })
      })
  }, [flipCard]) // Only depend on flipCard

  const panGestureInstance = useMemo(() => {
    return Gesture.Pan()
      .minDistance(20)
      .onEnd(event => {
        'worklet'
        const swipeThreshold = 50
        if (Math.abs(event.translationX) > swipeThreshold) {
          if (event.translationX < -swipeThreshold) {
            scheduleOnRN(goToNextWord)
          } else if (event.translationX > swipeThreshold) {
            scheduleOnRN(goToPreviousWord)
          }
        }
      })
  }, [goToNextWord, goToPreviousWord]) // Only depend on navigation functions

  const doubleTapGestureInstance = useMemo(() => {
    return Gesture.Tap()
      .numberOfTaps(2)
      .maxDuration(400)
      .maxDistance(10)
      .onEnd(() => {
        'worklet'
        console.log('🔍 DOUBLE TAP: Triggered')
        scheduleOnRN(handleWordPress)
      })
  }, [handleWordPress])

  const renderCard = useCallback(() => {
    console.log(
      '🔍 RENDER CARD: Function called, currentWord:',
      currentWord?.dutch_lemma
    )

    if (!currentWord) {
      console.log('🔍 RENDER CARD: No currentWord, returning null')
      return null
    }

    try {
      console.log('🔍 RENDER CARD: Using stable gestures...')

      // Combine all stable gestures
      const combinedGesture = Gesture.Exclusive(
        panGestureInstance,
        Gesture.Simultaneous(tapGestureInstance, doubleTapGestureInstance)
      )

      console.log('🔍 RENDER CARD: About to render GestureDetector')

      return (
        <GestureErrorBoundary>
          <GestureDetector gesture={combinedGesture}>
            <ViewThemed style={reviewScreenStyles.flashcard}>
              {!isFlipped ? (
                <CardFront
                  currentWord={currentWord}
                  isPlayingAudio={isPlayingAudio}
                  onPlayPronunciation={playAudio}
                  pronunciationRef={pronunciationRef}
                />
              ) : (
                <UniversalWordCard
                  word={currentWord}
                  config={WordCardPresets.review.config}
                  actions={{
                    ...WordCardPresets.review.actions,
                    onDelete: handleDeleteWord,
                  }}
                  isPlayingAudio={isPlayingAudio}
                  onPlayPronunciation={playAudio}
                  onChangeImage={openImageSelector}
                  style={reviewScreenStyles.universalWordCard}
                />
              )}
            </ViewThemed>
          </GestureDetector>
        </GestureErrorBoundary>
      )
    } catch (error) {
      console.error('Error rendering card:', error)
      return (
        <ViewThemed style={reviewScreenStyles.flashcard}>
          <TextThemed>Error rendering card</TextThemed>
        </ViewThemed>
      )
    }
  }, [
    currentWord,
    isFlipped,
    isPlayingAudio,
    playAudio,
    handleDeleteWord,
    openImageSelector,
    tapGestureInstance,
    panGestureInstance,
    doubleTapGestureInstance,
  ])

  // Check if we should show the empty state first
  if (reviewWords.length === 0 && !isLoading) {
    return (
      <ScrollView
        style={reviewScreenStyles.container}
        contentContainerStyle={reviewScreenStyles.emptyContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary.DEFAULT]}
            tintColor={Colors.primary.DEFAULT}
          />
        }
      >
        <TextThemed style={reviewScreenStyles.emptyText}>
          No words to review! 🎉
        </TextThemed>
        <TextThemed style={reviewScreenStyles.emptySubtext}>
          All your words are scheduled for future review. Pull to refresh or add
          new words to practice.
        </TextThemed>
      </ScrollView>
    )
  }

  if (isLoading) {
    return (
      <ViewThemed style={reviewScreenStyles.container}>
        <ViewThemed style={reviewScreenStyles.loadingContainer}>
          <ActivityIndicator
            size="large"
            // color={REVIEW_SCREEN_CONSTANTS.COLORS.PRIMARY}
            color={Colors.primary.DEFAULT}
          />
          <TextThemed style={reviewScreenStyles.loadingText}>
            Loading review session...
          </TextThemed>
        </ViewThemed>
      </ViewThemed>
    )
  }

  if (sessionComplete) {
    return (
      <ViewThemed style={reviewScreenStyles.container}>
        <ViewThemed style={reviewScreenStyles.emptyContainer}>
          <TextThemed style={reviewScreenStyles.emptyText}>
            Session Complete! 🎉
          </TextThemed>
          <TextThemed style={reviewScreenStyles.emptySubtext}>
            You reviewed {reviewWords.length} words
          </TextThemed>
          <TouchableOpacity
            style={reviewScreenStyles.srsButton}
            onPress={restartSession}
          >
            <TextThemed style={reviewScreenStyles.buttonText}>
              Review Again
            </TextThemed>
          </TouchableOpacity>
        </ViewThemed>
      </ViewThemed>
    )
  }

  return (
    <ViewThemed style={reviewScreenStyles.container}>
      <ViewThemed style={reviewScreenStyles.progressContainer}>
        <TextThemed style={reviewScreenStyles.progressText}>
          {currentWordNumber} / {totalWords}
        </TextThemed>
      </ViewThemed>

      <ViewThemed style={reviewScreenStyles.cardContainer}>
        {renderCard()}
      </ViewThemed>

      <ViewThemed style={reviewScreenStyles.buttonsContainer}>
        <TouchableOpacity
          style={[reviewScreenStyles.srsButton, reviewScreenStyles.againButton]}
          onPress={handleAgain}
          disabled={isLoading}
        >
          <TextThemed style={reviewScreenStyles.buttonText}>Again</TextThemed>
        </TouchableOpacity>

        <TouchableOpacity
          style={[reviewScreenStyles.srsButton, reviewScreenStyles.hardButton]}
          onPress={handleHard}
          disabled={isLoading}
        >
          <TextThemed style={reviewScreenStyles.buttonText}>Hard</TextThemed>
        </TouchableOpacity>

        <TouchableOpacity
          style={[reviewScreenStyles.srsButton, reviewScreenStyles.goodButton]}
          onPress={handleGood}
          disabled={isLoading}
        >
          <TextThemed style={reviewScreenStyles.buttonText}>Good</TextThemed>
        </TouchableOpacity>

        <TouchableOpacity
          style={[reviewScreenStyles.srsButton, reviewScreenStyles.easyButton]}
          onPress={handleEasy}
          disabled={isLoading}
        >
          <TextThemed style={reviewScreenStyles.buttonText}>Easy</TextThemed>
        </TouchableOpacity>
      </ViewThemed>

      {currentWord && (
        <ImageSelector
          visible={showImageSelector}
          onClose={closeImageSelector}
          onSelect={handleImageChange}
          currentImageUrl={currentWord.image_url || undefined}
          englishTranslation={currentWord.translations.en[0] || ''}
          partOfSpeech={currentWord.part_of_speech || ''}
          examples={currentWord.examples || undefined}
        />
      )}

      <WordDetailModal
        visible={modalVisible}
        onClose={handleCloseModal}
        word={selectedWord}
        onChangeImage={openImageSelector}
        onDeleteWord={handleDeleteWord}
      />
    </ViewThemed>
  )
}

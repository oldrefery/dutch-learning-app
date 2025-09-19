import React, { useRef, useState } from 'react'
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
import { useReviewSession } from '@/hooks/useReviewSession'
import { reviewScreenStyles } from '@/styles/ReviewScreenStyles'
import { Colors } from '@/constants/Colors'
import { useApplicationStore } from '@/stores/useApplicationStore'
import type { Word } from '@/types/database'

export default function ReviewScreen() {
  console.log('🔍 REVIEW SCREEN: Component rendering')

  const [selectedWord, setSelectedWord] = useState<Word | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const pronunciationRef = useRef<View>(null)

  const {
    isFlipped,
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
  } = useReviewScreen()

  console.log('🔍 REVIEW SCREEN: Hooks initialized, isFlipped:', isFlipped)

  const { showImageSelector, openImageSelector, closeImageSelector } =
    useImageSelector()
  const {
    currentWord,
    sessionComplete,
    reviewWords,
    isLoading,
    totalWords,
    currentWordNumber,
  } = useReviewSession()

  console.log(
    '🔍 REVIEW SCREEN: Session state - currentWord:',
    currentWord?.dutch_lemma,
    'isLoading:',
    isLoading,
    'sessionComplete:',
    sessionComplete
  )

  // Get startReviewSession from store
  const startReviewSession = useApplicationStore(
    state => state.startReviewSession
  )

  const handleWordPress = () => {
    if (currentWord) {
      setSelectedWord(currentWord)
      setModalVisible(true)
    }
  }

  const handleCloseModal = () => {
    setModalVisible(false)
    setSelectedWord(null)
  }

  const onRefresh = async () => {
    setRefreshing(true)
    try {
      await startReviewSession()
    } catch (error) {
      console.error('Error refreshing review session:', error)
    } finally {
      setRefreshing(false)
    }
  }

  // Check if we should show empty state first
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

  const renderCard = () => {
    console.log(
      '🔍 RENDER CARD: Function called, currentWord:',
      currentWord?.dutch_lemma
    )

    if (!currentWord) {
      console.log('🔍 RENDER CARD: No currentWord, returning null')
      return null
    }

    try {
      console.log('🔍 RENDER CARD: Creating gestures...')

      // Create double tap gesture with callback
      const doubleTapWithCallback = Gesture.Tap()
        .numberOfTaps(2)
        .maxDuration(400)
        .maxDistance(10)
        .onEnd(() => {
          'worklet'
          console.log('🔍 DOUBLE TAP: Triggered')
          scheduleOnRN(handleWordPress)
        })

      console.log('🔍 RENDER CARD: Double tap gesture created')

      // Get tap and pan gestures
      const tapGestureInstance = tapGesture()
      const panGestureInstance = panGesture()

      console.log('🔍 RENDER CARD: Tap and pan gestures obtained')

      // Combine gestures - pan for swipe navigation, tap for card flip, double tap for word detail
      const combinedGesture = Gesture.Exclusive(
        panGestureInstance,
        Gesture.Simultaneous(tapGestureInstance, doubleTapWithCallback)
      )

      console.log('🔍 RENDER CARD: Combined gesture created')

      console.log('🔍 RENDER CARD: About to render GestureDetector')

      return (
        <GestureErrorBoundary>
          <GestureDetector gesture={combinedGesture}>
            <ViewThemed style={reviewScreenStyles.flashcard}>
              {!isFlipped ? (
                <>
                  {console.log('🔍 RENDER CARD: Rendering CardFront')}
                  <CardFront
                    currentWord={currentWord}
                    isPlayingAudio={false}
                    onPlayPronunciation={playAudio}
                    pronunciationRef={pronunciationRef}
                  />
                </>
              ) : (
                <>
                  {console.log('🔍 RENDER CARD: Rendering UniversalWordCard')}
                  <UniversalWordCard
                    word={currentWord}
                    config={WordCardPresets.review.config}
                    actions={{
                      ...WordCardPresets.review.actions,
                      onDelete: handleDeleteWord,
                    }}
                    isPlayingAudio={false}
                    onPlayPronunciation={playAudio}
                    onChangeImage={openImageSelector}
                    style={reviewScreenStyles.universalWordCard}
                  />
                </>
              )}
            </ViewThemed>
          </GestureDetector>
        </GestureErrorBoundary>
      )
    } catch (error) {
      console.error('🚨 RENDER CARD: Error occurred:', error)
      console.error(
        '🚨 RENDER CARD: Error stack:',
        error instanceof Error ? error.stack : 'No stack'
      )
      return (
        <ViewThemed style={reviewScreenStyles.flashcard}>
          <TextThemed>Error rendering card</TextThemed>
        </ViewThemed>
      )
    }
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

import React, { useRef, useState } from 'react'
import {
  TouchableOpacity,
  ActivityIndicator,
  View as RNView,
  ScrollView,
  RefreshControl,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { runOnJS } from 'react-native-reanimated'
import { Text, View } from '@/components/Themed'
import ImageSelector from '@/components/ImageSelector'
import WordDetailModal from '@/components/WordDetailModal'
import { CardFront } from '@/components/ReviewCard/CardFront'
import { CardBack } from '@/components/ReviewCard/CardBack'
import { useReviewScreen } from '@/hooks/useReviewScreen'
import { useImageSelector } from '@/hooks/useImageSelector'
import { useReviewSession } from '@/hooks/useReviewSession'
import { reviewScreenStyles } from '@/styles/ReviewScreenStyles'
import { Colors } from '@/constants/Colors'
import { useAppStore } from '@/stores/useAppStore'

export default function ReviewScreen() {
  const [selectedWord, setSelectedWord] = useState(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const pronunciationRef = useRef<RNView>(null)

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

  // Get startReviewSession from store
  const startReviewSession = useAppStore(state => state.startReviewSession)

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
        <Text style={reviewScreenStyles.emptyText}>No words to review! 🎉</Text>
        <Text style={reviewScreenStyles.emptySubtext}>
          All your words are scheduled for future review. Pull to refresh or add
          new words to practice.
        </Text>
      </ScrollView>
    )
  }

  if (isLoading) {
    return (
      <View style={reviewScreenStyles.container}>
        <View style={reviewScreenStyles.loadingContainer}>
          <ActivityIndicator
            size="large"
            // color={REVIEW_SCREEN_CONSTANTS.COLORS.PRIMARY}
            color={Colors.primary.DEFAULT}
          />
          <Text style={reviewScreenStyles.loadingText}>
            Loading review session...
          </Text>
        </View>
      </View>
    )
  }

  if (sessionComplete) {
    return (
      <View style={reviewScreenStyles.container}>
        <View style={reviewScreenStyles.emptyContainer}>
          <Text style={reviewScreenStyles.emptyText}>Session Complete! 🎉</Text>
          <Text style={reviewScreenStyles.emptySubtext}>
            You reviewed {reviewWords.length} words
          </Text>
          <TouchableOpacity
            style={reviewScreenStyles.srsButton}
            onPress={restartSession}
          >
            <Text style={reviewScreenStyles.buttonText}>Review Again</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  const renderCard = () => {
    if (!currentWord) return null

    // Create double tap gesture with callback
    const doubleTapWithCallback = Gesture.Tap()
      .numberOfTaps(2)
      .maxDuration(400)
      .maxDistance(10)
      .onEnd(() => {
        'worklet'
        runOnJS(handleWordPress)()
      })

    // Combine gestures - pan for swipe navigation, tap for card flip, double tap for word detail
    const combinedGesture = Gesture.Exclusive(
      panGesture(),
      Gesture.Simultaneous(tapGesture(), doubleTapWithCallback)
    )

    return (
      <GestureDetector gesture={combinedGesture}>
        <View style={reviewScreenStyles.flashcard}>
          {!isFlipped ? (
            <CardFront
              currentWord={currentWord}
              isPlayingAudio={false}
              onPlayPronunciation={playAudio}
              pronunciationRef={pronunciationRef}
            />
          ) : (
            <CardBack
              currentWord={currentWord}
              onChangeImage={openImageSelector}
              isPlayingAudio={false}
              onPlayPronunciation={playAudio}
              onDeleteWord={handleDeleteWord}
              pronunciationRef={pronunciationRef}
            />
          )}
        </View>
      </GestureDetector>
    )
  }

  return (
    <View style={reviewScreenStyles.container}>
      <View style={reviewScreenStyles.progressContainer}>
        <Text style={reviewScreenStyles.progressText}>
          {currentWordNumber} / {totalWords}
        </Text>
      </View>

      <View style={reviewScreenStyles.cardContainer}>{renderCard()}</View>

      <View style={reviewScreenStyles.buttonsContainer}>
        <TouchableOpacity
          style={[reviewScreenStyles.srsButton, reviewScreenStyles.againButton]}
          onPress={handleAgain}
          disabled={isLoading}
        >
          <Text style={reviewScreenStyles.buttonText}>Again</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[reviewScreenStyles.srsButton, reviewScreenStyles.hardButton]}
          onPress={handleHard}
          disabled={isLoading}
        >
          <Text style={reviewScreenStyles.buttonText}>Hard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[reviewScreenStyles.srsButton, reviewScreenStyles.goodButton]}
          onPress={handleGood}
          disabled={isLoading}
        >
          <Text style={reviewScreenStyles.buttonText}>Good</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[reviewScreenStyles.srsButton, reviewScreenStyles.easyButton]}
          onPress={handleEasy}
          disabled={isLoading}
        >
          <Text style={reviewScreenStyles.buttonText}>Easy</Text>
        </TouchableOpacity>
      </View>

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
      />
    </View>
  )
}

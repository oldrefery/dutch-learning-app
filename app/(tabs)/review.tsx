import React, { useState } from 'react'
// Review screen for spaced repetition learning
import { StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import Toast from 'react-native-toast-message'
import { Text, View } from '@/components/Themed'
import ImageSelector from '@/components/ImageSelector'
import { CardFront } from '@/components/ReviewCard/CardFront'
import { CardBack } from '@/components/ReviewCard/CardBack'
import { useReviewScreen } from '@/hooks/useReviewScreen'
import { REVIEW_CONSTANTS } from '@/constants/ReviewConstants'
import type { ReviewScreenProps } from '@/types/ReviewTypes'

export default function ReviewScreen() {
  const {
    reviewSession,
    currentWord,
    isFlipped,
    isLoading,
    playAudio,
    handleCardPress,
    handleTouchStart,
    handleTouchMove,
    handleCorrect,
    handleIncorrect,
    handleDeleteWord,
    handleEndSession,
    handleImageChange,
    restartSession,
  } = useReviewScreen()

  const [showImageSelector, setShowImageSelector] = useState(false)

  const reviewWords = reviewSession?.words || []
  const currentIndex = reviewSession?.currentIndex || 0
  const sessionComplete = currentIndex >= reviewWords.length

  // All logic is now handled by the useReviewScreen hook

  // Loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color={REVIEW_CONSTANTS.COLORS.PRIMARY}
          />
          <Text style={styles.loadingText}>Loading review session...</Text>
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
      <View
        style={styles.flashcard}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleCardPress}
      >
        {!isFlipped ? (
          <CardFront
            currentWord={currentWord}
            isPlayingAudio={false}
            onPlayPronunciation={playAudio}
          />
        ) : (
          <CardBack
            currentWord={currentWord}
            onChangeImage={() => setShowImageSelector(true)}
            isPlayingAudio={false}
            onPlayPronunciation={playAudio}
            onDeleteWord={handleDeleteWord}
          />
        )}
      </View>
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

      <View style={styles.cardContainer}>{renderCard()}</View>

      {isFlipped && (
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.srsButton, styles.againButton]}
            onPress={handleIncorrect}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>Again</Text>
            <Text style={styles.buttonSubtext}>{'< 1min'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.srsButton, styles.hardButton]}
            onPress={handleIncorrect}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>Hard</Text>
            <Text style={styles.buttonSubtext}>{'< 6min'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.srsButton, styles.goodButton]}
            onPress={handleCorrect}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>Good</Text>
            <Text style={styles.buttonSubtext}>{'< 10min'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.srsButton, styles.easyButton]}
            onPress={handleCorrect}
            disabled={isLoading}
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
  cardContainer: {
    flex: 1,
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
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 8,
    marginBottom: 20,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingBottom: 16,
  },
  srsButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 50,
    justifyContent: 'center',
  },
  againButton: {
    backgroundColor: '#dc2626',
  },
  hardButton: {
    backgroundColor: REVIEW_CONSTANTS.COLORS.WARNING,
  },
  goodButton: {
    backgroundColor: REVIEW_CONSTANTS.COLORS.SUCCESS,
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
})

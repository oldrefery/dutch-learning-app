import React, { useEffect, useCallback, useState } from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  Alert,
  useColorScheme,
} from 'react-native'
import * as Haptics from 'expo-haptics'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { WordStatusType } from '@/components/WordDetailModal/types'
import type { Word } from '@/types/database'

interface SwipeableWordItemProps {
  word: Word
  index: number
  onPress: () => void
  onDelete: (wordId: string) => void
  onMoveToCollection?: (wordId: string) => void
  moveModalVisible?: boolean
  wordBeingMoved?: string | null
  isHighlighted?: boolean
}

export default function SwipeableWordItem({
  word,
  index,
  onPress,
  onDelete,
  onMoveToCollection,
  moveModalVisible,
  wordBeingMoved,
  isHighlighted = false,
}: SwipeableWordItemProps) {
  const colorScheme = useColorScheme() ?? 'light'
  const translateX = useSharedValue(0)
  const opacity = useSharedValue(0)
  const translateY = useSharedValue(20)
  const highlightOpacity = useSharedValue(0)
  const [shouldShowDeleteDialog, setShouldShowDeleteDialog] = useState(false)
  const [shouldShowMoveDialog, setShouldShowMoveDialog] = useState(false)
  const [wasModalVisibleForThisWord, setWasModalVisibleForThisWord] =
    useState(false)

  const handleDelete = useCallback(() => {
    Alert.alert(
      'Delete Word',
      `Are you sure you want to delete "${word.dutch_original || word.dutch_lemma}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            // Reset position when a user cancels deletion
            translateX.value = withSpring(0)
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(word.word_id),
        },
      ],
      {
        onDismiss: () => {
          // Reset position when the alert is dismissed by tapping outside
          translateX.value = withSpring(0)
        },
      }
    )
  }, [
    word.dutch_original,
    word.dutch_lemma,
    word.word_id,
    onDelete,
    translateX,
  ])

  const resetPosition = useCallback(() => {
    translateX.value = withSpring(0)
  }, [translateX])

  const handleMoveToCollection = useCallback(() => {
    if (!onMoveToCollection) return

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    onMoveToCollection(word.word_id)
  }, [word.word_id, onMoveToCollection])

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 }, () => {})
    translateY.value = withTiming(0, { duration: 400 }, () => {})
  }, [opacity, translateY])

  // Highlight animation when a word is highlighted
  useEffect(() => {
    if (isHighlighted) {
      highlightOpacity.value = withTiming(1, { duration: 300 }, () => {
        // Fade out after 2 seconds
        highlightOpacity.value = withTiming(0, { duration: 1000 })
      })
    }
  }, [isHighlighted, highlightOpacity])

  useEffect(() => {
    if (shouldShowDeleteDialog) {
      handleDelete()
      setShouldShowDeleteDialog(false)
    }
  }, [shouldShowDeleteDialog, handleDelete])

  useEffect(() => {
    if (shouldShowMoveDialog) {
      handleMoveToCollection()
      setShouldShowMoveDialog(false)
    }
  }, [shouldShowMoveDialog, handleMoveToCollection])

  // Track when modal becomes visible for this word
  useEffect(() => {
    if (moveModalVisible && wordBeingMoved === word.word_id) {
      setWasModalVisibleForThisWord(true)
    }
  }, [moveModalVisible, wordBeingMoved, word.word_id])

  // Reset position when modal is closed and this word had the modal open
  useEffect(() => {
    if (!moveModalVisible && wasModalVisibleForThisWord) {
      resetPosition()
      setWasModalVisibleForThisWord(false)
    }
  }, [moveModalVisible, wasModalVisibleForThisWord, resetPosition])

  const getStatusStyle = () => {
    if (word.repetition_count > 2)
      return {
        backgroundColor:
          colorScheme === 'dark'
            ? Colors.success.darkModeChip
            : Colors.success.light,
        textColor:
          colorScheme === 'dark'
            ? Colors.success.darkModeChipText
            : Colors.success.DEFAULT,
      }
    if (word.repetition_count > 0)
      return {
        backgroundColor:
          colorScheme === 'dark'
            ? Colors.warning.darkModeBadge
            : Colors.warning.light,
        textColor:
          colorScheme === 'dark'
            ? Colors.warning.darkModeBadgeText
            : Colors.warning.dark,
      }
    return {
      backgroundColor:
        colorScheme === 'dark'
          ? Colors.dark.backgroundTertiary
          : Colors.neutral[200],
      textColor:
        colorScheme === 'dark'
          ? Colors.dark.textSecondary
          : Colors.neutral[600],
    }
  }

  const getStatusText = () => {
    if (word.repetition_count > 2) return WordStatusType.MASTERED
    if (word.repetition_count > 0) return WordStatusType.LEARNING

    return WordStatusType.NEW
  }

  const statusStyle = getStatusStyle()
  const isDueForReview = new Date(word.next_review_date) <= new Date()

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
      ],
      opacity: opacity.value,
    }
  })

  const highlightAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: highlightOpacity.value,
    }
  })

  const deleteButtonAnimatedStyle = useAnimatedStyle(() => {
    // Only expand on the long swipe left (>= 150 px)
    const isLongSwipeLeft = translateX.value <= -150
    return {
      width: isLongSwipeLeft ? Math.abs(translateX.value) + 80 : 80,
    }
  })

  const moveButtonAnimatedStyle = useAnimatedStyle(() => {
    // Only expand on the long swipe right (>= 150 px)
    const isLongSwipeRight = translateX.value >= 150
    return {
      width: isLongSwipeRight ? Math.abs(translateX.value) + 80 : 80,
    }
  })

  const tapGesture = Gesture.Tap()
    .maxDistance(10) // Tap must be within 10 px of the start point
    .maxDuration(300) // Tap must be under 300 ms
    .onEnd(() => {
      'worklet'
      // Only trigger tap if card is in resting position
      if (Math.abs(translateX.value) < 5) {
        scheduleOnRN(onPress)
      }
    })

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15]) // Only activate after 15 px horizontal movement
    .failOffsetY([-20, 20]) // Fail if vertical movement exceeds 20 px
    .maxPointers(1) // Only allow a single finger swipe
    .onUpdate(event => {
      'worklet'
      translateX.value = event.translationX
    })
    .onEnd(event => {
      'worklet'
      const { translationX } = event

      if (translationX > 150 && onMoveToCollection) {
        // Long swipe right - show move to collection dialog
        translateX.value = withSpring(300, {}, () => {
          'worklet'
          // Show the move dialog after animation
          scheduleOnRN(setShouldShowMoveDialog, true)
        })
      } else if (translationX > 80 && onMoveToCollection) {
        // Short swipe right - show the move button
        translateX.value = withSpring(100)
      } else if (translationX < -150) {
        // Long swipe left - show deletion dialog
        translateX.value = withSpring(-300, {}, () => {
          'worklet'
          // Show deletion dialog after animation
          scheduleOnRN(setShouldShowDeleteDialog, true)
        })
      } else if (translationX < -80) {
        // Short swipe left - show the delete button
        translateX.value = withSpring(-100)
      } else {
        // Return to the original position
        translateX.value = withSpring(0)
      }
    })

  // Use Race to ensure only one gesture can win
  const combinedGesture = Gesture.Race(panGesture, tapGesture)

  return (
    <ViewThemed style={styles.container}>
      {/* Move button background */}
      {onMoveToCollection && (
        <Animated.View style={[styles.moveBackground, moveButtonAnimatedStyle]}>
          <TouchableOpacity
            style={styles.moveButton}
            onPress={handleMoveToCollection}
          >
            <Ionicons
              name="folder-outline"
              size={24}
              color={Colors.background.primary}
            />
          </TouchableOpacity>
        </Animated.View>
      )}

      <Animated.View
        style={[styles.deleteBackground, deleteButtonAnimatedStyle]}
      >
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Ionicons
            name="trash-outline"
            size={24}
            color={Colors.background.primary}
          />
        </TouchableOpacity>
      </Animated.View>

      {/* Highlight overlay */}
      <Animated.View
        style={[
          styles.highlightOverlay,
          highlightAnimatedStyle,
          {
            backgroundColor:
              colorScheme === 'dark'
                ? Colors.dark.tint
                : Colors.primary.DEFAULT,
          },
        ]}
        pointerEvents="none"
      />

      {/* Main word item with gesture handler */}
      <GestureDetector gesture={combinedGesture}>
        <Animated.View
          style={[
            styles.wordItem,
            animatedStyle,
            {
              backgroundColor:
                colorScheme === 'dark'
                  ? Colors.dark.backgroundSecondary
                  : Colors.background.primary,
            },
          ]}
        >
          <ViewThemed style={styles.wordContent}>
            <ViewThemed
              style={[
                styles.wordNumber,
                {
                  backgroundColor:
                    colorScheme === 'dark'
                      ? Colors.dark.backgroundSecondary
                      : Colors.neutral[100],
                },
              ]}
            >
              <TextThemed
                style={[
                  styles.wordNumberText,
                  {
                    color:
                      colorScheme === 'dark'
                        ? Colors.dark.textSecondary
                        : Colors.neutral[500],
                  },
                ]}
              >
                {index + 1}
              </TextThemed>
            </ViewThemed>
            <ViewThemed style={styles.wordInfo}>
              <ViewThemed style={styles.wordHeader}>
                <TextThemed style={styles.wordText}>
                  {word.dutch_original || word.dutch_lemma}
                </TextThemed>
                {word.article && (
                  <TextThemed
                    style={[
                      styles.articleText,
                      {
                        color:
                          colorScheme === 'dark'
                            ? Colors.dark.textSecondary
                            : Colors.neutral[500],
                      },
                    ]}
                  >
                    ({word.article})
                  </TextThemed>
                )}
              </ViewThemed>

              <TextThemed
                style={[
                  styles.translationText,
                  {
                    color:
                      colorScheme === 'dark'
                        ? Colors.dark.textSecondary
                        : Colors.neutral[500],
                  },
                ]}
              >
                {word.translations.en?.[0] || 'No translation'}
              </TextThemed>

              <ViewThemed style={styles.wordFooter}>
                <ViewThemed
                  style={[
                    styles.statusBadge,
                    { backgroundColor: statusStyle.backgroundColor },
                  ]}
                >
                  <TextThemed
                    style={[
                      styles.statusText,
                      { color: statusStyle.textColor },
                    ]}
                  >
                    {getStatusText()}
                  </TextThemed>
                </ViewThemed>

                {isDueForReview && (
                  <ViewThemed
                    style={[
                      styles.reviewBadge,
                      colorScheme === 'dark' && {
                        backgroundColor: Colors.warning.darkModeBadge,
                      },
                    ]}
                  >
                    <TextThemed
                      style={[
                        styles.reviewText,
                        colorScheme === 'dark' && {
                          color: Colors.warning.darkModeBadgeText,
                        },
                      ]}
                    >
                      Due for review
                    </TextThemed>
                  </ViewThemed>
                )}
              </ViewThemed>
            </ViewThemed>

            <Ionicons
              name="chevron-forward"
              size={20}
              color={
                colorScheme === 'dark'
                  ? Colors.dark.textTertiary
                  : Colors.neutral[400]
              }
            />
          </ViewThemed>
        </Animated.View>
      </GestureDetector>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginBottom: 8,
  },
  moveBackground: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: Colors.primary.DEFAULT,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moveButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.transparent.white20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBackground: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: Colors.error.DEFAULT,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.transparent.white20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  highlightOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 8,
    opacity: 0.2,
    zIndex: 1,
  },
  wordItem: {
    borderRadius: 8,
    shadowColor: Colors.legacy.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    zIndex: 2,
  },
  wordContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  wordNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  wordNumberText: {
    fontSize: 14,
    fontWeight: '600',
  },
  wordInfo: {
    flex: 1,
  },
  wordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  wordText: {
    fontSize: 16,
    fontWeight: '600',
  },
  articleText: {
    fontSize: 14,
    marginLeft: 8,
  },
  translationText: {
    fontSize: 14,
    marginBottom: 8,
  },
  wordFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  reviewBadge: {
    backgroundColor: Colors.warning.light,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reviewText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.warning.dark,
  },
})

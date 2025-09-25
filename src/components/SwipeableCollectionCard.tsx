import React, { useRef } from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  Alert,
  useColorScheme,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import type { Collection, Word } from '@/types/database'

interface SwipeableCollectionCardProps {
  collection: Collection
  words: Word[]
  onPress: () => void
  onDelete: (collectionId: string) => void
  onRename: (collectionId: string, currentName: string) => Promise<void>
}

export default function SwipeableCollectionCard({
  collection,
  words,
  onPress,
  onDelete,
  onRename,
}: SwipeableCollectionCardProps) {
  const colorScheme = useColorScheme() ?? 'light'
  const translateX = useSharedValue(0)
  const lastGestureX = useRef<number>(0)

  // Calculate real stats for this collection
  const collectionWords = words.filter(
    word => word.collection_id === collection.collection_id
  )

  const stats = {
    totalWords: collectionWords.length,
    masteredWords: collectionWords.filter(w => w.repetition_count > 2).length,
    wordsToReview: collectionWords.filter(
      w => new Date(w.next_review_date) <= new Date()
    ).length,
    progressPercentage:
      collectionWords.length > 0
        ? Math.round(
            (collectionWords.filter(w => w.repetition_count > 2).length /
              collectionWords.length) *
              100
          )
        : 0,
  }

  const handleDelete = () => {
    Alert.alert(
      'Delete Collection',
      `Are you sure you want to delete "${collection.name}"? This will also delete all ${stats.totalWords} words in this collection.`,
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
          onPress: () => onDelete(collection.collection_id),
        },
      ],
      {
        onDismiss: () => {
          // Reset position when the alert is dismissed by tapping outside
          translateX.value = withSpring(0)
        },
      }
    )
  }

  const handleRename = async () => {
    try {
      await onRename(collection.collection_id, collection.name)
      // Reset position after a successful rename
      translateX.value = withSpring(0)
    } catch (error) {
      // Reset position on cancel/error
      translateX.value = withSpring(0)

      // Only log actual errors, not cancellations
      if (error instanceof Error && error.name !== 'CancelledError') {
        console.error('Rename failed:', error)
      }
    }
  }

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    }
  })

  const deleteButtonAnimatedStyle = useAnimatedStyle(() => {
    // Only expand on the long swipe left (>= 150 px)
    const isLongSwipeLeft = translateX.value <= -150
    return {
      width: isLongSwipeLeft ? Math.abs(translateX.value) + 80 : 80,
    }
  })

  const renameButtonAnimatedStyle = useAnimatedStyle(() => {
    // Only expand on the long swipe right (>= 150 px)
    const isLongSwipeRight = translateX.value >= 150
    return {
      width: isLongSwipeRight ? translateX.value + 80 : 80,
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
      lastGestureX.current = translationX

      if (translationX < -150) {
        // Long swipe left - trigger immediate deletion
        translateX.value = withSpring(-300, {}, () => {
          'worklet'
          // Trigger deletion after animation
          scheduleOnRN(handleDelete)
        })
      } else if (translationX > 150) {
        // Long swipe right - trigger immediate rename
        translateX.value = withSpring(300, {}, () => {
          'worklet'
          // Trigger rename after animation
          scheduleOnRN(handleRename)
        })
      } else if (translationX < -80) {
        // Short swipe left - show the delete button
        translateX.value = withSpring(-80)
      } else if (translationX > 80) {
        // Short swipe right - show the rename button
        translateX.value = withSpring(80)
      } else {
        // Return to the original position
        translateX.value = withSpring(0)
      }
    })

  // Use Race to ensure only one gesture can win
  const combinedGesture = Gesture.Race(panGesture, tapGesture)

  return (
    <ViewThemed style={styles.container}>
      {/* Rename button background (left side) */}
      <Animated.View style={[styles.renameButton, renameButtonAnimatedStyle]}>
        <TouchableOpacity
          style={styles.renameButtonContent}
          onPress={handleRename}
        >
          <Ionicons name="pencil" size={20} color="white" />
          <TextThemed style={styles.renameButtonText}>Rename</TextThemed>
        </TouchableOpacity>
      </Animated.View>

      {/* Delete the button background (right side) */}
      <Animated.View style={[styles.deleteButton, deleteButtonAnimatedStyle]}>
        <TouchableOpacity
          style={styles.deleteButtonContent}
          onPress={handleDelete}
        >
          <Ionicons name="trash" size={20} color="white" />
          <TextThemed style={styles.deleteButtonText}>Delete</TextThemed>
        </TouchableOpacity>
      </Animated.View>

      {/* Swipeable card */}
      <GestureDetector gesture={combinedGesture}>
        <Animated.View
          style={[
            styles.card,
            animatedStyle,
            {
              backgroundColor:
                colorScheme === 'dark'
                  ? Colors.dark.backgroundSecondary
                  : Colors.background.primary,
            },
          ]}
        >
          <ViewThemed style={styles.cardContent}>
            <ViewThemed style={styles.collectionHeader}>
              <ViewThemed style={styles.collectionNameRow}>
                <TextThemed style={styles.collectionName}>
                  {collection.name}
                </TextThemed>
                {collection.is_shared && (
                  <ViewThemed style={styles.sharedBadge}>
                    <Ionicons
                      name="share-outline"
                      size={14}
                      color={
                        colorScheme === 'dark'
                          ? Colors.dark.tint
                          : Colors.primary.DEFAULT
                      }
                    />
                    <TextThemed
                      style={[
                        styles.sharedBadgeText,
                        {
                          color:
                            colorScheme === 'dark'
                              ? Colors.dark.tint
                              : Colors.primary.DEFAULT,
                        },
                      ]}
                    >
                      Shared
                    </TextThemed>
                  </ViewThemed>
                )}
              </ViewThemed>
              <TextThemed
                style={styles.collectionStats}
                lightColor={Colors.neutral[500]}
                darkColor={Colors.dark.textSecondary}
              >
                {stats.totalWords} words • {stats.progressPercentage}% mastered
              </TextThemed>
            </ViewThemed>

            <ViewThemed style={styles.collectionProgress}>
              <ViewThemed style={styles.progressBar}>
                <ViewThemed
                  style={[
                    styles.progressFill,
                    { width: `${stats.progressPercentage}%` },
                  ]}
                />
              </ViewThemed>
              <TextThemed
                style={styles.progressText}
                lightColor={Colors.neutral[500]}
                darkColor={Colors.dark.textSecondary}
              >
                {stats.masteredWords}/{stats.totalWords} mastered
              </TextThemed>
            </ViewThemed>

            {stats.wordsToReview > 0 && (
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
                    styles.reviewBadgeText,
                    colorScheme === 'dark' && {
                      color: Colors.warning.darkModeBadgeText,
                    },
                  ]}
                >
                  {stats.wordsToReview} for review
                </TextThemed>
              </ViewThemed>
            )}
          </ViewThemed>
        </Animated.View>
      </GestureDetector>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  card: {
    padding: 16,
    shadowColor: Colors.legacy.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderRadius: 12,
  },
  cardContent: {
    flex: 1,
  },
  collectionHeader: {
    marginBottom: 12,
  },
  collectionNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  collectionName: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  sharedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'currentColor',
    marginLeft: 8,
  },
  sharedBadgeText: {
    fontSize: 11,
    fontWeight: '500',
    marginLeft: 4,
  },
  collectionStats: {
    fontSize: 14,
  },
  collectionProgress: {
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.neutral[200],
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary.DEFAULT,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    textAlign: 'center',
  },
  reviewBadge: {
    backgroundColor: Colors.warning.light,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  reviewBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.warning.dark,
  },
  renameButton: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: Colors.primary.DEFAULT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  renameButtonContent: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  renameButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  deleteButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: Colors.error.DEFAULT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonContent: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
})

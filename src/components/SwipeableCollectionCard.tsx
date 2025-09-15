import React, { useRef } from 'react'
import { StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import type { Collection, Word } from '@/types/database'

interface SwipeableCollectionCardProps {
  collection: Collection
  words: Word[]
  onPress: () => void
  onDelete: (collectionId: string) => void
}

export default function SwipeableCollectionCard({
  collection,
  words,
  onPress,
  onDelete,
}: SwipeableCollectionCardProps) {
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
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(collection.collection_id),
        },
      ]
    )
  }

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    }
  })

  const panGesture = Gesture.Pan()
    .onUpdate(event => {
      'worklet'
      translateX.value = event.translationX
    })
    .onEnd(event => {
      'worklet'
      const { translationX } = event
      lastGestureX.current = translationX

      if (translationX < -80) {
        // Swipe left - show the delete button
        translateX.value = withSpring(-80)
      } else {
        // Return to the original position
        translateX.value = withSpring(0)
      }
    })

  return (
    <ViewThemed style={styles.container}>
      {/* Delete a button background */}
      <ViewThemed style={styles.deleteButton}>
        <TouchableOpacity
          style={styles.deleteButtonContent}
          onPress={handleDelete}
        >
          <Ionicons name="trash" size={20} color="white" />
          <TextThemed style={styles.deleteButtonText}>Delete</TextThemed>
        </TouchableOpacity>
      </ViewThemed>

      {/* Swipeable card */}
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.card, animatedStyle]}>
          <TouchableOpacity style={styles.cardContent} onPress={onPress}>
            <ViewThemed style={styles.collectionHeader}>
              <TextThemed style={styles.collectionName}>
                {collection.name}
              </TextThemed>
              <TextThemed style={styles.collectionStats}>
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
              <TextThemed style={styles.progressText}>
                {stats.masteredWords}/{stats.totalWords} mastered
              </TextThemed>
            </ViewThemed>

            {stats.wordsToReview > 0 && (
              <ViewThemed style={styles.reviewBadge}>
                <TextThemed style={styles.reviewBadgeText}>
                  {stats.wordsToReview} for review
                </TextThemed>
              </ViewThemed>
            )}
          </TouchableOpacity>
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
    backgroundColor: Colors.background.primary,
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
  collectionName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 4,
  },
  collectionStats: {
    fontSize: 14,
    color: Colors.neutral[500],
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
    color: Colors.neutral[500],
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

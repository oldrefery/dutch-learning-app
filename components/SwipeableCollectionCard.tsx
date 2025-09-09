import React, { useRef } from 'react'
import { StyleSheet, TouchableOpacity, Alert, Animated } from 'react-native'
import { PanGestureHandler, State } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import { Text, View } from '@/components/Themed'
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
  const translateX = useRef(new Animated.Value(0)).current
  const lastGestureX = useRef(0)

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

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: true }
  )

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX } = event.nativeEvent
      lastGestureX.current = translationX

      if (translationX < -80) {
        // Swipe left - show delete button
        Animated.spring(translateX, {
          toValue: -80,
          useNativeDriver: true,
        }).start()
      } else {
        // Return to original position
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start()
      }
    }
  }

  return (
    <View style={styles.container}>
      {/* Delete button background */}
      <View style={styles.deleteButton}>
        <TouchableOpacity
          style={styles.deleteButtonContent}
          onPress={handleDelete}
        >
          <Ionicons name="trash" size={20} color="white" />
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>

      {/* Swipeable card */}
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ translateX }],
            },
          ]}
        >
          <TouchableOpacity style={styles.cardContent} onPress={onPress}>
            <View style={styles.collectionHeader}>
              <Text style={styles.collectionName}>{collection.name}</Text>
              <Text style={styles.collectionStats}>
                {stats.totalWords} words • {stats.progressPercentage}% mastered
              </Text>
            </View>

            <View style={styles.collectionProgress}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${stats.progressPercentage}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {stats.masteredWords}/{stats.totalWords} mastered
              </Text>
            </View>

            {stats.wordsToReview > 0 && (
              <View style={styles.reviewBadge}>
                <Text style={styles.reviewBadgeText}>
                  {stats.wordsToReview} for review
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </Animated.View>
      </PanGestureHandler>
    </View>
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
    backgroundColor: '#ffffff',
    padding: 16,
    shadowColor: '#000',
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
    color: '#111827',
    marginBottom: 4,
  },
  collectionStats: {
    fontSize: 14,
    color: '#6b7280',
  },
  collectionProgress: {
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  reviewBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  reviewBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#92400e',
  },
  deleteButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: '#ef4444',
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

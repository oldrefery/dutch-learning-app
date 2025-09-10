import React, { useRef } from 'react'
import { StyleSheet, TouchableOpacity, Animated, Alert } from 'react-native'
import { PanGestureHandler, State } from 'react-native-gesture-handler'
import { Ionicons } from '@expo/vector-icons'
import { Text, View } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import type { Word } from '@/types/database'

interface SwipeableWordItemProps {
  word: Word
  index: number
  onPress: () => void
  onDelete: (wordId: string) => void
}

export default function SwipeableWordItem({
  word,
  index,
  onPress,
  onDelete,
}: SwipeableWordItemProps) {
  const translateX = useRef(new Animated.Value(0)).current
  const SWIPE_THRESHOLD = -80
  const MAX_SWIPE = -100

  const getStatusColor = () => {
    if (word.repetition_count > 2) return Colors.success.DEFAULT // Green - mastered
    if (word.repetition_count > 0) return Colors.warning.DEFAULT // Yellow - learning
    return Colors.neutral[500] // Gray - new
  }

  const getStatusText = () => {
    if (word.repetition_count > 2) return 'Mastered'
    if (word.repetition_count > 0) return 'Learning'
    return 'New'
  }

  const isDueForReview = new Date(word.next_review_date) <= new Date()

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: true }
  )

  const onHandlerStateChange = (event: any) => {
    if (event.nativeEvent.state === State.END) {
      const { translationX, velocityX } = event.nativeEvent

      if (translationX < SWIPE_THRESHOLD || velocityX < -500) {
        // Show delete action
        Animated.spring(translateX, {
          toValue: MAX_SWIPE,
          useNativeDriver: true,
        }).start()
      } else {
        // Reset position
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start()
      }
    }
  }

  const handleDelete = () => {
    Alert.alert(
      'Delete Word',
      `Are you sure you want to delete "${word.dutch_original || word.dutch_lemma}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            // Reset position
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
            }).start()
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete(word.word_id)
            // Reset position
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
            }).start()
          },
        },
      ]
    )
  }

  return (
    <View style={styles.container}>
      {/* Delete button background */}
      <View style={styles.deleteBackground}>
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <Ionicons
            name="trash-outline"
            size={24}
            color={Colors.background.primary}
          />
        </TouchableOpacity>
      </View>

      {/* Main word item with gesture handler */}
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
        activeOffsetX={[-10, 10]}
      >
        <Animated.View
          style={[
            styles.wordItem,
            {
              transform: [{ translateX }],
            },
          ]}
        >
          <TouchableOpacity style={styles.wordContent} onPress={onPress}>
            <View style={styles.wordNumber}>
              <Text style={styles.wordNumberText}>{index + 1}</Text>
            </View>
            <View style={styles.wordInfo}>
              <View style={styles.wordHeader}>
                <Text style={styles.wordText}>
                  {word.dutch_original || word.dutch_lemma}
                </Text>
                {word.article && (
                  <Text style={styles.articleText}>({word.article})</Text>
                )}
              </View>

              <Text style={styles.translationText}>
                {word.translations.en?.[0] || 'No translation'}
              </Text>

              <View style={styles.wordFooter}>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor() },
                  ]}
                >
                  <Text style={styles.statusText}>{getStatusText()}</Text>
                </View>

                {isDueForReview && (
                  <View style={styles.reviewBadge}>
                    <Text style={styles.reviewText}>Due for review</Text>
                  </View>
                )}
              </View>
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color={Colors.neutral[400]}
            />
          </TouchableOpacity>
        </Animated.View>
      </PanGestureHandler>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginBottom: 8,
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordItem: {
    backgroundColor: Colors.background.primary,
    borderRadius: 8,
    shadowColor: Colors.legacy.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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
    backgroundColor: Colors.neutral[100],
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  wordNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral[500],
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
    color: Colors.neutral[900],
  },
  articleText: {
    fontSize: 14,
    color: Colors.neutral[500],
    marginLeft: 8,
  },
  translationText: {
    fontSize: 14,
    color: Colors.neutral[500],
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
    color: Colors.background.primary,
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

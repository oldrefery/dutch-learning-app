import React, { useEffect } from 'react'
import { StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { Text, View } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { WordStatusType } from '@/components/WordDetailModal/types'
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
  const translateX = useSharedValue(0)
  const opacity = useSharedValue(0)
  const translateY = useSharedValue(20)
  const SWIPE_THRESHOLD = -80
  const MAX_SWIPE = -100

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 }, () => {})
    translateY.value = withTiming(0, { duration: 400 }, () => {})
  }, [opacity, translateY])

  const getStatusColor = () => {
    if (word.repetition_count > 2) return Colors.success.DEFAULT
    if (word.repetition_count > 0) return Colors.warning.DEFAULT

    return Colors.neutral[500]
  }

  const getStatusText = () => {
    if (word.repetition_count > 2) return WordStatusType.MASTERED
    if (word.repetition_count > 0) return WordStatusType.LEARNING

    return WordStatusType.NEW
  }

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

  const panGesture = Gesture.Pan()
    .onUpdate(event => {
      'worklet'
      translateX.value = event.translationX
    })
    .onEnd(event => {
      'worklet'
      const { translationX, velocityX } = event

      if (translationX < SWIPE_THRESHOLD || velocityX < -500) {
        // Show delete
        translateX.value = withSpring(MAX_SWIPE)
        // TODO: Uncomment this when we have haptic feedback
        // runOnJS(console.log)('!!! Haptic feedback should trigger now !!!')
        // runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Heavy)
      } else {
        // Reset position
        translateX.value = withSpring(0)
      }
    })
    .activeOffsetX([-10, 10]) //Activate swipe only after 10px horizontally
    .failOffsetY([-5, 5]) //Cancel swipe if movement vertically > 5px

  const handleDelete = () => {
    Alert.alert(
      'Delete Word',
      `Are you sure you want to delete "${word.dutch_original || word.dutch_lemma}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            // Reset
            translateX.value = withSpring(0)
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete(word.word_id)
            // Reset
            translateX.value = withSpring(0)
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
      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.wordItem, animatedStyle]}>
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
      </GestureDetector>
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
    backgroundColor: Colors.transparent.white20,
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

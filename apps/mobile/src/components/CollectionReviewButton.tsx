import React from 'react'
import { StyleSheet, TouchableOpacity, View } from 'react-native'
import { TextThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'

interface CollectionReviewButtonProps {
  wordsForReview: number
  onPress: () => void
}

export default function CollectionReviewButton({
  wordsForReview,
  onPress,
}: CollectionReviewButtonProps) {
  if (wordsForReview === 0) return null

  return (
    <View style={styles.reviewButtonContainer}>
      <TouchableOpacity style={styles.reviewButton} onPress={onPress}>
        <TextThemed style={styles.reviewButtonText}>
          Review {wordsForReview} Words
        </TextThemed>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  reviewButtonContainer: {
    marginHorizontal: 16,
  },
  reviewButton: {
    backgroundColor: Colors.primary.DEFAULT,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  reviewButtonText: {
    color: Colors.background.primary,
    fontSize: 16,
    fontWeight: '600',
  },
})

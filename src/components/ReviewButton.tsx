import React from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'

interface ReviewButtonProps {
  wordsForReview: number
  onPress: () => void
}

export default function ReviewButton({
  wordsForReview,
  onPress,
}: ReviewButtonProps) {
  if (wordsForReview === 0) {
    return (
      <ViewThemed style={styles.disabledButton}>
        <TextThemed style={styles.disabledButtonText}>
          No words for review
        </TextThemed>
      </ViewThemed>
    )
  }

  return (
    <TouchableOpacity style={styles.reviewButton} onPress={onPress}>
      <TextThemed style={styles.reviewButtonText}>
        Review All Collections
      </TextThemed>
      <TextThemed style={styles.reviewButtonSubtext}>
        {wordsForReview} words ready for review
      </TextThemed>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  reviewButton: {
    backgroundColor: Colors.primary.DEFAULT,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  reviewButtonText: {
    color: Colors.background.primary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  reviewButtonSubtext: {
    color: Colors.neutral[100],
    fontSize: 12,
  },
  disabledButton: {
    backgroundColor: Colors.neutral[100],
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  disabledButtonText: {
    color: Colors.neutral[500],
    fontSize: 16,
    fontWeight: '500',
  },
})

import React from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'
import { Text, View } from '@/components/Themed'
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
      <View style={styles.disabledButton}>
        <Text style={styles.disabledButtonText}>No words for review</Text>
      </View>
    )
  }

  return (
    <TouchableOpacity style={styles.reviewButton} onPress={onPress}>
      <Text style={styles.reviewButtonText}>Review All Collections</Text>
      <Text style={styles.reviewButtonSubtext}>
        {wordsForReview} words ready for review
      </Text>
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

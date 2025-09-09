import React from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'
import { Text, View } from '@/components/Themed'

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
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  reviewButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  reviewButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
  },
  disabledButton: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 24,
  },
  disabledButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '500',
  },
})

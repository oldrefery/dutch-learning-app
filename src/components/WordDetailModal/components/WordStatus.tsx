import React from 'react'
import { View, Text } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { styles } from '../styles'
import { WordStatusType, WordStatusMessage } from '../types'

interface WordStatusProps {
  nextReviewDate: string | null
}

export default function WordStatus({ nextReviewDate }: WordStatusProps) {
  const getStatusColor = () => {
    if (!nextReviewDate) return Colors.neutral[400]
    const isOverdue = new Date(nextReviewDate) <= new Date()
    return isOverdue ? Colors.warning.DEFAULT : Colors.success.DEFAULT
  }

  const getStatusText = () => {
    if (!nextReviewDate) return WordStatusType.NOT_STARTED
    const isOverdue = new Date(nextReviewDate) <= new Date()
    return isOverdue ? WordStatusType.OVERDUE : WordStatusType.ON_TRACK
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Status</Text>
      <View style={styles.statusContainer}>
        <View
          style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}
        >
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
        {nextReviewDate && new Date(nextReviewDate) <= new Date() && (
          <View style={styles.reviewBadge}>
            <Text style={styles.reviewText}>
              {WordStatusMessage.REVIEW_NEEDED}
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}

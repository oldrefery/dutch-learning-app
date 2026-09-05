import React from 'react'
import { ViewThemed, TextThemed } from '@/components/Themed'
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
    <ViewThemed style={styles.section}>
      <TextThemed style={styles.sectionTitle}>Status</TextThemed>
      <ViewThemed style={styles.statusContainer}>
        <ViewThemed
          style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}
        >
          <TextThemed style={styles.statusText}>{getStatusText()}</TextThemed>
        </ViewThemed>
        {nextReviewDate && new Date(nextReviewDate) <= new Date() && (
          <ViewThemed style={styles.reviewBadge}>
            <TextThemed style={styles.reviewText}>
              {WordStatusMessage.REVIEW_NEEDED}
            </TextThemed>
          </ViewThemed>
        )}
      </ViewThemed>
    </ViewThemed>
  )
}

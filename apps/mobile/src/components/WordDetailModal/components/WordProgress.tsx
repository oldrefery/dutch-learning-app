import React from 'react'
import { ViewThemed, TextThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { styles } from '../styles'
import { WordStatusType } from '../types'

interface WordProgressProps {
  repetitionCount: number
  nextReviewDate: string | null
  easinessFactor: number | null
}

export default function WordProgress({
  repetitionCount,
  nextReviewDate,
  easinessFactor,
}: WordProgressProps) {
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
      <TextThemed style={styles.sectionTitle}>Progress</TextThemed>
      <ViewThemed
        style={styles.progressContainer}
        lightColor={Colors.light.backgroundSecondary}
        darkColor={Colors.dark.backgroundSecondary}
      >
        <TextThemed style={styles.progressText}>
          Repetitions: {repetitionCount}
        </TextThemed>
        <TextThemed style={styles.progressText}>
          Next review:{' '}
          {nextReviewDate
            ? new Date(nextReviewDate).toLocaleDateString()
            : 'N/A'}
        </TextThemed>
        <TextThemed style={styles.progressText}>
          Easiness factor: {easinessFactor?.toFixed(2) || 'N/A'}
        </TextThemed>
        <ViewThemed style={styles.statusContainer}>
          <ViewThemed
            style={[styles.statusDot, { backgroundColor: getStatusColor() }]}
          />
          <TextThemed style={styles.statusText}>{getStatusText()}</TextThemed>
        </ViewThemed>
      </ViewThemed>
    </ViewThemed>
  )
}

import React from 'react'
import { View, Text } from '@/components/Themed'
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
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Progress</Text>
      <View style={styles.progressContainer}>
        <Text style={styles.progressText}>Repetitions: {repetitionCount}</Text>
        <Text style={styles.progressText}>
          Next review:{' '}
          {nextReviewDate
            ? new Date(nextReviewDate).toLocaleDateString()
            : 'N/A'}
        </Text>
        <Text style={styles.progressText}>
          Easiness factor: {easinessFactor?.toFixed(2) || 'N/A'}
        </Text>
        <View style={styles.statusContainer}>
          <View
            style={[styles.statusDot, { backgroundColor: getStatusColor() }]}
          />
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>
      </View>
    </View>
  )
}

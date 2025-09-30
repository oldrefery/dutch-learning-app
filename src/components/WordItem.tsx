import React from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { WordStatusType } from '@/components/WordDetailModal/types'
import type { Word } from '@/types/database'

interface WordItemProps {
  word: Word
  index: number
  onPress: () => void
}

export default function WordItem({ word, index, onPress }: WordItemProps) {
  const getStatusColor = () => {
    if (word.repetition_count > 2) return Colors.success.DEFAULT // Green - mastered
    if (word.repetition_count > 0) return Colors.warning.DEFAULT // Yellow - learning
    return Colors.neutral[500] // Gray - new
  }

  const getStatusText = () => {
    if (word.repetition_count > 2) return WordStatusType.MASTERED
    if (word.repetition_count > 0) return WordStatusType.LEARNING
    return WordStatusType.NEW
  }

  const isDueForReview = new Date(word.next_review_date) <= new Date()

  return (
    <TouchableOpacity style={styles.wordItem} onPress={onPress}>
      <ViewThemed style={styles.wordContent}>
        <ViewThemed style={styles.wordHeader}>
          <TextThemed style={styles.wordText}>
            {word.dutch_original || word.dutch_lemma}
          </TextThemed>
          {word.article && (
            <TextThemed style={styles.articleText}>({word.article})</TextThemed>
          )}
        </ViewThemed>

        <TextThemed style={styles.translationText}>
          {word.translations.en?.[0] || 'No translation'}
        </TextThemed>
      </ViewThemed>

      <ViewThemed style={styles.accessoryContent}>
        <ViewThemed
          style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}
        >
          <TextThemed style={styles.statusText}>{getStatusText()}</TextThemed>
        </ViewThemed>
        {isDueForReview && (
          <ViewThemed style={styles.reviewBadge}>
            <TextThemed style={styles.reviewText}>Review</TextThemed>
          </ViewThemed>
        )}
      </ViewThemed>

      <Ionicons name="chevron-forward" size={20} color={Colors.neutral[400]} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  wordItem: {
    backgroundColor: Colors.background.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 60,
  },
  wordContent: {
    flex: 1,
  },
  wordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  wordText: {
    fontSize: 17,
    fontWeight: '400',
    color: Colors.neutral[900],
  },
  articleText: {
    fontSize: 15,
    color: Colors.neutral[500],
    marginLeft: 8,
  },
  translationText: {
    fontSize: 15,
    color: Colors.neutral[500],
  },
  accessoryContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
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

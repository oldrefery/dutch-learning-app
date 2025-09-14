import React from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Text, View } from '@/components/Themed'
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
      <View style={styles.wordNumber}>
        <Text style={styles.wordNumberText}>{index + 1}</Text>
      </View>
      <View style={styles.wordContent}>
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
            style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}
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

      <Ionicons name="chevron-forward" size={20} color={Colors.neutral[400]} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  wordItem: {
    backgroundColor: Colors.background.primary,
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: Colors.legacy.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
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
  wordContent: {
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

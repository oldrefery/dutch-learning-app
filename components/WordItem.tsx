import React from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Text, View } from '@/components/Themed'
import type { Word } from '@/types/database'

interface WordItemProps {
  word: Word
  index: number
  onPress: () => void
}

export default function WordItem({ word, index, onPress }: WordItemProps) {
  const getStatusColor = () => {
    if (word.repetition_count > 2) return '#10b981' // Green - mastered
    if (word.repetition_count > 0) return '#f59e0b' // Yellow - learning
    return '#6b7280' // Gray - new
  }

  const getStatusText = () => {
    if (word.repetition_count > 2) return 'Mastered'
    if (word.repetition_count > 0) return 'Learning'
    return 'New'
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

      <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  wordItem: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  wordNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  wordNumberText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
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
    color: '#111827',
  },
  articleText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
  },
  translationText: {
    fontSize: 14,
    color: '#6b7280',
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
    color: 'white',
  },
  reviewBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  reviewText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#92400e',
  },
})

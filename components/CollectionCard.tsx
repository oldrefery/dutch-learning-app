import React from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'
import { Text, View } from '@/components/Themed'
import type { Collection, Word } from '@/types/database'

interface CollectionCardProps {
  collection: Collection
  words: Word[]
  onPress: () => void
}

export default function CollectionCard({
  collection,
  words,
  onPress,
}: CollectionCardProps) {
  // Calculate real stats for this collection
  const collectionWords = words.filter(
    word => word.collection_id === collection.collection_id
  )

  const stats = {
    totalWords: collectionWords.length,
    masteredWords: collectionWords.filter(w => w.repetition_count > 2).length,
    wordsToReview: collectionWords.filter(
      w => new Date(w.next_review_date) <= new Date()
    ).length,
    progressPercentage:
      collectionWords.length > 0
        ? Math.round(
            (collectionWords.filter(w => w.repetition_count > 2).length /
              collectionWords.length) *
              100
          )
        : 0,
  }

  return (
    <TouchableOpacity style={styles.collectionCard} onPress={onPress}>
      <View style={styles.collectionHeader}>
        <Text style={styles.collectionName}>{collection.name}</Text>
        <Text style={styles.collectionStats}>
          {stats.totalWords} words • {stats.progressPercentage}% mastered
        </Text>
      </View>

      <View style={styles.collectionProgress}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${stats.progressPercentage}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {stats.masteredWords}/{stats.totalWords} mastered
        </Text>
      </View>

      {stats.wordsToReview > 0 && (
        <View style={styles.reviewBadge}>
          <Text style={styles.reviewBadgeText}>
            {stats.wordsToReview} for review
          </Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  collectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  collectionHeader: {
    marginBottom: 12,
  },
  collectionName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  collectionStats: {
    fontSize: 14,
    color: '#6b7280',
  },
  collectionProgress: {
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  reviewBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  reviewBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#92400e',
  },
})

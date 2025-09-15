import React from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
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
      <ViewThemed style={styles.collectionHeader}>
        <TextThemed style={styles.collectionName}>{collection.name}</TextThemed>
        <TextThemed style={styles.collectionStats}>
          {stats.totalWords} words • {stats.progressPercentage}% mastered
        </TextThemed>
      </ViewThemed>

      <ViewThemed style={styles.collectionProgress}>
        <ViewThemed style={styles.progressBar}>
          <ViewThemed
            style={[
              styles.progressFill,
              { width: `${stats.progressPercentage}%` },
            ]}
          />
        </ViewThemed>
        <TextThemed style={styles.progressText}>
          {stats.masteredWords}/{stats.totalWords} mastered
        </TextThemed>
      </ViewThemed>

      {stats.wordsToReview > 0 && (
        <ViewThemed style={styles.reviewBadge}>
          <TextThemed style={styles.reviewBadgeText}>
            {stats.wordsToReview} for review
          </TextThemed>
        </ViewThemed>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  collectionCard: {
    backgroundColor: Colors.background.primary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: Colors.legacy.black,
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
    color: Colors.neutral[900],
    marginBottom: 4,
  },
  collectionStats: {
    fontSize: 14,
    color: Colors.neutral[500],
  },
  collectionProgress: {
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: Colors.neutral[200],
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary.DEFAULT,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: Colors.neutral[500],
    textAlign: 'center',
  },
  reviewBadge: {
    backgroundColor: Colors.warning.light,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  reviewBadgeText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.warning.dark,
  },
})

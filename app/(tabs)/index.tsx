import React, { useState } from 'react'
import {
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import Toast from 'react-native-toast-message'
import { router } from 'expo-router'
import { Text, View } from '@/components/Themed'
import { useAppStore } from '@/stores/useAppStore'
import CreateCollectionModal from '@/components/CreateCollectionModal'
import type { Collection, Word } from '@/types/database'

// Constants to avoid string duplication
const FLEX_JUSTIFY_CONTENT = {
  SPACE_BETWEEN: 'space-between' as const,
} as const

interface CollectionCardProps {
  collection: Collection
  words: Word[]
  onPress: () => void
}

function CollectionCard({ collection, words, onPress }: CollectionCardProps) {
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
        <Text style={styles.collectionDate}>
          {new Date(collection.created_at).toLocaleDateString()}
        </Text>
      </View>
      <View style={styles.collectionStats}>
        <Text style={styles.statText}>{stats.totalWords} words</Text>
        <Text style={[styles.statText, styles.dueText]}>
          {stats.wordsToReview} due
        </Text>
        <Text style={[styles.statText, styles.masteredText]}>
          {stats.masteredWords} mastered
        </Text>
      </View>
    </TouchableOpacity>
  )
}

function StatsCard() {
  const { words } = useAppStore()

  const stats = {
    totalWords: words.length,
    wordsLearned: words.filter(w => w.repetition_count > 2).length,
    wordsForReview: words.filter(
      w => new Date(w.next_review_date) <= new Date()
    ).length,
    streakDays: 0, // TODO: implement actual streak calculation
  }

  return (
    <View style={styles.statsCard}>
      <Text style={styles.statsTitle}>Today&apos;s Progress</Text>
      <Text style={styles.statsSubtitle}>Across all collections</Text>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.totalWords}</Text>
          <Text style={styles.statLabel}>Total Words</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.wordsForReview}</Text>
          <Text style={styles.statLabel}>For Review</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.streakDays}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
      </View>
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${stats.totalWords > 0 ? (stats.wordsLearned / stats.totalWords) * 100 : 0}%`,
            },
          ]}
        />
      </View>
    </View>
  )
}

export default function CollectionsScreen() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const { collections, collectionsLoading, words, error, clearError } =
    useAppStore()

  const stats = {
    totalWords: words.length,
    wordsLearned: words.filter(w => w.repetition_count > 2).length,
    wordsForReview: words.filter(
      w => new Date(w.next_review_date) <= new Date()
    ).length,
    streakDays: 0, // TODO: implement actual streak calculation
  }

  const handleCollectionPress = (collection: Collection) => {
    router.push(`/collection/${collection.collection_id}`)
  }

  const handleStartReview = () => {
    if (stats.wordsForReview === 0) {
      Toast.show({
        type: 'info',
        text1: 'No Words',
        text2: 'No words are due for review right now!',
      })
      return
    }
    // Navigate to review screen
    router.push('/(tabs)/review')
  }

  const handleDismissError = () => {
    clearError()
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Error: {error.message}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleDismissError}
          >
            <Text style={styles.retryButtonText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <StatsCard />

      <View style={styles.reviewSection}>
        <TouchableOpacity
          style={styles.reviewButton}
          onPress={handleStartReview}
        >
          <Text style={styles.reviewButtonText}>Review All Collections</Text>
          <Text style={styles.reviewButtonSubtext}>
            {stats.wordsForReview} words ready for review
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.collectionsSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Collections</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowCreateModal(true)}
          >
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>
        {collectionsLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Loading collections...</Text>
          </View>
        ) : (
          <FlatList
            data={collections}
            keyExtractor={item => item.collection_id}
            renderItem={({ item }) => (
              <CollectionCard
                collection={item}
                words={words}
                onPress={() => handleCollectionPress(item)}
              />
            )}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No collections yet</Text>
                <Text style={styles.emptySubtext}>
                  Start by adding some words!
                </Text>
              </View>
            }
          />
        )}
      </View>

      <CreateCollectionModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCollectionCreated={() => {
          // Collection will be automatically added to the list via the store
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  statsCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  statsSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: FLEX_JUSTIFY_CONTENT.SPACE_BETWEEN,
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563eb',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  reviewSection: {
    marginBottom: 20,
  },
  reviewButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
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
  collectionsSection: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  collectionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  collectionHeader: {
    flexDirection: 'row',
    justifyContent: FLEX_JUSTIFY_CONTENT.SPACE_BETWEEN,
    alignItems: 'center',
    marginBottom: 8,
  },
  collectionName: {
    fontSize: 16,
    fontWeight: '600',
  },
  collectionDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  collectionStats: {
    flexDirection: 'row',
    justifyContent: FLEX_JUSTIFY_CONTENT.SPACE_BETWEEN,
  },
  statText: {
    fontSize: 14,
    color: '#4b5563',
  },
  dueText: {
    color: '#dc2626',
    fontWeight: '500',
  },
  masteredText: {
    color: '#16a34a',
    fontWeight: '500',
  },
  // Error states
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  // Loading states
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
  },
  // Empty states
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#374151',
    fontWeight: '500',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
})

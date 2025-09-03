import React from 'react'
import { StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native'
import { Text, View } from '@/components/Themed'
import { mockCollections, getMockCollectionStats, getMockOverallStats } from '@/data/mockData'

interface CollectionCardProps {
  collection: typeof mockCollections[0]
  onPress: () => void
}

function CollectionCard({ collection, onPress }: CollectionCardProps) {
  const stats = getMockCollectionStats(collection.collection_id)

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
          {stats.dueForReview} due
        </Text>
        <Text style={[styles.statText, styles.masteredText]}>
          {stats.masteredWords} mastered
        </Text>
      </View>
    </TouchableOpacity>
  )
}

function StatsCard() {
  const stats = getMockOverallStats()

  return (
    <View style={styles.statsCard}>
      <Text style={styles.statsTitle}>Today's Progress</Text>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.dailyProgress}</Text>
          <Text style={styles.statLabel}>Reviewed</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.dailyGoal}</Text>
          <Text style={styles.statLabel}>Daily Goal</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.currentStreak}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
      </View>
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${(stats.dailyProgress / stats.dailyGoal) * 100}%` }
          ]}
        />
      </View>
    </View>
  )
}

export default function CollectionsScreen() {
  const stats = getMockOverallStats()

  const handleCollectionPress = (collection: typeof mockCollections[0]) => {
    Alert.alert(
      collection.name,
      `This will open collection details\n\nStats:\n• ${getMockCollectionStats(collection.collection_id).totalWords} total words\n• ${getMockCollectionStats(collection.collection_id).dueForReview} due for review`
    )
  }

  const handleStartReview = () => {
    Alert.alert(
      'Start Review',
      `You have ${stats.wordsForReview} words ready for review. Start session?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start', onPress: () => console.log('Starting review session') },
      ]
    )
  }

  return (
    <View style={styles.container}>
      <StatsCard />

      <View style={styles.reviewSection}>
        <TouchableOpacity style={styles.reviewButton} onPress={handleStartReview}>
          <Text style={styles.reviewButtonText}>
            Review {stats.wordsForReview} Words
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.collectionsSection}>
        <Text style={styles.sectionTitle}>My Collections</Text>
        <FlatList
          data={mockCollections}
          keyExtractor={(item) => item.collection_id}
          renderItem={({ item }) => (
            <CollectionCard
              collection={item}
              onPress={() => handleCollectionPress(item)}
            />
          )}
          showsVerticalScrollIndicator={false}
        />
      </View>
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
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    justifyContent: 'space-between',
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
    justifyContent: 'space-between',
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
});

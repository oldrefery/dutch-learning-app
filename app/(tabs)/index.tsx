import React, { useState } from 'react'
import { FlatList, ActivityIndicator, TouchableOpacity } from 'react-native'
import { ToastService } from '@/components/AppToast'
import { ToastMessageType } from '@/constants/ToastConstants'
import { router } from 'expo-router'
import { Text, View } from '@/components/Themed'
import { useAppStore } from '@/stores/useAppStore'
import CreateCollectionModal from '@/components/CreateCollectionModal'
import SwipeableCollectionCard from '@/components/SwipeableCollectionCard'
import StatsCard from '@/components/StatsCard'
import SectionHeader from '@/components/SectionHeader'
import ReviewButton from '@/components/ReviewButton'
import { styles } from '@/styles/CollectionsScreen.styles'
import type { Collection } from '@/types/database'

export default function CollectionsScreen() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const {
    collections,
    collectionsLoading,
    words,
    error,
    clearError,
    deleteCollection,
  } = useAppStore()

  const handleCollectionPress = (collection: Collection) => {
    router.push(`/collection/${collection.collection_id}`)
  }

  const handleDeleteCollection = async (collectionId: string) => {
    try {
      await deleteCollection(collectionId)
      ToastService.showCollectionSuccess('deleted')
    } catch {
      ToastService.showCollectionError('delete')
    }
  }

  const handleStartReview = () => {
    if (stats.wordsForReview === 0) {
      ToastService.showReviewMessage('no_words')
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

  const stats = {
    totalWords: words.length,
    masteredWords: words.filter(w => w.repetition_count > 2).length,
    wordsForReview: words.filter(
      w => new Date(w.next_review_date) <= new Date()
    ).length,
    streakDays: 0, // TODO: implement actual streak calculation
  }

  return (
    <View style={styles.container}>
      <StatsCard stats={stats} />

      <View style={styles.reviewSection}>
        <ReviewButton
          wordsForReview={stats.wordsForReview}
          onPress={handleStartReview}
        />
      </View>

      <View style={styles.collectionsSection}>
        <SectionHeader
          title="My Collections"
          showAddButton={true}
          onAddPress={() => setShowCreateModal(true)}
        />
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
              <SwipeableCollectionCard
                collection={item}
                words={words}
                onPress={() => handleCollectionPress(item)}
                onDelete={handleDeleteCollection}
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

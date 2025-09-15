import React, { useState } from 'react'
import { FlatList, ActivityIndicator, TouchableOpacity } from 'react-native'
import { ToastService } from '@/components/AppToast'
import { router } from 'expo-router'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
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
    // Navigate to the review screen
    router.push('/(tabs)/review')
  }

  const handleDismissError = () => {
    clearError()
  }

  if (error) {
    return (
      <ViewThemed style={styles.container}>
        <ViewThemed style={styles.errorContainer}>
          <TextThemed style={styles.errorText}>
            Error: {error.message}
          </TextThemed>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={handleDismissError}
          >
            <TextThemed style={styles.retryButtonText}>Dismiss</TextThemed>
          </TouchableOpacity>
        </ViewThemed>
      </ViewThemed>
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
    <ViewThemed style={styles.container}>
      <StatsCard stats={stats} loading={collectionsLoading} />

      <ViewThemed style={styles.reviewSection}>
        <ReviewButton
          wordsForReview={stats.wordsForReview}
          onPress={handleStartReview}
        />
      </ViewThemed>

      <ViewThemed style={styles.collectionsSection}>
        <SectionHeader
          title="My Collections"
          showAddButton={true}
          onAddPress={() => setShowCreateModal(true)}
        />
        {collectionsLoading ? (
          <ViewThemed style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary.DEFAULT} />
            <TextThemed style={styles.loadingText}>
              Loading collections...
            </TextThemed>
          </ViewThemed>
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
              <ViewThemed style={styles.emptyContainer}>
                <TextThemed style={styles.emptyText}>
                  No collections yet
                </TextThemed>
                <TextThemed style={styles.emptySubtext}>
                  Start by adding some words!
                </TextThemed>
              </ViewThemed>
            }
          />
        )}
      </ViewThemed>

      <CreateCollectionModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCollectionCreated={() => {
          // Collection will be automatically added to the list via the store
        }}
      />
    </ViewThemed>
  )
}

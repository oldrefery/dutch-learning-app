import React, { useState, useRef, useCallback } from 'react'
import {
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  useColorScheme,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PlatformBlurView } from '@/components/PlatformBlurView'
import * as Clipboard from 'expo-clipboard'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { router } from 'expo-router'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { useApplicationStore } from '@/stores/useApplicationStore'
import SwipeableCollectionCard from '@/components/SwipeableCollectionCard'
import { StatsCard } from '@/components/StatsCard'
import SectionHeader from '@/components/SectionHeader'
import { ROUTES } from '@/constants/Routes'
import { styles } from '@/styles/CollectionsScreen.styles'
import type { Collection } from '@/types/database'
import { calculateStreak } from '@/utils/streakUtils'
import { useReviewWordsCount } from '@/hooks/useReviewWordsCount'
import { CreateCollectionSheet } from '@/components/glass/modals/CreateCollectionSheet'
import { RenameCollectionSheet } from '@/components/glass/modals/RenameCollectionSheet'
import { ImportCollectionSheet } from '@/components/glass/modals/ImportCollectionSheet'

export default function CollectionsScreen() {
  const insets = useSafeAreaInsets()
  const colorScheme = useColorScheme() ?? 'light'
  const [refreshing, setRefreshing] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [renameModal, setRenameModal] = useState<{
    visible: boolean
    collectionId: string
    currentName: string
  }>({
    visible: false,
    collectionId: '',
    currentName: '',
  })

  const renameModalPromiseRef = useRef<{
    resolve: () => void
    reject: (error: Error) => void
  } | null>(null)
  const {
    collections,
    collectionsLoading,
    words,
    error,
    clearError,
    deleteCollection,
    renameCollection,
    shareCollection,
    getCollectionShareStatus,
    unshareCollection,
    userAccessLevel,
    fetchWords,
    fetchCollections,
  } = useApplicationStore()

  const { refreshCount } = useReviewWordsCount()

  const handleCollectionPress = (collection: Collection) => {
    router.push(ROUTES.COLLECTION_DETAIL(collection.collection_id))
  }

  const handleDeleteCollection = async (collectionId: string) => {
    try {
      // Clear any previous errors
      clearError()

      await deleteCollection(collectionId)

      // Check if there was a validation error (like trying to delete a last collection)
      const currentError = useApplicationStore.getState().error
      if (currentError) {
        ToastService.show(currentError.message, ToastType.ERROR)
        clearError()
        return
      }

      ToastService.show('Collection deleted', ToastType.SUCCESS)
    } catch {
      ToastService.show(
        'Failed to delete collection. Please try again.',
        ToastType.ERROR
      )
    }
  }

  const handleRenameCollection = async (
    collectionId: string,
    currentName: string
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      setRenameModal({
        visible: true,
        collectionId,
        currentName,
      })

      // Store resolve/reject for later use
      renameModalPromiseRef.current = { resolve, reject }
    })
  }

  const handleModalRename = async (newName: string) => {
    try {
      await renameCollection(renameModal.collectionId, newName)
      ToastService.show(
        `Collection "${newName}" renamed successfully`,
        ToastType.SUCCESS
      )

      // Resolve the promise to notify SwipeableCollectionCard
      if (renameModalPromiseRef.current) {
        renameModalPromiseRef.current.resolve()
        renameModalPromiseRef.current = null
      }
    } catch (error) {
      ToastService.show(
        'Failed to update collection. Please try again.',
        ToastType.ERROR
      )

      // Reject the promise
      if (renameModalPromiseRef.current) {
        renameModalPromiseRef.current.reject(
          new Error('Failed to rename collection')
        )
        renameModalPromiseRef.current = null
      }
      throw error
    }
  }

  const handleCloseRenameModal = () => {
    // If the modal is closed without completing rename, reject the promise
    if (renameModalPromiseRef.current) {
      const cancelError = new Error('Rename cancelled')
      cancelError.name = 'CancelledError'
      renameModalPromiseRef.current.reject(cancelError)
      renameModalPromiseRef.current = null
    }

    setRenameModal({
      visible: false,
      collectionId: '',
      currentName: '',
    })
  }

  const handleStartReview = () => {
    if (stats.wordsForReview === 0) {
      ToastService.show(
        'No words are due for review right now!',
        ToastType.INFO
      )
      return
    }
    // Navigate to the review screen
    router.push(ROUTES.TABS.REVIEW)
  }

  const handleDismissError = () => {
    clearError()
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([refreshCount(), fetchWords(), fetchCollections()])
    } finally {
      setRefreshing(false)
    }
  }, [refreshCount, fetchWords, fetchCollections])

  const handleShareCollection = async (collectionId: string) => {
    try {
      const shareToken = await shareCollection(collectionId)
      if (shareToken) {
        await Clipboard.setStringAsync(shareToken)
        ToastService.show(
          'Collection shared and code copied!',
          ToastType.SUCCESS
        )
      }
    } catch {
      ToastService.show(
        'Failed to share collection. Please try again.',
        ToastType.ERROR
      )
    }
  }

  const handleCopyCollectionCode = async (collectionId: string) => {
    try {
      const shareStatus = await getCollectionShareStatus(collectionId)
      if (shareStatus?.share_token) {
        await Clipboard.setStringAsync(shareStatus.share_token)
        ToastService.show('Collection code copied!', ToastType.SUCCESS)
      } else {
        ToastService.show('No share code available', ToastType.ERROR)
      }
    } catch {
      ToastService.show(
        'Failed to copy collection code. Please try again.',
        ToastType.ERROR
      )
    }
  }

  const handleStopSharingCollection = async (collectionId: string) => {
    try {
      const success = await unshareCollection(collectionId)
      if (success) {
        ToastService.show('Collection sharing stopped', ToastType.SUCCESS)
      } else {
        ToastService.show('Failed to stop sharing collection', ToastType.ERROR)
      }
    } catch {
      ToastService.show(
        'Failed to stop sharing collection. Please try again.',
        ToastType.ERROR
      )
    }
  }

  if (error) {
    return (
      <ViewThemed
        style={[
          styles.container,
          {
            paddingTop: insets.top,
          },
        ]}
      >
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

  const collectionIdSet = new Set(
    collections.map(collection => collection.collection_id)
  )
  const validWords = words.filter(
    w => w && w.collection_id && collectionIdSet.has(w.collection_id)
  )
  const stats = {
    totalWords: validWords.length,
    masteredWords: validWords.filter(
      w => w.repetition_count && w.repetition_count > 2
    ).length,
    wordsForReview: validWords.filter(
      w => w.next_review_date && new Date(w.next_review_date) <= new Date()
    ).length,
    streakDays: calculateStreak(validWords),
  }

  return (
    <ViewThemed
      testID="screen-collections"
      style={[
        styles.container,
        {
          paddingTop: insets.top,
        },
      ]}
    >
      <StatsCard
        stats={stats}
        loading={collectionsLoading}
        onStartReview={handleStartReview}
      />

      <ViewThemed style={styles.collectionsSection}>
        <SectionHeader
          title="Collections"
          showAddButton={userAccessLevel === 'full_access'}
          addButtonText="Create"
          onAddPress={() => setShowCreateModal(true)}
          showImportButton={true}
          onImportPress={() => setShowImportModal(true)}
        />
        {collectionsLoading ? (
          <ViewThemed style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary.DEFAULT} />
            <TextThemed style={styles.loadingText}>
              Loading collections...
            </TextThemed>
          </ViewThemed>
        ) : (
          <ViewThemed style={styles.collectionsListContainer}>
            <PlatformBlurView
              style={styles.collectionsListBlur}
              intensity={100}
              tint={colorScheme === 'dark' ? 'dark' : 'light'}
              blurMethod={'dimezisBlurView'}
            >
              <ViewThemed
                style={[
                  styles.collectionsListContent,
                  {
                    backgroundColor:
                      colorScheme === 'dark'
                        ? Colors.transparent.iosDarkSurface95
                        : Colors.transparent.clear,
                    borderColor:
                      colorScheme === 'dark'
                        ? Colors.transparent.white10
                        : Colors.transparent.black05,
                  },
                ]}
              >
                {(() => {
                  const filteredCollections = collections.filter(
                    c => c && c.collection_id
                  )
                  const safedWords = words.filter(
                    w => w && typeof w === 'object'
                  )
                  return (
                    <FlatList
                      data={filteredCollections}
                      keyExtractor={item => item.collection_id}
                      style={{ backgroundColor: Colors.transparent.clear }}
                      contentContainerStyle={{
                        backgroundColor: Colors.transparent.clear,
                      }}
                      renderItem={({ item, index }) => {
                        // Skip rendering if collection data is invalid
                        if (!item || !item.collection_id) {
                          return null
                        }
                        const isLast = index === filteredCollections.length - 1
                        return (
                          <ViewThemed
                            lightColor={Colors.transparent.clear}
                            darkColor={Colors.transparent.clear}
                          >
                            <SwipeableCollectionCard
                              collection={item}
                              words={safedWords}
                              onPress={() => handleCollectionPress(item)}
                              onDelete={handleDeleteCollection}
                              onRename={handleRenameCollection}
                              onShare={handleShareCollection}
                              onCopyCode={handleCopyCollectionCode}
                              onStopSharing={handleStopSharingCollection}
                            />
                            {!isLast && (
                              <ViewThemed
                                style={styles.separator}
                                lightColor={Colors.light.separator}
                                darkColor={Colors.dark.separator}
                              />
                            )}
                          </ViewThemed>
                        )
                      }}
                      showsVerticalScrollIndicator={false}
                      refreshControl={
                        <RefreshControl
                          refreshing={refreshing}
                          onRefresh={onRefresh}
                          colors={[Colors.primary.DEFAULT]}
                          tintColor={Colors.primary.DEFAULT}
                          progressBackgroundColor={
                            colorScheme === 'dark'
                              ? Colors.dark.backgroundSecondary
                              : Colors.background.primary
                          }
                        />
                      }
                      ListEmptyComponent={
                        <ViewThemed
                          style={styles.emptyContainer}
                          lightColor={Colors.transparent.clear}
                          darkColor={Colors.transparent.clear}
                        >
                          <TextThemed style={styles.emptyText}>
                            No collections yet
                          </TextThemed>
                          <TextThemed style={styles.emptySubtext}>
                            Start by adding some words!
                          </TextThemed>
                        </ViewThemed>
                      }
                    />
                  )
                })()}
              </ViewThemed>
            </PlatformBlurView>
          </ViewThemed>
        )}
      </ViewThemed>

      <CreateCollectionSheet
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCollectionCreated={() => {
          // Collection will be automatically added to the list via the store
        }}
      />

      <RenameCollectionSheet
        visible={renameModal.visible}
        currentName={renameModal.currentName}
        onClose={handleCloseRenameModal}
        onRename={handleModalRename}
      />

      <ImportCollectionSheet
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
    </ViewThemed>
  )
}

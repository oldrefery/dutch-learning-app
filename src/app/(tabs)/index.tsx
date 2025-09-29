import React, { useState, useRef } from 'react'
import { FlatList, ActivityIndicator, TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Clipboard from 'expo-clipboard'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { router } from 'expo-router'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { useApplicationStore } from '@/stores/useApplicationStore'
import CreateCollectionModal from '@/components/CreateCollectionModal'
import RenameCollectionModal from '@/components/RenameCollectionModal'
import ImportByTokenModal from '@/components/ImportByTokenModal'
import SwipeableCollectionCard from '@/components/SwipeableCollectionCard'
import StatsCard from '@/components/StatsCard'
import SectionHeader from '@/components/SectionHeader'
import ReviewButton from '@/components/ReviewButton'
import { ROUTES } from '@/constants/Routes'
import { styles } from '@/styles/CollectionsScreen.styles'
import type { Collection } from '@/types/database'

export default function CollectionsScreen() {
  const insets = useSafeAreaInsets()
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
  } = useApplicationStore()

  const handleCollectionPress = (collection: Collection) => {
    router.push(ROUTES.COLLECTION_DETAIL(collection.collection_id))
  }

  const handleDeleteCollection = async (collectionId: string) => {
    try {
      await deleteCollection(collectionId)
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
            paddingBottom: insets.bottom, // Add extra space for tab bar
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

  const stats = {
    totalWords: words.length,
    masteredWords: words.filter(w => w.repetition_count > 2).length,
    wordsForReview: words.filter(
      w => new Date(w.next_review_date) <= new Date()
    ).length,
    streakDays: 0, // TODO: implement actual streak calculation
  }

  return (
    <ViewThemed
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 80, // Add extra space for tab bar
        },
      ]}
    >
      <StatsCard stats={stats} loading={collectionsLoading} />

      <ViewThemed style={styles.reviewSection}>
        <ReviewButton
          wordsForReview={stats.wordsForReview}
          onPress={handleStartReview}
        />
      </ViewThemed>

      <ViewThemed style={styles.collectionsSection}>
        <SectionHeader
          title="Collections"
          showAddButton={true}
          addButtonText="Create Collection"
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
          <FlatList
            data={collections}
            keyExtractor={item => item.collection_id}
            renderItem={({ item }) => (
              <SwipeableCollectionCard
                collection={item}
                words={words}
                onPress={() => handleCollectionPress(item)}
                onDelete={handleDeleteCollection}
                onRename={handleRenameCollection}
                onShare={handleShareCollection}
                onCopyCode={handleCopyCollectionCode}
                onStopSharing={handleStopSharingCollection}
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

      <RenameCollectionModal
        visible={renameModal.visible}
        currentName={renameModal.currentName}
        onClose={handleCloseRenameModal}
        onRename={handleModalRename}
      />

      <ImportByTokenModal
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
    </ViewThemed>
  )
}

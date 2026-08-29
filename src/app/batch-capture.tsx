import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, StyleSheet } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BatchCaptureComposer } from '@/components/BatchCapture/BatchCaptureComposer'
import { BatchCaptureQueue } from '@/components/BatchCapture/BatchCaptureQueue'
import { useBatchCaptureProcessor } from '@/components/BatchCapture/useBatchCaptureProcessor'
import { CollectionSelectorSheet } from '@/components/glass/modals/CollectionSelectorSheet'
import { ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { useCollections } from '@/hooks/useCollections'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useBatchCaptureStore } from '@/stores/useBatchCaptureStore'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { getNextBatchCaptureItem } from '@/utils/batchCapture'
import { useNetworkStatus } from '@/utils/network'

export default function BatchCaptureScreen() {
  const insets = useSafeAreaInsets()
  const colorScheme = useNormalizedColorScheme()
  const isDarkMode = colorScheme === 'dark'
  const { isConnected, isLoading: isNetworkLoading } = useNetworkStatus()
  const { collections, collectionsLoading } = useCollections()
  const { currentUserId } = useApplicationStore()
  const [showCollectionSelector, setShowCollectionSelector] = useState(false)
  const [isHydrated, setIsHydrated] = useState(
    useBatchCaptureStore.persist.hasHydrated()
  )

  const {
    targetCollectionId,
    items,
    isPaused,
    activeItemId,
    ensureOwner,
    setTargetCollectionId,
    start,
    pause,
    skipItem,
    retryItem,
    cancelRemaining,
    recoverInterruptedItems,
    clearQueue,
  } = useBatchCaptureStore()

  const selectedCollection = useMemo(
    () =>
      collections.find(
        collection => collection.collection_id === targetCollectionId
      ) ?? null,
    [collections, targetCollectionId]
  )
  const { openReview, processItem } = useBatchCaptureProcessor({
    currentUserId,
    isConnected,
    collections,
    targetCollectionId,
  })

  useEffect(() => {
    if (isHydrated) return
    return useBatchCaptureStore.persist.onFinishHydration(() => {
      setIsHydrated(true)
    })
  }, [isHydrated])

  useFocusEffect(
    useCallback(() => {
      if (!isHydrated || !currentUserId) return
      ensureOwner(currentUserId)
      recoverInterruptedItems()
    }, [currentUserId, ensureOwner, isHydrated, recoverInterruptedItems])
  )

  useEffect(() => {
    if (!isHydrated || targetCollectionId || collections.length === 0) return
    const lastCollectionId =
      useSettingsStore.getState().lastSelectedCollectionId
    const resolvedId = collections.some(
      collection => collection.collection_id === lastCollectionId
    )
      ? lastCollectionId
      : collections[0].collection_id
    setTargetCollectionId(resolvedId)
  }, [collections, isHydrated, setTargetCollectionId, targetCollectionId])

  useEffect(() => {
    if (!isHydrated || isPaused || activeItemId || isConnected !== true) {
      return
    }

    const nextItem = getNextBatchCaptureItem(items)
    if (nextItem) void processItem(nextItem)
  }, [activeItemId, isConnected, isHydrated, isPaused, items, processItem])

  const handleAnalyzeDuplicate = useCallback(
    (itemId: string) => {
      const item = useBatchCaptureStore
        .getState()
        .items.find(candidate => candidate.id === itemId)
      if (!item) return
      start()
      openReview(item)
    },
    [openReview, start]
  )

  const handleRetry = useCallback(
    (itemId: string) => {
      retryItem(itemId)
      start()
    },
    [retryItem, start]
  )

  const handleSkip = useCallback(
    (itemId: string) => {
      skipItem(itemId)
      start()
    },
    [skipItem, start]
  )

  const handleCollectionSelect = useCallback(
    (collection: (typeof collections)[number] | null) => {
      const resolvedId =
        collection?.collection_id ?? collections[0]?.collection_id ?? null
      setTargetCollectionId(resolvedId)
      useSettingsStore.getState().setLastSelectedCollectionId(resolvedId)
    },
    [collections, setTargetCollectionId]
  )

  if (!isHydrated) {
    return (
      <ViewThemed style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color={isDarkMode ? Colors.primary.darkMode : Colors.primary.DEFAULT}
        />
      </ViewThemed>
    )
  }

  return (
    <ViewThemed
      testID="screen-batch-capture"
      style={[styles.container, { paddingBottom: insets.bottom + 12 }]}
    >
      {items.length === 0 ? (
        <BatchCaptureComposer
          currentUserId={currentUserId}
          colorScheme={colorScheme}
          selectedCollection={selectedCollection}
          targetCollectionId={targetCollectionId}
          onOpenCollectionSelector={() => setShowCollectionSelector(true)}
        />
      ) : (
        <BatchCaptureQueue
          items={items}
          colorScheme={colorScheme}
          selectedCollection={selectedCollection}
          isConnected={isConnected}
          isNetworkLoading={isNetworkLoading}
          isPaused={isPaused}
          activeItemId={activeItemId}
          onOpenCollectionSelector={() => setShowCollectionSelector(true)}
          onStart={start}
          onPause={pause}
          onCancelRemaining={cancelRemaining}
          onClear={clearQueue}
          onAnalyzeDuplicate={handleAnalyzeDuplicate}
          onRetry={handleRetry}
          onSkip={handleSkip}
        />
      )}

      <CollectionSelectorSheet
        visible={showCollectionSelector}
        onClose={() => setShowCollectionSelector(false)}
        onSelect={handleCollectionSelect}
        collections={collections}
        selectedCollectionId={targetCollectionId}
        loading={collectionsLoading}
      />
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

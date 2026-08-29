import React, { useCallback } from 'react'
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native'
import { CollectionSelector } from '@/components/AddWordScreen/components/CollectionSelector'
import { BatchCaptureQueueItem } from './BatchCaptureQueueItem'
import { TextThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import type { BatchCaptureItem } from '@/types/BatchCaptureTypes'
import type { Collection } from '@/types/database'
import { isBatchCaptureFinished } from '@/utils/batchCapture'

interface BatchCaptureQueueProps {
  items: BatchCaptureItem[]
  colorScheme: 'light' | 'dark'
  selectedCollection: Collection | null
  isConnected: boolean | null
  isNetworkLoading: boolean
  isPaused: boolean
  activeItemId: string | null
  onOpenCollectionSelector: () => void
  onStart: () => void
  onPause: () => void
  onCancelRemaining: () => void
  onClear: () => void
  onAnalyzeDuplicate: (itemId: string) => void
  onRetry: (itemId: string) => void
  onSkip: (itemId: string) => void
}

export const BatchCaptureQueue = ({
  items,
  colorScheme,
  selectedCollection,
  isConnected,
  isNetworkLoading,
  isPaused,
  activeItemId,
  onOpenCollectionSelector,
  onStart,
  onPause,
  onCancelRemaining,
  onClear,
  onAnalyzeDuplicate,
  onRetry,
  onSkip,
}: BatchCaptureQueueProps) => {
  const isDarkMode = colorScheme === 'dark'
  const finished = isBatchCaptureFinished(items)
  const completedCount = items.filter(
    item => item.status === 'completed'
  ).length
  const resolvedCount = items.filter(item =>
    ['completed', 'skipped', 'cancelled'].includes(item.status)
  ).length
  const primaryColor = isDarkMode
    ? Colors.primary.darkMode
    : Colors.primary.DEFAULT
  const borderColor = isDarkMode ? Colors.dark.border : Colors.light.border

  const renderItem = useCallback(
    ({ item }: { item: BatchCaptureItem }) => (
      <BatchCaptureQueueItem
        item={item}
        onAnalyzeDuplicate={onAnalyzeDuplicate}
        onRetry={onRetry}
        onSkip={onSkip}
      />
    ),
    [onAnalyzeDuplicate, onRetry, onSkip]
  )

  return (
    <FlatList
      testID="batch-capture-queue"
      data={items}
      keyExtractor={item => item.id}
      renderItem={renderItem}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={
        <View style={styles.queueHeader}>
          <TextThemed style={styles.title}>Review queue</TextThemed>
          <TextThemed
            testID="batch-progress-summary"
            style={styles.description}
            lightColor={Colors.light.textSecondary}
            darkColor={Colors.dark.textSecondary}
          >
            {resolvedCount} of {items.length} resolved · {completedCount} saved
          </TextThemed>
          {!isNetworkLoading && isConnected === false && (
            <TextThemed
              testID="batch-offline-message"
              style={[
                styles.offlineMessage,
                {
                  color: isDarkMode
                    ? Colors.warning.dark
                    : Colors.warning.DEFAULT,
                },
              ]}
            >
              Offline. Pending items stay queued and will resume when the
              connection returns.
            </TextThemed>
          )}
          <CollectionSelector
            selectedCollection={selectedCollection}
            onPress={onOpenCollectionSelector}
            colorScheme={colorScheme}
          />
          <View style={styles.controls}>
            {!finished && (
              <TouchableOpacity
                testID={isPaused ? 'start-batch-button' : 'pause-batch-button'}
                accessibilityRole="button"
                disabled={Boolean(activeItemId)}
                onPress={isPaused ? onStart : onPause}
                style={[
                  styles.primaryButton,
                  styles.controlButton,
                  { backgroundColor: primaryColor },
                  Boolean(activeItemId) && styles.disabled,
                ]}
              >
                <TextThemed
                  style={styles.primaryButtonText}
                  lightColor={Colors.legacy.white}
                  darkColor={Colors.legacy.white}
                >
                  {isPaused ? 'Start / Resume' : 'Pause'}
                </TextThemed>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              testID={finished ? 'clear-batch-button' : 'cancel-batch-button'}
              accessibilityRole="button"
              disabled={Boolean(activeItemId)}
              onPress={finished ? onClear : onCancelRemaining}
              style={[
                styles.secondaryButton,
                { borderColor },
                Boolean(activeItemId) && styles.disabled,
              ]}
            >
              <TextThemed style={styles.secondaryButtonText}>
                {finished ? 'Clear queue' : 'Cancel remaining'}
              </TextThemed>
            </TouchableOpacity>
          </View>
        </View>
      }
    />
  )
}

const styles = StyleSheet.create({
  listContent: {
    padding: 16,
    paddingBottom: 28,
  },
  separator: {
    height: 10,
  },
  queueHeader: {
    gap: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  description: {
    fontSize: 15,
    lineHeight: 21,
  },
  offlineMessage: {
    fontSize: 14,
    lineHeight: 19,
  },
  controls: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  controlButton: {
    flex: 1,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    minHeight: 50,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.45,
  },
})

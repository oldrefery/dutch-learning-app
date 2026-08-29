import React, { memo } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import type {
  BatchCaptureItem,
  BatchCaptureItemStatus,
} from '@/types/BatchCaptureTypes'

interface BatchCaptureQueueItemProps {
  item: BatchCaptureItem
  onAnalyzeDuplicate: (itemId: string) => void
  onRetry: (itemId: string) => void
  onSkip: (itemId: string) => void
}

const STATUS_LABELS: Record<BatchCaptureItemStatus, string> = {
  queued: 'Queued',
  checking_duplicate: 'Checking duplicate',
  possible_duplicate: 'Possible duplicate',
  analyzing: 'Analyzing',
  awaiting_review: 'Awaiting review',
  failed: 'Needs attention',
  completed: 'Saved',
  skipped: 'Skipped',
  cancelled: 'Cancelled',
}

const ACTIVE_STATUSES: BatchCaptureItemStatus[] = [
  'checking_duplicate',
  'analyzing',
]

const getStatusColor = (
  status: BatchCaptureItemStatus,
  isDarkMode: boolean
): string => {
  if (status === 'completed') {
    return isDarkMode ? Colors.success.dark : Colors.success.DEFAULT
  }
  if (status === 'failed' || status === 'possible_duplicate') {
    return isDarkMode ? Colors.warning.dark : Colors.warning.DEFAULT
  }
  if (status === 'cancelled' || status === 'skipped') {
    return isDarkMode ? Colors.dark.textTertiary : Colors.neutral[500]
  }
  return isDarkMode ? Colors.primary.darkMode : Colors.primary.DEFAULT
}

export const BatchCaptureQueueItem = memo(
  ({
    item,
    onAnalyzeDuplicate,
    onRetry,
    onSkip,
  }: BatchCaptureQueueItemProps) => {
    const colorScheme = useNormalizedColorScheme()
    const isDarkMode = colorScheme === 'dark'
    const statusColor = getStatusColor(item.status, isDarkMode)
    const isActive = ACTIVE_STATUSES.includes(item.status)

    return (
      <View
        testID={`batch-item-${item.sourceLine}`}
        style={[
          styles.container,
          {
            backgroundColor: isDarkMode
              ? Colors.dark.backgroundSecondary
              : Colors.light.backgroundSecondary,
            borderColor: isDarkMode ? Colors.dark.border : Colors.light.border,
          },
        ]}
      >
        <View style={styles.headingRow}>
          <View style={styles.wordContainer}>
            <TextThemed style={styles.word}>{item.dutchText}</TextThemed>
            {item.translationHint && (
              <TextThemed
                style={styles.hint}
                lightColor={Colors.light.textSecondary}
                darkColor={Colors.dark.textSecondary}
              >
                Hint: {item.translationHint}
              </TextThemed>
            )}
          </View>
          <View style={styles.statusRow}>
            {isActive ? (
              <ActivityIndicator size="small" color={statusColor} />
            ) : (
              <Ionicons
                name={
                  item.status === 'completed' ? 'checkmark-circle' : 'ellipse'
                }
                size={14}
                color={statusColor}
              />
            )}
            <TextThemed style={[styles.status, { color: statusColor }]}>
              {STATUS_LABELS[item.status]}
            </TextThemed>
          </View>
        </View>

        {item.duplicate && (
          <TextThemed
            style={styles.message}
            lightColor={Colors.light.textSecondary}
            darkColor={Colors.dark.textSecondary}
          >
            Already found in{' '}
            {item.duplicate.collectionName ?? 'your cloud data'}.
          </TextThemed>
        )}

        {item.error && (
          <TextThemed style={[styles.message, { color: statusColor }]}>
            {item.error}
          </TextThemed>
        )}

        {item.status === 'possible_duplicate' && (
          <View style={styles.actions}>
            <TouchableOpacity
              testID={`analyze-duplicate-${item.sourceLine}`}
              accessibilityRole="button"
              onPress={() => onAnalyzeDuplicate(item.id)}
              style={[styles.primaryAction, { backgroundColor: statusColor }]}
            >
              <TextThemed
                style={styles.primaryActionText}
                lightColor={Colors.legacy.white}
                darkColor={Colors.legacy.white}
              >
                Analyze anyway
              </TextThemed>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => onSkip(item.id)}
              style={styles.secondaryAction}
            >
              <TextThemed style={styles.secondaryActionText}>Skip</TextThemed>
            </TouchableOpacity>
          </View>
        )}

        {item.status === 'failed' && (
          <View style={styles.actions}>
            <TouchableOpacity
              testID={`retry-batch-item-${item.sourceLine}`}
              accessibilityRole="button"
              onPress={() => onRetry(item.id)}
              style={[styles.primaryAction, { backgroundColor: statusColor }]}
            >
              <TextThemed
                style={styles.primaryActionText}
                lightColor={Colors.legacy.white}
                darkColor={Colors.legacy.white}
              >
                Retry
              </TextThemed>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => onSkip(item.id)}
              style={styles.secondaryAction}
            >
              <TextThemed style={styles.secondaryActionText}>Skip</TextThemed>
            </TouchableOpacity>
          </View>
        )}
      </View>
    )
  }
)

BatchCaptureQueueItem.displayName = 'BatchCaptureQueueItem'

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 8,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  wordContainer: {
    flex: 1,
    gap: 3,
  },
  word: {
    fontSize: 17,
    fontWeight: '600',
  },
  hint: {
    fontSize: 13,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  status: {
    fontSize: 12,
    fontWeight: '600',
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  primaryAction: {
    minHeight: 40,
    borderRadius: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryAction: {
    minHeight: 40,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActionText: {
    fontSize: 14,
    fontWeight: '600',
  },
})

import React from 'react'
import { TouchableOpacity, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import type { Collection } from '@/types/database'

interface CollectionSelectorProps {
  selectedCollection: Collection | null
  onPress: () => void
  colorScheme: 'light' | 'dark'
}

/**
 * Collection Selector Component
 *
 * Displays the currently selected collection and allows changing it.
 * Used in compact word input forms.
 */
export function CollectionSelector({
  selectedCollection,
  onPress,
  colorScheme,
}: CollectionSelectorProps) {
  return (
    <TouchableOpacity
      testID="collection-selector"
      onPress={onPress}
      style={styles.collectionRow}
    >
      <TextThemed
        style={[
          styles.label,
          {
            color:
              colorScheme === 'dark'
                ? Colors.dark.textSecondary
                : Colors.neutral[600],
          },
        ]}
      >
        Adding to:{' '}
      </TextThemed>
      <TextThemed
        style={[
          styles.collectionName,
          {
            color:
              colorScheme === 'dark'
                ? Colors.dark.tint
                : Colors.primary.DEFAULT,
          },
        ]}
      >
        {selectedCollection?.name || 'Select Collection'}
      </TextThemed>
      <Ionicons
        name="chevron-down"
        size={16}
        color={
          colorScheme === 'dark'
            ? Colors.dark.textSecondary
            : Colors.neutral[600]
        }
      />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  collectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  collectionName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
})

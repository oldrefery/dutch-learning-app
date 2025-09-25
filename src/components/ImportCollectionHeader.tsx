import React from 'react'
import { useColorScheme, StyleSheet } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import type { SharedCollectionWords } from '@/services/collectionSharingService'

interface ImportCollectionHeaderProps {
  sharedData: SharedCollectionWords
  selectedCount: number
  totalCount: number
  duplicateCount: number
}

export function ImportCollectionHeader({
  sharedData,
  selectedCount,
  totalCount,
  duplicateCount,
}: ImportCollectionHeaderProps) {
  const colorScheme = useColorScheme() ?? 'light'

  return (
    <ViewThemed
      style={[
        styles.header,
        {
          borderBottomColor:
            colorScheme === 'dark' ? Colors.dark.border : Colors.neutral[200],
        },
      ]}
    >
      <TextThemed style={styles.collectionName}>
        {sharedData.collection.name}
      </TextThemed>
      <TextThemed
        style={styles.selectionSummary}
        lightColor={Colors.neutral[600]}
        darkColor={Colors.dark.textSecondary}
      >
        {selectedCount} of {totalCount} words selected
        {duplicateCount > 0 && ` (${duplicateCount} already added)`}
      </TextThemed>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  header: {
    padding: 16,
    borderBottomWidth: 1,
  },
  collectionName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  selectionSummary: {
    fontSize: 14,
  },
})

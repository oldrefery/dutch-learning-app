import React from 'react'
import { StyleSheet } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { ImportCollectionSelector } from '@/components/ImportCollectionSelector'

interface Collection {
  collection_id: string
  name: string
}

interface ImportTargetSectionProps {
  collections: Collection[]
  targetCollectionId: string | null
  onSelectCollection: (collectionId: string) => void
}

export function ImportTargetSection({
  collections,
  targetCollectionId,
  onSelectCollection,
}: ImportTargetSectionProps) {
  return (
    <ViewThemed style={styles.targetSection}>
      <TextThemed style={styles.sectionTitle}>Import to Collection</TextThemed>
      <ImportCollectionSelector
        collections={collections}
        targetCollectionId={targetCollectionId}
        onSelectCollection={onSelectCollection}
      />
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  targetSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
})

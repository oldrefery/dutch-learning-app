import React from 'react'
import { TouchableOpacity, ActivityIndicator } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import CollectionSelector from '@/components/CollectionSelector'
import type { AddToCollectionSectionProps } from '../types/AddWordTypes'
import { addToCollectionStyles } from '../styles/AddToCollectionSection.styles'

export function AddToCollectionSection({
  selectedCollection,
  onCollectionSelect,
  onAddWord,
  isAdding,
}: AddToCollectionSectionProps) {
  return (
    <ViewThemed style={addToCollectionStyles.addToCollectionSection}>
      <TextThemed style={addToCollectionStyles.addToCollectionTitle}>
        Add to Collection
      </TextThemed>

      <ViewThemed style={addToCollectionStyles.collectionSelectorContainer}>
        <TextThemed style={addToCollectionStyles.collectionLabel}>
          Select Collection:
        </TextThemed>
        <CollectionSelector
          selectedCollectionId={selectedCollection?.collection_id || null}
          onCollectionSelect={onCollectionSelect}
        />
      </ViewThemed>

      <TouchableOpacity
        style={[
          addToCollectionStyles.addButton,
          isAdding && addToCollectionStyles.addButtonDisabled,
        ]}
        onPress={onAddWord}
        disabled={isAdding || !selectedCollection}
      >
        {isAdding ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <TextThemed style={addToCollectionStyles.addButtonText}>
            Add Word
          </TextThemed>
        )}
      </TouchableOpacity>
    </ViewThemed>
  )
}

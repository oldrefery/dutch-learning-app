import React from 'react'
import { TouchableOpacity, ActivityIndicator } from 'react-native'
import { Text, View } from '@/components/Themed'
import CollectionSelector from '@/components/CollectionSelector'
import type { AddToCollectionSectionProps } from '../types/AddWordTypes'
import { addToCollectionStyles } from '../styles/AddToCollectionSection.styles'

export function AddToCollectionSection({
  selectedCollection,
  onCollectionSelect,
  onAddWord,
  onCancel,
  isAdding,
  collections,
}: AddToCollectionSectionProps) {
  return (
    <View style={addToCollectionStyles.addToCollectionSection}>
      <Text style={addToCollectionStyles.addToCollectionTitle}>
        Add to Collection
      </Text>

      <View style={addToCollectionStyles.collectionSelectorContainer}>
        <Text style={addToCollectionStyles.collectionLabel}>
          Select Collection:
        </Text>
        <CollectionSelector
          selectedCollectionId={selectedCollection?.collection_id || null}
          onCollectionSelect={onCollectionSelect}
        />
      </View>

      <TouchableOpacity
        style={[
          addToCollectionStyles.addButton,
          isAdding && addToCollectionStyles.addButtonDisabled,
        ]}
        onPress={onAddWord}
        disabled={isAdding || !selectedCollection}
      >
        {isAdding ? (
          <View style={addToCollectionStyles.addButtonLoading}>
            <ActivityIndicator size="small" color="white" />
            <Text style={addToCollectionStyles.addButtonText}>Adding...</Text>
          </View>
        ) : (
          <Text style={addToCollectionStyles.addButtonText}>Add Word</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          addToCollectionStyles.cancelButton,
          isAdding && addToCollectionStyles.cancelButtonDisabled,
        ]}
        onPress={onCancel}
        disabled={isAdding}
      >
        <Text
          style={[
            addToCollectionStyles.cancelButtonText,
            isAdding && addToCollectionStyles.cancelButtonTextDisabled,
          ]}
        >
          Cancel & Start Over
        </Text>
      </TouchableOpacity>
    </View>
  )
}

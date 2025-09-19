import React from 'react'
import {
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
} from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import CollectionSelector from '@/components/CollectionSelector'
import { Colors } from '@/constants/Colors'
import type { AddToCollectionSectionProps } from '../types/AddWordTypes'
import { addToCollectionStyles } from '../styles/AddToCollectionSection.styles'

export function AddToCollectionSection({
  selectedCollection,
  onCollectionSelect,
  onAddWord,
  isAdding,
}: AddToCollectionSectionProps) {
  const colorScheme = useColorScheme() ?? 'light'
  return (
    <ViewThemed
      style={[
        addToCollectionStyles.addToCollectionSection,
        {
          borderTopColor:
            colorScheme === 'dark'
              ? Colors.dark.backgroundSecondary
              : Colors.neutral[200],
        },
      ]}
    >
      <TextThemed style={addToCollectionStyles.addToCollectionTitle}>
        Add to Collection
      </TextThemed>

      <ViewThemed style={addToCollectionStyles.collectionSelectorContainer}>
        <TextThemed
          style={addToCollectionStyles.collectionLabel}
          lightColor={Colors.neutral[700]}
          darkColor={Colors.dark.textSecondary}
        >
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
          {
            backgroundColor:
              colorScheme === 'dark'
                ? Colors.dark.tint
                : Colors.primary.DEFAULT,
          },
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

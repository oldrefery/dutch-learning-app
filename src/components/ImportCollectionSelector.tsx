import React from 'react'
import { TouchableOpacity, useColorScheme, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'

interface Collection {
  collection_id: string
  name: string
}

interface ImportCollectionSelectorProps {
  collections: Collection[]
  targetCollectionId: string | null
  onSelectCollection: (collectionId: string) => void
}

export function ImportCollectionSelector({
  collections,
  targetCollectionId,
  onSelectCollection,
}: ImportCollectionSelectorProps) {
  const colorScheme = useColorScheme() ?? 'light'

  if (collections.length === 0) {
    return (
      <ViewThemed style={styles.noCollectionsMessage}>
        <Ionicons
          name="folder-outline"
          size={32}
          color={
            colorScheme === 'dark'
              ? Colors.dark.textTertiary
              : Colors.neutral[400]
          }
        />
        <TextThemed
          style={styles.noCollectionsText}
          lightColor={Colors.neutral[600]}
          darkColor={Colors.dark.textSecondary}
        >
          No collections found. Create a collection first to import words.
        </TextThemed>
      </ViewThemed>
    )
  }

  return (
    <ViewThemed style={styles.collectionSelector}>
      {collections.map(collection => (
        <TouchableOpacity
          key={collection.collection_id}
          style={[
            styles.collectionOption,
            {
              backgroundColor:
                targetCollectionId === collection.collection_id
                  ? colorScheme === 'dark'
                    ? Colors.primary.dark
                    : Colors.primary.light
                  : 'transparent',
              borderColor:
                targetCollectionId === collection.collection_id
                  ? Colors.primary.DEFAULT
                  : colorScheme === 'dark'
                    ? Colors.dark.border
                    : Colors.neutral[300],
            },
          ]}
          onPress={() => onSelectCollection(collection.collection_id)}
        >
          <TextThemed
            style={[
              styles.collectionOptionText,
              targetCollectionId === collection.collection_id && {
                color: Colors.primary.DEFAULT,
                fontWeight: '600',
              },
            ]}
          >
            {collection.name}
          </TextThemed>
          {targetCollectionId === collection.collection_id && (
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={Colors.primary.DEFAULT}
            />
          )}
        </TouchableOpacity>
      ))}
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  collectionSelector: {
    gap: 8,
  },
  collectionOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  collectionOptionText: {
    fontSize: 16,
    flex: 1,
  },
  noCollectionsMessage: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noCollectionsText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
  },
})

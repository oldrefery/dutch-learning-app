import React from 'react'
import { useColorScheme, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import type { SharedCollectionWords } from '@/services/collectionSharingService'

interface SharedCollectionHeaderProps {
  sharedData: SharedCollectionWords
}

export function SharedCollectionHeader({
  sharedData,
}: SharedCollectionHeaderProps) {
  const colorScheme = useColorScheme() ?? 'light'

  return (
    <ViewThemed style={styles.header}>
      <ViewThemed style={styles.collectionInfo}>
        <TextThemed style={styles.collectionName}>
          {sharedData.collection.name}
        </TextThemed>
        <TextThemed
          style={styles.wordCount}
          lightColor={Colors.neutral[600]}
          darkColor={Colors.dark.textSecondary}
        >
          {sharedData.words.length} words
        </TextThemed>
      </ViewThemed>

      <ViewThemed style={styles.sharedIndicator}>
        <Ionicons
          name="share-outline"
          size={16}
          color={
            colorScheme === 'dark' ? Colors.dark.tint : Colors.primary.DEFAULT
          }
        />
        <TextThemed
          style={[
            styles.sharedText,
            {
              color:
                colorScheme === 'dark'
                  ? Colors.dark.tint
                  : Colors.primary.DEFAULT,
            },
          ]}
        >
          Shared Collection
        </TextThemed>
      </ViewThemed>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 20,
  },
  collectionInfo: {
    marginBottom: 12,
  },
  collectionName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  wordCount: {
    fontSize: 16,
  },
  sharedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'currentColor',
  },
  sharedText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 6,
  },
})

import React from 'react'
import { TouchableOpacity, useColorScheme, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { ROUTES } from '@/constants/Routes'
import type { Collection } from '@/types/database'

interface DuplicateWordData {
  word_id: string
  dutch_lemma: string
  collection_id: string
  part_of_speech: string
  article?: string
}

interface DuplicateBannerProps {
  duplicateWord: DuplicateWordData
  collections: Collection[]
  onNavigateToCollection?: () => void
}

export function DuplicateBanner({
  duplicateWord,
  collections,
  onNavigateToCollection,
}: DuplicateBannerProps) {
  const colorScheme = useColorScheme() ?? 'light'

  const collection = collections.find(
    c => c.collection_id === duplicateWord.collection_id
  )

  const handleNavigateToCollection = () => {
    onNavigateToCollection?.()
    const collectionPath = ROUTES.COLLECTION_DETAIL(duplicateWord.collection_id)
    router.push({
      pathname: collectionPath,
      params: { highlightWordId: duplicateWord.word_id },
    })
  }

  return (
    <ViewThemed
      style={[
        styles.container,
        {
          backgroundColor:
            colorScheme === 'dark'
              ? Colors.dark.backgroundSecondary
              : Colors.background.secondary,
          borderColor:
            colorScheme === 'dark' ? Colors.dark.tint : Colors.primary.DEFAULT,
          borderWidth: 2,
        },
      ]}
    >
      <ViewThemed style={styles.content}>
        <Ionicons
          name="information-circle"
          size={20}
          color={
            colorScheme === 'dark' ? Colors.dark.tint : Colors.primary.DEFAULT
          }
        />
        <TextThemed
          style={[
            styles.text,
            {
              color:
                colorScheme === 'dark' ? Colors.dark.text : Colors.neutral[800],
            },
          ]}
        >
          Already in{' '}
        </TextThemed>
        <TouchableOpacity
          onPress={handleNavigateToCollection}
          activeOpacity={0.7}
        >
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
            {collection?.name || 'Collection'}
          </TextThemed>
        </TouchableOpacity>
      </ViewThemed>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  collectionName: {
    fontSize: 16,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
})

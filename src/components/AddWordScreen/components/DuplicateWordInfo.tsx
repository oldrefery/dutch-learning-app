import React from 'react'
import { TouchableOpacity, useColorScheme } from 'react-native'
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

interface DuplicateWordInfoProps {
  duplicateWord: DuplicateWordData
  collections: Collection[]
  onDismiss: () => void
  onNavigateToCollection?: () => void
}

export function DuplicateWordInfo({
  duplicateWord,
  collections,
  onDismiss,
  onNavigateToCollection,
}: DuplicateWordInfoProps) {
  const colorScheme = useColorScheme() ?? 'light'

  const collection = collections.find(
    c => c.collection_id === duplicateWord.collection_id
  )
  const articleText = duplicateWord.article ? `${duplicateWord.article} ` : ''
  const wordDisplay = `${articleText}${duplicateWord.dutch_lemma}`

  const handleNavigateToCollection = () => {
    onNavigateToCollection?.()
    router.push({
      pathname: ROUTES.COLLECTION_DETAIL(duplicateWord.collection_id),
      params: { highlightWordId: duplicateWord.word_id },
    })
  }

  const containerStyle = {
    backgroundColor:
      colorScheme === 'dark'
        ? Colors.dark.backgroundSecondary
        : Colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor:
      colorScheme === 'dark'
        ? Colors.dark.backgroundTertiary
        : Colors.neutral[200],
  }

  const headerStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  }

  const titleStyle = {
    fontSize: 16,
    fontWeight: '600',
    color: colorScheme === 'dark' ? Colors.dark.text : Colors.neutral[800],
    flex: 1,
  }

  const infoRowStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  }

  const labelStyle = {
    fontSize: 14,
    color:
      colorScheme === 'dark' ? Colors.dark.textSecondary : Colors.neutral[600],
    marginRight: 8,
  }

  const valueStyle = {
    fontSize: 14,
    fontWeight: '500',
    color: colorScheme === 'dark' ? Colors.dark.text : Colors.neutral[800],
    flex: 1,
  }

  const actionRowStyle = {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  }

  const buttonStyle = {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  }

  const primaryButtonStyle = {
    ...buttonStyle,
    backgroundColor:
      colorScheme === 'dark' ? Colors.dark.tint : Colors.primary.DEFAULT,
  }

  const secondaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor:
      colorScheme === 'dark' ? Colors.dark.textSecondary : Colors.neutral[300],
  }

  const primaryButtonTextStyle = {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  }

  const secondaryButtonTextStyle = {
    color:
      colorScheme === 'dark' ? Colors.dark.textSecondary : Colors.neutral[600],
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  }

  return (
    <ViewThemed style={containerStyle}>
      <ViewThemed style={headerStyle}>
        <Ionicons
          name="information-circle"
          size={20}
          color={
            colorScheme === 'dark' ? Colors.dark.tint : Colors.primary.DEFAULT
          }
        />
        <TextThemed style={titleStyle}>Word Already Exists</TextThemed>
        <TouchableOpacity onPress={onDismiss}>
          <Ionicons
            name="close"
            size={20}
            color={
              colorScheme === 'dark'
                ? Colors.dark.textSecondary
                : Colors.neutral[500]
            }
          />
        </TouchableOpacity>
      </ViewThemed>

      <ViewThemed style={infoRowStyle}>
        <TextThemed style={labelStyle}>Word:</TextThemed>
        <TextThemed style={valueStyle}>
          {wordDisplay} ({duplicateWord.part_of_speech})
        </TextThemed>
      </ViewThemed>

      <ViewThemed style={infoRowStyle}>
        <TextThemed style={labelStyle}>Collection:</TextThemed>
        <TextThemed style={valueStyle}>
          {collection?.name || 'Unknown Collection'}
        </TextThemed>
      </ViewThemed>

      <ViewThemed style={actionRowStyle}>
        <TouchableOpacity
          style={primaryButtonStyle}
          onPress={handleNavigateToCollection}
        >
          <Ionicons name="folder-open" size={16} color="white" />
          <TextThemed style={primaryButtonTextStyle}>
            View Collection
          </TextThemed>
        </TouchableOpacity>

        <TouchableOpacity style={secondaryButtonStyle} onPress={onDismiss}>
          <Ionicons
            name="close"
            size={16}
            color={
              colorScheme === 'dark'
                ? Colors.dark.textSecondary
                : Colors.neutral[600]
            }
          />
          <TextThemed style={secondaryButtonTextStyle}>Dismiss</TextThemed>
        </TouchableOpacity>
      </ViewThemed>
    </ViewThemed>
  )
}

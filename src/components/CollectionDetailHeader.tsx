import React from 'react'
import {
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import type { Collection } from '@/types/database'

interface CollectionDetailHeaderProps {
  collection: Collection | undefined
  isSharing: boolean
  onCopyCode: () => void
  onShare: () => void
  onStopSharing: () => void
}

export default function CollectionDetailHeader({
  collection,
  isSharing,
  onCopyCode,
  onShare,
  onStopSharing,
}: CollectionDetailHeaderProps) {
  const colorScheme = useColorScheme() ?? 'light'

  const renderCopyButton = () => (
    <TouchableOpacity
      onPress={onCopyCode}
      disabled={isSharing || !collection?.collection_id}
      style={[
        styles.shareButton,
        {
          opacity: isSharing ? 0.6 : 1,
        },
      ]}
      accessibilityLabel="Copy collection code"
      accessibilityHint="Copy the collection code to clipboard"
    >
      {isSharing ? (
        <ActivityIndicator
          size="small"
          color={
            colorScheme === 'dark' ? Colors.dark.tint : Colors.primary.DEFAULT
          }
        />
      ) : (
        <Ionicons
          name="copy-outline"
          size={24}
          color={
            colorScheme === 'dark' ? Colors.dark.tint : Colors.primary.DEFAULT
          }
        />
      )}
    </TouchableOpacity>
  )

  const renderStopSharingButton = () => (
    <TouchableOpacity
      onPress={onStopSharing}
      disabled={isSharing || !collection?.collection_id}
      style={[
        styles.shareButton,
        {
          opacity: isSharing ? 0.6 : 1,
        },
      ]}
      accessibilityLabel="Stop sharing collection"
      accessibilityHint="Stop sharing this collection"
    >
      <Ionicons
        name="person-remove-outline"
        size={24}
        color={Colors.error.DEFAULT}
      />
    </TouchableOpacity>
  )

  const renderShareButton = () => (
    <TouchableOpacity
      onPress={onShare}
      disabled={isSharing || !collection?.collection_id}
      style={[
        styles.shareButton,
        {
          opacity: isSharing ? 0.6 : 1,
        },
      ]}
      accessibilityLabel="Share collection"
      accessibilityHint="Share this collection with others"
    >
      {isSharing ? (
        <ActivityIndicator
          size="small"
          color={
            colorScheme === 'dark' ? Colors.dark.tint : Colors.primary.DEFAULT
          }
        />
      ) : (
        <Ionicons
          name="share-outline"
          size={24}
          color={
            colorScheme === 'dark' ? Colors.dark.tint : Colors.primary.DEFAULT
          }
        />
      )}
    </TouchableOpacity>
  )

  if (collection?.is_shared) {
    return (
      <ViewThemed style={styles.headerButtonsContainer}>
        {renderCopyButton()}
        {renderStopSharingButton()}
      </ViewThemed>
    )
  }

  return renderShareButton()
}

const styles = {
  headerButtonsContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  shareButton: {
    width: 36,
    height: 36,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: 18,
  },
}

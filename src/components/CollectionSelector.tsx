import React, { useState } from 'react'
import {
  TouchableOpacity,
  useColorScheme,
  View,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { useCollections } from '@/hooks/useCollections'
import { CollectionSelectorSheet } from '@/components/glass/modals/CollectionSelectorSheet'
import type { Collection } from '@/types/database'

interface CollectionSelectorProps {
  selectedCollectionId: string | null
  onCollectionSelect: (collection: Collection | null) => void
  placeholder?: string
  disabled?: boolean
}

const getSelectorContainerColors = (isDarkMode: boolean, disabled: boolean) => {
  if (isDarkMode) {
    return {
      backgroundColor: disabled
        ? Colors.dark.backgroundTertiary
        : Colors.dark.backgroundSecondary,
      borderColor: disabled
        ? Colors.dark.backgroundSecondary
        : Colors.dark.backgroundTertiary,
    }
  }

  return {
    backgroundColor: disabled ? Colors.neutral[50] : Colors.background.primary,
    borderColor: disabled ? Colors.neutral[200] : Colors.neutral[300],
  }
}

const getFolderIconColor = (isDarkMode: boolean, hasSelection: boolean) => {
  if (hasSelection) {
    return isDarkMode ? Colors.dark.text : Colors.neutral[700]
  }

  return isDarkMode ? Colors.dark.textTertiary : Colors.neutral[400]
}

const getChevronColor = (isDarkMode: boolean, disabled: boolean) => {
  if (disabled) {
    return isDarkMode ? Colors.dark.textTertiary : Colors.neutral[300]
  }

  return isDarkMode ? Colors.dark.textSecondary : Colors.neutral[500]
}

const getPlaceholderTextColor = (isDarkMode: boolean) =>
  isDarkMode ? Colors.dark.textTertiary : Colors.neutral[400]

export default function CollectionSelector({
  selectedCollectionId,
  onCollectionSelect,
  placeholder = 'Select Collection',
  disabled = false,
}: CollectionSelectorProps) {
  const [isVisible, setIsVisible] = useState(false)
  const { collections, collectionsLoading, fetchCollections } = useCollections()
  const colorScheme = useColorScheme() ?? 'light'
  const isDarkMode = colorScheme === 'dark'
  const selectorColors = getSelectorContainerColors(isDarkMode, disabled)

  const selectedCollection = collections.find(
    c => c.collection_id === selectedCollectionId
  )

  const handleOpen = async () => {
    if (disabled) return
    setIsVisible(true)
    if (collections.length === 0) {
      await fetchCollections()
    }
  }

  const handleSelect = (collection: Collection | null) => {
    onCollectionSelect(collection)
    setIsVisible(false)
  }

  const getSelectorText = () => {
    if (selectedCollection) return selectedCollection.name
    if (collections.length === 0) return 'Will create default collection'
    return placeholder
  }

  return (
    <>
      <TouchableOpacity
        style={[
          styles.selector,
          {
            backgroundColor: selectorColors.backgroundColor,
            borderColor: selectorColors.borderColor,
          },
        ]}
        onPress={handleOpen}
        disabled={disabled}
      >
        <View style={styles.selectorContent}>
          <Ionicons
            name="folder-outline"
            size={20}
            color={getFolderIconColor(isDarkMode, Boolean(selectedCollection))}
          />
          <TextThemed
            style={[
              styles.selectorText,
              !selectedCollection && {
                color: getPlaceholderTextColor(isDarkMode),
              },
            ]}
          >
            {getSelectorText()}
          </TextThemed>
        </View>
        <Ionicons
          name="chevron-down"
          size={20}
          color={getChevronColor(isDarkMode, disabled)}
        />
      </TouchableOpacity>

      <CollectionSelectorSheet
        visible={isVisible}
        onClose={() => setIsVisible(false)}
        onSelect={handleSelect}
        collections={collections}
        selectedCollectionId={selectedCollectionId}
        loading={collectionsLoading}
      />
    </>
  )
}

const styles = StyleSheet.create({
  selector: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 50,
  },
  selectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectorText: {
    fontSize: 17,
    marginLeft: 10,
    letterSpacing: -0.41,
  },
})

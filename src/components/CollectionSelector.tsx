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
import CollectionSelectorSheet from '@/components/glass/modals/CollectionSelectorSheet'
import type { Collection } from '@/types/database'

interface CollectionSelectorProps {
  selectedCollectionId: string | null
  onCollectionSelect: (collection: Collection | null) => void
  placeholder?: string
  disabled?: boolean
}

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
            backgroundColor: isDarkMode
              ? disabled
                ? Colors.dark.backgroundTertiary
                : Colors.dark.backgroundSecondary
              : disabled
                ? Colors.neutral[50]
                : Colors.background.primary,
            borderColor: isDarkMode
              ? disabled
                ? Colors.dark.backgroundSecondary
                : Colors.dark.backgroundTertiary
              : disabled
                ? Colors.neutral[200]
                : Colors.neutral[300],
          },
        ]}
        onPress={handleOpen}
        disabled={disabled}
      >
        <View style={styles.selectorContent}>
          <Ionicons
            name="folder-outline"
            size={20}
            color={
              selectedCollection
                ? isDarkMode
                  ? Colors.dark.text
                  : Colors.neutral[700]
                : isDarkMode
                  ? Colors.dark.textTertiary
                  : Colors.neutral[400]
            }
          />
          <TextThemed
            style={[
              styles.selectorText,
              !selectedCollection && {
                color: isDarkMode
                  ? Colors.dark.textTertiary
                  : Colors.neutral[400],
              },
            ]}
          >
            {getSelectorText()}
          </TextThemed>
        </View>
        <Ionicons
          name="chevron-down"
          size={20}
          color={
            disabled
              ? isDarkMode
                ? Colors.dark.textTertiary
                : Colors.neutral[300]
              : isDarkMode
                ? Colors.dark.textSecondary
                : Colors.neutral[500]
          }
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

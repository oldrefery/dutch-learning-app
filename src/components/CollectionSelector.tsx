import React, { useState } from 'react'
import {
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
  useColorScheme,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { useCollections } from '@/hooks/useCollections'
import type { Collection } from '@/types/database'

interface CollectionSelectorProps {
  selectedCollectionId: string | null
  onCollectionSelect: (collection: Collection | null) => void
  placeholder?: string
  disabled?: boolean
}

// Color mappings to reduce cognitive complexity
const COLOR_MAPPINGS = {
  light: {
    selectorBackground: Colors.background.primary,
    selectorBorder: Colors.neutral[300],
    disabledBackground: Colors.neutral[50],
    disabledBorder: Colors.neutral[200],
    selectedIcon: Colors.neutral[700],
    placeholderIcon: Colors.neutral[400],
    chevronNormal: Colors.neutral[500],
    chevronDisabled: Colors.neutral[300],
    itemBorder: Colors.neutral[100],
    selectedItemBackground: Colors.primary.light,
    selectedItemText: Colors.primary.dark,
    checkmarkColor: Colors.primary.DEFAULT,
    modalBorder: Colors.neutral[200],
    activityIndicator: Colors.primary.DEFAULT,
    emptyIcon: Colors.neutral[400],
    closeIcon: Colors.neutral[700],
    clearButtonBackground: Colors.neutral[100],
  },
  dark: {
    selectorBackground: Colors.dark.backgroundSecondary,
    selectorBorder: Colors.dark.backgroundTertiary,
    disabledBackground: Colors.dark.backgroundTertiary,
    disabledBorder: Colors.dark.backgroundSecondary,
    selectedIcon: Colors.dark.text,
    placeholderIcon: Colors.dark.textTertiary,
    chevronNormal: Colors.dark.textSecondary,
    chevronDisabled: Colors.dark.textTertiary,
    itemBorder: Colors.dark.backgroundSecondary,
    selectedItemBackground: 'rgba(64, 156, 255, 0.2)',
    selectedItemText: Colors.dark.tint,
    checkmarkColor: Colors.dark.tint,
    modalBorder: Colors.dark.backgroundSecondary,
    activityIndicator: Colors.dark.tint,
    emptyIcon: Colors.dark.textTertiary,
    closeIcon: Colors.dark.text,
    clearButtonBackground: Colors.dark.backgroundSecondary,
  },
} as const

const useCollectionSelectorColors = (colorScheme: 'light' | 'dark') => {
  return COLOR_MAPPINGS[colorScheme]
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
  const colors = useCollectionSelectorColors(colorScheme)

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

  const renderCollectionItem = ({ item }: { item: Collection }) => {
    const isSelected = selectedCollectionId === item.collection_id

    return (
      <TouchableOpacity
        style={[
          styles.collectionItem,
          { borderBottomColor: colors.itemBorder },
          isSelected && { backgroundColor: colors.selectedItemBackground },
        ]}
        onPress={() => handleSelect(item)}
      >
        <ViewThemed style={styles.collectionInfo}>
          <TextThemed
            style={[
              styles.collectionName,
              isSelected && { color: colors.selectedItemText },
            ]}
            lightColor={Colors.neutral[700]}
            darkColor={Colors.dark.text}
          >
            {item.name}
          </TextThemed>
          <TextThemed
            style={styles.collectionDate}
            lightColor={Colors.neutral[500]}
            darkColor={Colors.dark.textSecondary}
          >
            {new Date(item.created_at).toLocaleDateString()}
          </TextThemed>
        </ViewThemed>
        {isSelected && (
          <Ionicons name="checkmark" size={20} color={colors.checkmarkColor} />
        )}
      </TouchableOpacity>
    )
  }

  const renderLoadingState = () => (
    <ViewThemed style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.activityIndicator} />
      <TextThemed
        style={styles.loadingText}
        lightColor={Colors.neutral[500]}
        darkColor={Colors.dark.textSecondary}
      >
        Loading collections...
      </TextThemed>
    </ViewThemed>
  )

  const renderEmptyState = () => (
    <ViewThemed style={styles.emptyContainer}>
      <Ionicons name="folder-outline" size={48} color={colors.emptyIcon} />
      <TextThemed
        style={styles.emptyText}
        lightColor={Colors.neutral[700]}
        darkColor={Colors.dark.text}
      >
        No collections found
      </TextThemed>
      <TextThemed
        style={styles.emptySubtext}
        lightColor={Colors.neutral[500]}
        darkColor={Colors.dark.textSecondary}
      >
        Create your first collection to get started
      </TextThemed>
    </ViewThemed>
  )

  const renderCollectionsList = () => (
    <FlatList
      data={collections}
      keyExtractor={item => item.collection_id}
      renderItem={renderCollectionItem}
      style={styles.list}
      showsVerticalScrollIndicator={false}
    />
  )

  const renderContent = () => {
    if (collectionsLoading) return renderLoadingState()
    if (collections.length === 0) return renderEmptyState()
    return renderCollectionsList()
  }

  return (
    <>
      <TouchableOpacity
        style={[
          styles.selector,
          {
            backgroundColor: disabled
              ? colors.disabledBackground
              : colors.selectorBackground,
            borderColor: disabled
              ? colors.disabledBorder
              : colors.selectorBorder,
          },
        ]}
        onPress={handleOpen}
        disabled={disabled}
      >
        <ViewThemed style={styles.selectorContent}>
          <Ionicons
            name="folder-outline"
            size={20}
            color={
              selectedCollection ? colors.selectedIcon : colors.placeholderIcon
            }
          />
          <TextThemed
            style={[
              styles.selectorText,
              !selectedCollection && { color: colors.placeholderIcon },
            ]}
            lightColor={Colors.neutral[700]}
            darkColor={Colors.dark.text}
          >
            {selectedCollection ? selectedCollection.name : placeholder}
          </TextThemed>
        </ViewThemed>
        <Ionicons
          name="chevron-down"
          size={20}
          color={disabled ? colors.chevronDisabled : colors.chevronNormal}
        />
      </TouchableOpacity>

      <Modal
        visible={isVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsVisible(false)}
      >
        <ViewThemed
          style={styles.modalContainer}
          lightColor={Colors.background.primary}
          darkColor={Colors.dark.background}
        >
          <ViewThemed
            style={[
              styles.modalHeader,
              { borderBottomColor: colors.modalBorder },
            ]}
          >
            <TextThemed
              style={styles.modalTitle}
              lightColor={Colors.neutral[900]}
              darkColor={Colors.dark.text}
            >
              Select Collection
            </TextThemed>
            <TouchableOpacity
              onPress={() => setIsVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={colors.closeIcon} />
            </TouchableOpacity>
          </ViewThemed>

          <ViewThemed style={styles.modalContent}>{renderContent()}</ViewThemed>

          <ViewThemed
            style={[
              styles.modalActions,
              { borderTopColor: colors.modalBorder },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.clearButton,
                { backgroundColor: colors.clearButtonBackground },
              ]}
              onPress={() => handleSelect(null)}
            >
              <TextThemed
                style={styles.clearButtonText}
                lightColor={Colors.neutral[500]}
                darkColor={Colors.dark.textSecondary}
              >
                No Collection
              </TextThemed>
            </TouchableOpacity>
          </ViewThemed>
        </ViewThemed>
      </Modal>
    </>
  )
}

const LAYOUT = {
  SPACE_BETWEEN: 'space-between' as const,
} as const

const styles = {
  selector: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: LAYOUT.SPACE_BETWEEN,
  },
  disabledSelector: {
    // Dynamic styles applied in a component
  },
  selectorContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flex: 1,
  },
  selectorText: {
    fontSize: 16,
    marginLeft: 8,
  },
  placeholderText: {
    // Dynamic styles applied in a component
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    justifyContent: LAYOUT.SPACE_BETWEEN,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  collectionItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: LAYOUT.SPACE_BETWEEN,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  selectedItem: {
    // Dynamic styles applied in a component
  },
  collectionInfo: {
    flex: 1,
  },
  collectionName: {
    fontSize: 16,
    fontWeight: '500' as const,
    marginBottom: 4,
  },
  selectedText: {
    // Dynamic styles applied in a component
  },
  collectionDate: {
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '500' as const,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center' as const,
  },
  modalActions: {
    padding: 20,
    borderTopWidth: 1,
  },
  clearButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center' as const,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '500' as const,
  },
}

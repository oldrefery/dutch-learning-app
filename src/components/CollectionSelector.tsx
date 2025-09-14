import React, { useState } from 'react'
import {
  TouchableOpacity,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Text, View } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { useCollections } from '@/hooks/useCollections'
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

  const renderCollectionItem = ({ item }: { item: Collection }) => (
    <TouchableOpacity
      style={[
        styles.collectionItem,
        selectedCollectionId === item.collection_id && styles.selectedItem,
      ]}
      onPress={() => handleSelect(item)}
    >
      <View style={styles.collectionInfo}>
        <Text
          style={[
            styles.collectionName,
            selectedCollectionId === item.collection_id && styles.selectedText,
          ]}
        >
          {item.name}
        </Text>
        <Text style={styles.collectionDate}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
      {selectedCollectionId === item.collection_id && (
        <Ionicons name="checkmark" size={20} color={Colors.primary.DEFAULT} />
      )}
    </TouchableOpacity>
  )

  const renderContent = () => {
    if (collectionsLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary.DEFAULT} />
          <Text style={styles.loadingText}>Loading collections...</Text>
        </View>
      )
    }

    if (collections.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="folder-outline"
            size={48}
            color={Colors.neutral[400]}
          />
          <Text style={styles.emptyText}>No collections found</Text>
          <Text style={styles.emptySubtext}>
            Create your first collection to get started
          </Text>
        </View>
      )
    }

    return (
      <FlatList
        data={collections}
        keyExtractor={item => item.collection_id}
        renderItem={renderCollectionItem}
        style={styles.list}
        showsVerticalScrollIndicator={false}
      />
    )
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.selector, disabled && styles.disabledSelector]}
        onPress={handleOpen}
        disabled={disabled}
      >
        <View style={styles.selectorContent}>
          <Ionicons
            name="folder-outline"
            size={20}
            color={
              selectedCollection ? Colors.neutral[700] : Colors.neutral[400]
            }
          />
          <Text
            style={[
              styles.selectorText,
              !selectedCollection && styles.placeholderText,
            ]}
          >
            {selectedCollection ? selectedCollection.name : placeholder}
          </Text>
        </View>
        <Ionicons
          name="chevron-down"
          size={20}
          color={disabled ? Colors.neutral[300] : Colors.neutral[500]}
        />
      </TouchableOpacity>

      <Modal
        visible={isVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Collection</Text>
            <TouchableOpacity
              onPress={() => setIsVisible(false)}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={24} color={Colors.neutral[700]} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>{renderContent()}</View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => handleSelect(null)}
            >
              <Text style={styles.clearButtonText}>No Collection</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    borderColor: Colors.neutral[300],
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: Colors.background.primary,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: LAYOUT.SPACE_BETWEEN,
  },
  disabledSelector: {
    backgroundColor: Colors.neutral[50],
    borderColor: Colors.neutral[200],
  },
  selectorContent: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flex: 1,
  },
  selectorText: {
    fontSize: 16,
    color: Colors.neutral[700],
    marginLeft: 8,
  },
  placeholderText: {
    color: Colors.neutral[400],
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    justifyContent: LAYOUT.SPACE_BETWEEN,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.neutral[900],
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
    borderBottomColor: Colors.neutral[100],
  },
  selectedItem: {
    backgroundColor: Colors.primary.light,
  },
  collectionInfo: {
    flex: 1,
  },
  collectionName: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.neutral[700],
    marginBottom: 4,
  },
  selectedText: {
    color: Colors.primary.dark,
  },
  collectionDate: {
    fontSize: 14,
    color: Colors.neutral[500],
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
    color: Colors.neutral[500],
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
    color: Colors.neutral[700],
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.neutral[500],
    marginTop: 8,
    textAlign: 'center' as const,
  },
  modalActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[200],
  },
  clearButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: Colors.neutral[100],
    alignItems: 'center' as const,
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.neutral[500],
  },
}

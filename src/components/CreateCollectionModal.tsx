import React, { useState } from 'react'
import {
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { useCollections } from '@/hooks/useCollections'
import { ToastService } from '@/components/AppToast'
import {
  ToastMessageType,
  CollectionOperation,
  CollectionErrorOperation,
} from '@/constants/ToastConstants'
import type { Collection } from '@/types/database'

interface CreateCollectionModalProps {
  visible: boolean
  onClose: () => void
  onCollectionCreated?: (collection: Collection) => void
}

export default function CreateCollectionModal({
  visible,
  onClose,
  onCollectionCreated,
}: CreateCollectionModalProps) {
  const [collectionName, setCollectionName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const { createNewCollection } = useCollections()

  const handleCreate = async () => {
    if (!collectionName.trim()) {
      ToastService.showInfo(ToastMessageType.COLLECTION_NAME_REQUIRED)
      return
    }

    try {
      setIsCreating(true)
      const newCollection = await createNewCollection(collectionName.trim())

      ToastService.showCollectionSuccess(
        CollectionOperation.CREATED,
        collectionName.trim()
      )

      setCollectionName('')
      onCollectionCreated?.(newCollection)
      onClose()
    } catch {
      ToastService.showCollectionError(CollectionErrorOperation.CREATE)
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    setCollectionName('')
    onClose()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <ViewThemed style={styles.container}>
        <ViewThemed style={styles.header}>
          <TextThemed style={styles.title}>Create New Collection</TextThemed>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeButton}
            disabled={isCreating}
          >
            <Ionicons name="close" size={24} color={Colors.neutral[700]} />
          </TouchableOpacity>
        </ViewThemed>

        <ViewThemed style={styles.content}>
          <TextThemed style={styles.label}>Collection Name</TextThemed>
          <TextInput
            style={styles.input}
            value={collectionName}
            onChangeText={setCollectionName}
            placeholder="Enter collection name..."
            placeholderTextColor={Colors.neutral[400]}
            autoFocus
            maxLength={50}
            editable={!isCreating}
          />
          <TextThemed style={styles.helperText}>
            {collectionName.length}/50 characters
          </TextThemed>
        </ViewThemed>

        <ViewThemed style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleClose}
            disabled={isCreating}
          >
            <TextThemed style={styles.cancelButtonText}>Cancel</TextThemed>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.button,
              styles.createButton,
              (!collectionName.trim() || isCreating) && styles.disabledButton,
            ]}
            onPress={handleCreate}
            disabled={!collectionName.trim() || isCreating}
          >
            {isCreating ? (
              <ActivityIndicator
                size="small"
                color={Colors.background.primary}
              />
            ) : (
              <TextThemed style={styles.createButtonText}>
                Create Collection
              </TextThemed>
            )}
          </TouchableOpacity>
        </ViewThemed>
      </ViewThemed>
    </Modal>
  )
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: Colors.background.primary,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
  },
  title: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.neutral[900],
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.neutral[700],
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.neutral[300],
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.neutral[900],
    backgroundColor: Colors.background.primary,
  },
  helperText: {
    fontSize: 12,
    color: Colors.neutral[500],
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row' as const,
    padding: 20,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  cancelButton: {
    backgroundColor: Colors.neutral[100],
    borderWidth: 1,
    borderColor: Colors.neutral[300],
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.neutral[700],
  },
  createButton: {
    backgroundColor: Colors.primary.DEFAULT,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.background.primary,
  },
  disabledButton: {
    backgroundColor: Colors.neutral[400],
  },
}

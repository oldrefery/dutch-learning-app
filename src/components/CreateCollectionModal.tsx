import React, { useState } from 'react'
import {
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Text, View } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { useCollections } from '@/hooks/useCollections'
import { ToastService } from '@/components/AppToast'
import { ToastMessageType } from '@/constants/ToastConstants'

interface CreateCollectionModalProps {
  visible: boolean
  onClose: () => void
  onCollectionCreated?: (collection: any) => void
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

      ToastService.showCollectionSuccess('created', collectionName.trim())

      setCollectionName('')
      onCollectionCreated?.(newCollection)
      onClose()
    } catch {
      ToastService.showCollectionError('create')
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
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Create New Collection</Text>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeButton}
            disabled={isCreating}
          >
            <Ionicons name="close" size={24} color={Colors.neutral[700]} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.label}>Collection Name</Text>
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
          <Text style={styles.helperText}>
            {collectionName.length}/50 characters
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleClose}
            disabled={isCreating}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
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
              <Text style={styles.createButtonText}>Create Collection</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
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

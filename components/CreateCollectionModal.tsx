import React, { useState } from 'react'
import {
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Text, View } from '@/components/Themed'
import { useCollections } from '@/hooks/useCollections'
import Toast from 'react-native-toast-message'

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
      Alert.alert('Error', 'Please enter a collection name')
      return
    }

    try {
      setIsCreating(true)
      const newCollection = await createNewCollection(collectionName.trim())

      Toast.show({
        type: 'success',
        text1: 'Collection Created',
        text2: `"${collectionName}" has been created successfully`,
      })

      setCollectionName('')
      onCollectionCreated?.(newCollection)
      onClose()
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to create collection. Please try again.',
      })
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
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.label}>Collection Name</Text>
          <TextInput
            style={styles.input}
            value={collectionName}
            onChangeText={setCollectionName}
            placeholder="Enter collection name..."
            placeholderTextColor="#9CA3AF"
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
              <ActivityIndicator size="small" color="#FFFFFF" />
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
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#111827',
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
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
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
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#374151',
  },
  createButton: {
    backgroundColor: '#3B82F6',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#FFFFFF',
  },
  disabledButton: {
    backgroundColor: '#9CA3AF',
  },
}

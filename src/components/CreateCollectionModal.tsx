import React, { useState } from 'react'
import {
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
} from 'react-native'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { LIQUID_GLASS } from '@/constants/UIConstants'
import { useCollections } from '@/hooks/useCollections'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
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
      ToastService.show('Please enter a collection name', ToastType.INFO)
      return
    }

    try {
      setIsCreating(true)
      const newCollection = await createNewCollection(collectionName.trim())

      ToastService.show(
        `Collection "${collectionName.trim()}" created successfully`,
        ToastType.SUCCESS
      )

      setCollectionName('')
      onCollectionCreated?.(newCollection)
      onClose()
    } catch {
      ToastService.show(
        'Failed to create collection. Please try again.',
        ToastType.ERROR
      )
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    setCollectionName('')
    onClose()
  }

  const colorScheme = useColorScheme() ?? 'light'
  const isDarkMode = colorScheme === 'dark'

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <ViewThemed style={styles.container}>
        <BlurView
          intensity={LIQUID_GLASS.BLUR_INTENSITY.MODAL}
          tint={isDarkMode ? 'dark' : 'light'}
          style={styles.headerBlur}
        >
          <ViewThemed
            style={[
              styles.header,
              {
                backgroundColor: isDarkMode
                  ? LIQUID_GLASS.BACKGROUND_DARK.ELEVATED
                  : LIQUID_GLASS.BACKGROUND_LIGHT.ELEVATED,
                borderBottomColor: isDarkMode
                  ? LIQUID_GLASS.BORDER_DARK
                  : LIQUID_GLASS.BORDER_LIGHT,
              },
            ]}
          >
            <TextThemed style={styles.title}>Create New Collection</TextThemed>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              disabled={isCreating}
            >
              <Ionicons
                name="close"
                size={24}
                color={isDarkMode ? Colors.dark.text : Colors.neutral[700]}
              />
            </TouchableOpacity>
          </ViewThemed>
        </BlurView>

        <ViewThemed style={styles.content}>
          <TextThemed style={styles.label}>Collection Name</TextThemed>
          <BlurView
            intensity={LIQUID_GLASS.BLUR_INTENSITY.CARD}
            tint={isDarkMode ? 'dark' : 'light'}
            style={styles.inputBlur}
          >
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDarkMode
                    ? LIQUID_GLASS.BACKGROUND_DARK.SECONDARY
                    : LIQUID_GLASS.BACKGROUND_LIGHT.SECONDARY,
                  borderColor: isDarkMode
                    ? LIQUID_GLASS.BORDER_DARK
                    : LIQUID_GLASS.BORDER_LIGHT,
                  color: isDarkMode ? Colors.dark.text : Colors.neutral[900],
                },
              ]}
              value={collectionName}
              onChangeText={setCollectionName}
              placeholder="Enter collection name..."
              placeholderTextColor={
                isDarkMode ? Colors.dark.textTertiary : Colors.neutral[400]
              }
              autoFocus
              maxLength={50}
              editable={!isCreating}
            />
          </BlurView>
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
  headerBlur: {
    overflow: 'hidden' as const,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600' as const,
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
    marginBottom: 8,
  },
  inputBlur: {
    borderRadius: LIQUID_GLASS.BORDER_RADIUS.SMALL,
    overflow: 'hidden' as const,
  },
  input: {
    borderWidth: 1,
    borderRadius: LIQUID_GLASS.BORDER_RADIUS.SMALL,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
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
    borderRadius: LIQUID_GLASS.BORDER_RADIUS.SMALL,
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

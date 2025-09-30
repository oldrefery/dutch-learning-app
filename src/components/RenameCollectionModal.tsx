import React, { useState, useEffect } from 'react'
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { TextInput } from 'react-native-gesture-handler'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { Sentry } from '@/lib/sentry'

interface RenameCollectionModalProps {
  visible: boolean
  currentName: string
  onClose: () => void
  onRename: (newName: string) => Promise<void>
}

export default function RenameCollectionModal({
  visible,
  currentName,
  onClose,
  onRename,
}: RenameCollectionModalProps) {
  const [newName, setNewName] = useState('')
  const [isRenaming, setIsRenaming] = useState(false)

  useEffect(() => {
    if (visible) {
      setNewName(currentName)
    }
  }, [visible, currentName])

  const handleRename = async () => {
    if (!newName.trim() || newName.trim() === currentName) {
      onClose()
      return
    }

    setIsRenaming(true)
    try {
      await onRename(newName.trim())
      onClose()
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'renameCollection' },
        extra: {
          message: 'Error renaming collection',
          currentName,
          newName: newName.trim(),
        },
      })
    } finally {
      setIsRenaming(false)
    }
  }

  const handleClose = () => {
    setNewName('')
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
          <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
            <TextThemed style={styles.cancelButtonText}>Cancel</TextThemed>
          </TouchableOpacity>
          <TextThemed style={styles.title}>Rename Collection</TextThemed>
          <TouchableOpacity
            style={[
              styles.saveButton,
              (!newName.trim() || newName.trim() === currentName) &&
                styles.saveButtonDisabled,
            ]}
            onPress={handleRename}
            disabled={
              !newName.trim() || newName.trim() === currentName || isRenaming
            }
          >
            {isRenaming ? (
              <ActivityIndicator size="small" color={Colors.primary.DEFAULT} />
            ) : (
              <TextThemed
                style={[
                  styles.saveButtonText,
                  (!newName.trim() || newName.trim() === currentName) &&
                    styles.saveButtonTextDisabled,
                ]}
              >
                Save
              </TextThemed>
            )}
          </TouchableOpacity>
        </ViewThemed>

        <ViewThemed style={styles.content}>
          <TextThemed style={styles.label}>Collection Name</TextThemed>
          <TextInput
            style={[styles.input, styles.inputThemedColors]}
            value={newName}
            onChangeText={setNewName}
            placeholder="Enter collection name"
            placeholderTextColor={Colors.neutral[500]}
            autoFocus
            selectTextOnFocus
            maxLength={50}
          />
          <TextThemed
            style={styles.hint}
            lightColor={Colors.neutral[500]}
            darkColor={Colors.dark.textSecondary}
          >
            Choose a name that helps you identify this collection
          </TextThemed>
        </ViewThemed>
      </ViewThemed>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    fontSize: 16,
    color: Colors.primary.DEFAULT,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary.DEFAULT,
  },
  saveButtonTextDisabled: {
    color: Colors.neutral[400],
  },
  content: {
    flex: 1,
    padding: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  inputThemedColors: {
    backgroundColor: Colors.background.secondary,
    borderColor: Colors.neutral[300],
    color: Colors.text.primary,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
  },
})

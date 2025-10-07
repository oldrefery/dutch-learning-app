import React, { useState, useEffect } from 'react'
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
} from 'react-native'
import { TextInput } from 'react-native-gesture-handler'
import { BlurView } from 'expo-blur'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { LIQUID_GLASS } from '@/constants/UIConstants'
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
                <ActivityIndicator
                  size="small"
                  color={Colors.primary.DEFAULT}
                />
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
              value={newName}
              onChangeText={setNewName}
              placeholder="Enter collection name"
              placeholderTextColor={
                isDarkMode ? Colors.dark.textTertiary : Colors.neutral[500]
              }
              autoFocus
              selectTextOnFocus
              maxLength={50}
            />
          </BlurView>
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
  headerBlur: {
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
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
  inputBlur: {
    borderRadius: LIQUID_GLASS.BORDER_RADIUS.SMALL,
    overflow: 'hidden',
  },
  input: {
    borderWidth: 1,
    borderRadius: LIQUID_GLASS.BORDER_RADIUS.SMALL,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    lineHeight: 20,
  },
})

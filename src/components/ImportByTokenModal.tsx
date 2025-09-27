import React, { useState } from 'react'
import {
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { TextThemed, ViewThemed, useThemeColor } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { ROUTES } from '@/constants/Routes'
import { collectionSharingService } from '@/services/collectionSharingService'
import { useApplicationStore } from '@/stores/useApplicationStore'

interface ImportByTokenModalProps {
  visible: boolean
  onClose: () => void
}

export default function ImportByTokenModal({
  visible,
  onClose,
}: ImportByTokenModalProps) {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const colorScheme = useColorScheme() ?? 'light'

  const { words } = useApplicationStore()

  const textColor = useThemeColor({}, 'text')
  const textSecondaryColor = useThemeColor({}, 'textSecondary')
  const borderColor = useThemeColor({}, 'border')
  const backgroundSecondaryColor = useThemeColor({}, 'backgroundSecondary')
  const tintColor = useThemeColor({}, 'tint')

  const handleImport = async () => {
    const trimmedToken = token.trim()

    if (!trimmedToken) {
      setError('Please enter a collection code')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const wordsResult =
        await collectionSharingService.getSharedCollectionWords(trimmedToken)

      if (!wordsResult.success) {
        const errorMessage = getErrorMessage(wordsResult.error)
        setError(errorMessage)
        return
      }

      const sharedWords = wordsResult.data.words
      const newWords = sharedWords.filter(sharedWord => {
        const existingWord = words.find(
          existing =>
            existing.dutch_lemma.toLowerCase() ===
              sharedWord.dutch_lemma.toLowerCase() &&
            (existing.part_of_speech || 'unknown') ===
              (sharedWord.part_of_speech || 'unknown') &&
            (existing.article || '') === (sharedWord.article || '')
        )
        return !existingWord
      })

      if (newWords.length === 0) {
        setError(
          `All ${sharedWords.length} words from this collection are already in your vocabulary. Nothing to import.`
        )
        return
      }

      handleClose()
      router.push(ROUTES.IMPORT_COLLECTION(trimmedToken))
    } catch (error) {
      console.error('Failed to validate token:', error)
      setError('Failed to validate collection code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const getErrorMessage = (error: string): string => {
    const notFoundText =
      'Collection with this code does not exist. Please check the code.'
    switch (error) {
      case 'COLLECTION_NOT_FOUND':
        return notFoundText
      case 'COLLECTION_NOT_SHARED':
        return 'This collection is no longer shared. Ask for a new code.'
      case 'DATABASE_ERROR':
        // it means that we could not find the collection with entered code
        return notFoundText //'Unable to connect to server. Please try again later.'
      case 'UNAUTHORIZED':
        return 'Invalid collection code. Please verify the code is correct.'
      default:
        return notFoundText
    }
  }

  const handleClose = () => {
    setToken('')
    setError(null)
    onClose()
  }

  const handleTokenChange = (text: string) => {
    setToken(text)
    if (error) {
      setError(null)
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        onPress={handleClose}
        activeOpacity={1}
      >
        <ViewThemed
          style={[
            styles.container,
            {
              backgroundColor:
                colorScheme === 'dark'
                  ? Colors.dark.backgroundElevated
                  : Colors.background.primary,
              borderColor:
                colorScheme === 'dark' ? Colors.neutral[600] : 'transparent',
              borderWidth: colorScheme === 'dark' ? 1 : 0,
            },
          ]}
        >
          <ViewThemed
            style={[styles.header, { borderBottomColor: borderColor }]}
          >
            <TextThemed style={styles.title}>Import Collection</TextThemed>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              disabled={loading}
            >
              <Ionicons
                name="close"
                size={24}
                color={
                  colorScheme === 'dark'
                    ? Colors.dark.text
                    : Colors.neutral[700]
                }
              />
            </TouchableOpacity>
          </ViewThemed>

          <ViewThemed style={styles.content}>
            <TextThemed style={[styles.label, { color: textSecondaryColor }]}>
              Collection Code
            </TextThemed>
            <TextInput
              style={[
                styles.input,
                {
                  borderColor: error ? Colors.error.DEFAULT : borderColor,
                  backgroundColor: backgroundSecondaryColor,
                  color: textColor,
                },
              ]}
              value={token}
              onChangeText={handleTokenChange}
              placeholder="Enter collection code..."
              placeholderTextColor={
                colorScheme === 'dark'
                  ? Colors.dark.textTertiary
                  : Colors.neutral[400]
              }
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleImport}
              editable={!loading}
              autoFocus={true}
            />
            {error && (
              <TextThemed
                style={[styles.errorText, { color: Colors.error.DEFAULT }]}
              >
                {error}
              </TextThemed>
            )}

            <ViewThemed style={styles.infoSection}>
              <TextThemed style={[styles.infoTitle, { color: textColor }]}>
                How to get a code:
              </TextThemed>
              <TextThemed
                style={[styles.infoText, { color: textSecondaryColor }]}
              >
                • Ask someone to share their collection with you
              </TextThemed>
              <TextThemed
                style={[styles.infoText, { color: textSecondaryColor }]}
              >
                • They can find the share code in their collection settings
              </TextThemed>
              <TextThemed
                style={[styles.infoText, { color: textSecondaryColor }]}
              >
                • The code looks like a random string of letters and numbers
              </TextThemed>
            </ViewThemed>
          </ViewThemed>

          <ViewThemed style={styles.actions}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.cancelButton,
                {
                  backgroundColor:
                    colorScheme === 'dark'
                      ? Colors.dark.backgroundTertiary
                      : Colors.neutral[100],
                  borderColor:
                    colorScheme === 'dark' ? Colors.dark.border : borderColor,
                  borderWidth: 1,
                },
              ]}
              onPress={handleClose}
              disabled={loading}
            >
              <TextThemed
                style={[
                  styles.cancelButtonText,
                  {
                    color:
                      colorScheme === 'dark'
                        ? Colors.dark.text
                        : textSecondaryColor,
                  },
                ]}
              >
                Cancel
              </TextThemed>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.importButton,
                { backgroundColor: tintColor },
                (!token.trim() || loading) && styles.disabledButton,
              ]}
              onPress={handleImport}
              disabled={!token.trim() || loading}
            >
              {loading ? (
                <ActivityIndicator
                  size="small"
                  color={Colors.background.primary}
                />
              ) : (
                <TextThemed
                  style={[
                    styles.importButtonText,
                    { color: Colors.background.primary },
                  ]}
                >
                  Import
                </TextThemed>
              )}
            </TouchableOpacity>
          </ViewThemed>
        </ViewThemed>
      </TouchableOpacity>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    minHeight: 360,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 25,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
  closeButton: {
    padding: 6,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 6,
  },
  errorText: {
    fontSize: 13,
    marginBottom: 8,
    lineHeight: 16,
  },
  infoSection: {
    marginTop: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 12,
    marginBottom: 4,
    paddingLeft: 6,
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 12,
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {},
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  importButton: {},
  importButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  disabledButton: {
    backgroundColor: Colors.neutral[400],
  },
})

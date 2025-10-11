import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, View, ActivityIndicator } from 'react-native'
import { TextInput } from 'react-native-gesture-handler'
import { router } from 'expo-router'
import { TextThemed } from '@/components/Themed'
import { GlassModalCenter } from '@/components/glass/modals/GlassModalCenter'
import { Colors } from '@/constants/Colors'
import { ROUTES } from '@/constants/Routes'
import { collectionSharingService } from '@/services/collectionSharingService'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { Sentry } from '@/lib/sentry'

export type ImportCollectionSheetProps = {
  visible: boolean
  onClose: () => void
}

export const ImportCollectionSheet: React.FC<ImportCollectionSheetProps> = ({
  visible,
  onClose,
}) => {
  const [token, setToken] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const { words } = useApplicationStore()

  useEffect(() => {
    if (visible) {
      setToken('')
      setError(null)
    }
  }, [visible])

  const canImport = useMemo(() => {
    const trimmed = token.trim()
    return trimmed.length > 0 && !isSubmitting
  }, [token, isSubmitting])

  const getErrorMessage = useCallback((errorCode: string): string => {
    const notFoundText =
      'Collection with this code does not exist. Please check the code.'
    switch (errorCode) {
      case 'COLLECTION_NOT_FOUND':
        return notFoundText
      case 'COLLECTION_NOT_SHARED':
        return 'This collection is no longer shared. Ask for a new code.'
      case 'DATABASE_ERROR':
        return notFoundText
      case 'UNAUTHORIZED':
        return 'Invalid collection code. Please verify the code is correct.'
      default:
        return notFoundText
    }
  }, [])

  const handleImport = useCallback(async () => {
    if (!canImport) return

    const trimmedToken = token.trim()
    setIsSubmitting(true)
    setError(null)

    try {
      const wordsResult =
        await collectionSharingService.getSharedCollectionWords(trimmedToken)

      if (!wordsResult.success) {
        const errorMessage = getErrorMessage(wordsResult.error)
        setError(errorMessage)
        setIsSubmitting(false)
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
        setIsSubmitting(false)
        return
      }

      onClose()
      router.push(ROUTES.IMPORT_COLLECTION(trimmedToken))
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'validateToken' },
        extra: { message: 'Failed to validate token' },
      })
      setError('Failed to validate collection code. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [canImport, token, words, getErrorMessage, onClose])

  const handleTokenChange = useCallback((text: string) => {
    setToken(text)
    setError(null)
  }, [])

  return (
    <GlassModalCenter
      visible={visible}
      title="Import Collection"
      onClose={onClose}
      minHeight={360}
      leftAction={{
        label: 'Cancel',
        onPress: onClose,
        disabled: isSubmitting,
        accessibilityLabel: 'Cancel import',
      }}
      rightAction={{
        label: isSubmitting ? '' : 'Import',
        onPress: handleImport,
        disabled: !canImport,
        accessibilityLabel: 'Import collection',
      }}
    >
      <View>
        <TextThemed style={styles.label}>Collection Code</TextThemed>
        <TextInput
          style={[
            styles.input,
            styles.inputThemedColors,
            error && styles.inputError,
          ]}
          value={token}
          onChangeText={handleTokenChange}
          placeholder="Enter collection code..."
          placeholderTextColor={Colors.neutral[500]}
          autoFocus
          selectTextOnFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleImport}
          editable={!isSubmitting}
        />
        {error && (
          <TextThemed
            style={styles.errorText}
            lightColor={Colors.error.DEFAULT}
          >
            {error}
          </TextThemed>
        )}

        <View style={styles.infoSection}>
          <TextThemed
            style={styles.infoTitle}
            lightColor={Colors.neutral[700]}
            darkColor={Colors.dark.text}
          >
            How to get a code:
          </TextThemed>
          <TextThemed
            style={styles.infoText}
            lightColor={Colors.neutral[600]}
            darkColor={Colors.dark.textSecondary}
          >
            • Ask someone to share their collection with you
          </TextThemed>
          <TextThemed
            style={styles.infoText}
            lightColor={Colors.neutral[600]}
            darkColor={Colors.dark.textSecondary}
          >
            • They can find the share code in their collection settings
          </TextThemed>
          <TextThemed
            style={styles.infoText}
            lightColor={Colors.neutral[600]}
            darkColor={Colors.dark.textSecondary}
          >
            • The code looks like a random string of letters and numbers
          </TextThemed>
        </View>

        {isSubmitting && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={Colors.primary.DEFAULT} />
            <TextThemed
              style={styles.loadingText}
              lightColor={Colors.neutral[600]}
              darkColor={Colors.dark.textSecondary}
            >
              Validating code...
            </TextThemed>
          </View>
        )}
      </View>
    </GlassModalCenter>
  )
}

const styles = StyleSheet.create({
  label: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    marginBottom: 8,
    letterSpacing: -0.41,
    minHeight: 50,
  },
  inputThemedColors: {
    backgroundColor: Colors.transparent.white10,
    borderColor: Colors.transparent.white30,
    color: Colors.text.primary,
  },
  inputError: {
    borderColor: Colors.error.DEFAULT,
  },
  errorText: {
    fontSize: 13,
    marginBottom: 8,
    lineHeight: 18,
    letterSpacing: -0.08,
  },
  infoSection: {
    marginTop: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: -0.15,
  },
  infoText: {
    fontSize: 13,
    marginBottom: 6,
    paddingLeft: 4,
    lineHeight: 18,
    letterSpacing: -0.08,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    justifyContent: 'center',
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    letterSpacing: -0.15,
  },
})

export default ImportCollectionSheet

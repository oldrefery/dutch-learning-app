import React, { useMemo, useState } from 'react'
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native'
import { CollectionSelector } from '@/components/AddWordScreen/components/CollectionSelector'
import { TextThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { useBatchCaptureStore } from '@/stores/useBatchCaptureStore'
import type { Collection } from '@/types/database'
import { parseBatchCaptureInput } from '@/utils/batchCapture'

interface BatchCaptureComposerProps {
  currentUserId: string | null
  colorScheme: 'light' | 'dark'
  selectedCollection: Collection | null
  targetCollectionId: string | null
  onOpenCollectionSelector: () => void
}

export const BatchCaptureComposer = ({
  currentUserId,
  colorScheme,
  selectedCollection,
  targetCollectionId,
  onOpenCollectionSelector,
}: BatchCaptureComposerProps) => {
  const [rawInput, setRawInput] = useState('')
  const [isInputFocused, setIsInputFocused] = useState(false)
  const parsedInput = useMemo(
    () => parseBatchCaptureInput(rawInput),
    [rawInput]
  )
  const isDarkMode = colorScheme === 'dark'
  const isDisabled =
    !currentUserId ||
    parsedInput.items.length === 0 ||
    parsedInput.hasBlockingIssues
  const primaryColor = isDarkMode
    ? Colors.primary.darkMode
    : Colors.primary.DEFAULT
  const surfaceColor = isDarkMode
    ? Colors.dark.backgroundSecondary
    : Colors.light.backgroundSecondary
  const borderColor = isDarkMode ? Colors.dark.border : Colors.light.border

  const handleCreateQueue = () => {
    if (isDisabled || !currentUserId) return
    Keyboard.dismiss()
    useBatchCaptureStore
      .getState()
      .createQueue(currentUserId, parsedInput.items, targetCollectionId)
    setRawInput('')
  }

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={styles.composer}
    >
      <TextThemed style={styles.title}>Capture a word list</TextThemed>
      <TextThemed
        style={styles.description}
        lightColor={Colors.light.textSecondary}
        darkColor={Colors.dark.textSecondary}
      >
        Enter one Dutch word or expression per line. Add an optional translation
        after a semicolon. You will review every AI analysis before saving.
      </TextThemed>

      {isInputFocused && (
        <TouchableOpacity
          testID="create-batch-queue-compact-button"
          accessibilityRole="button"
          disabled={isDisabled}
          onPress={handleCreateQueue}
          style={[
            styles.compactAction,
            { borderColor: primaryColor },
            isDisabled && styles.disabled,
          ]}
        >
          <TextThemed
            style={[styles.compactActionText, { color: primaryColor }]}
          >
            Create queue
          </TextThemed>
        </TouchableOpacity>
      )}

      <TextInput
        testID="batch-capture-input"
        accessibilityLabel="Dutch word list"
        value={rawInput}
        onChangeText={setRawInput}
        onFocus={() => setIsInputFocused(true)}
        onBlur={() => setIsInputFocused(false)}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={'huis ; house\nopstaan ; to get up\nhoe gaat het'}
        placeholderTextColor={
          isDarkMode ? Colors.dark.textTertiary : Colors.neutral[400]
        }
        style={[
          styles.input,
          {
            color: isDarkMode ? Colors.dark.text : Colors.light.text,
            backgroundColor: surfaceColor,
            borderColor,
          },
        ]}
      />

      <CollectionSelector
        selectedCollection={selectedCollection}
        onPress={onOpenCollectionSelector}
        colorScheme={colorScheme}
      />

      <TextThemed
        testID="batch-parse-summary"
        style={styles.summary}
        lightColor={Colors.light.textSecondary}
        darkColor={Colors.dark.textSecondary}
      >
        {parsedInput.items.length} valid item
        {parsedInput.items.length === 1 ? '' : 's'} · maximum 30
      </TextThemed>

      {parsedInput.issues.map(issue => (
        <TextThemed
          key={`${issue.line}-${issue.code}`}
          style={[
            styles.issue,
            {
              color: issue.blocking
                ? isDarkMode
                  ? Colors.error.darkMode
                  : Colors.error.DEFAULT
                : isDarkMode
                  ? Colors.warning.dark
                  : Colors.warning.DEFAULT,
            },
          ]}
        >
          Line {issue.line}: {issue.message}
        </TextThemed>
      ))}

      <TouchableOpacity
        testID="create-batch-queue-button"
        accessibilityRole="button"
        disabled={isDisabled}
        onPress={handleCreateQueue}
        style={[
          styles.primaryButton,
          { backgroundColor: primaryColor },
          isDisabled && styles.disabled,
        ]}
      >
        <TextThemed
          style={styles.primaryButtonText}
          lightColor={Colors.legacy.white}
          darkColor={Colors.legacy.white}
        >
          Create review queue
        </TextThemed>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  composer: {
    padding: 20,
    gap: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  compactAction: {
    minHeight: 42,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactActionText: {
    fontSize: 16,
    fontWeight: '600',
  },
  description: {
    fontSize: 15,
    lineHeight: 21,
  },
  input: {
    minHeight: 220,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    fontSize: 17,
    lineHeight: 25,
    textAlignVertical: 'top',
  },
  summary: {
    fontSize: 13,
  },
  issue: {
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.45,
  },
})

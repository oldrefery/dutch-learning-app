import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, View, useColorScheme } from 'react-native'
import { TextInput } from 'react-native-gesture-handler'
import { TextThemed } from '@/components/Themed'
import { GlassModalCenter } from '@/components/glass/modals/GlassModalCenter'
import { Colors } from '@/constants/Colors'
import { LiquidGlassRadius } from '@/constants/GlassConstants'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'

export type RenameCollectionSheetProps = {
  visible: boolean
  currentName: string
  onClose: () => void
  onRename: (newName: string) => Promise<void>
}

export const RenameCollectionSheet: React.FC<RenameCollectionSheetProps> = ({
  visible,
  currentName,
  onClose,
  onRename,
}) => {
  const [newName, setNewName] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [isFocused, setIsFocused] = useState<boolean>(false)
  const colorScheme = useColorScheme()

  // Update name when modal opens
  useEffect(() => {
    if (visible) {
      setNewName(currentName)
    }
  }, [visible, currentName])

  const canSave = useMemo(() => {
    const trimmed = newName.trim()
    return trimmed.length > 0 && trimmed !== currentName && !isSubmitting
  }, [newName, currentName, isSubmitting])

  const handleSave = useCallback(async () => {
    if (!canSave) return
    setIsSubmitting(true)
    try {
      await onRename(newName.trim())
      onClose()
    } catch (error) {
      // Show error toast with a user-friendly message
      ToastService.show(
        'Failed to rename collection. Please try again.',
        ToastType.ERROR
      )
      console.error('Error renaming collection:', error)
    } finally {
      setIsSubmitting(false)
    }
  }, [canSave, newName, onRename, onClose])

  return (
    <GlassModalCenter
      visible={visible}
      title="Rename Collection"
      onClose={onClose}
      leftAction={{
        label: 'Cancel',
        onPress: onClose,
        accessibilityLabel: 'Cancel rename',
        testID: 'cancel-button',
      }}
      rightAction={{
        label: 'Save',
        onPress: handleSave,
        disabled: !canSave,
        accessibilityLabel: 'Save collection name',
        testID: 'save-button',
      }}
    >
      <View>
        <TextThemed style={styles.label}>Collection Name</TextThemed>
        <TextInput
          testID="collection-name-input"
          style={[
            styles.input,
            styles.inputThemedColors,
            isFocused && {
              borderColor:
                colorScheme === 'dark'
                  ? Colors.transparent.white50
                  : Colors.transparent.white60,
            },
          ]}
          value={newName}
          onChangeText={setNewName}
          placeholder="Enter collection name"
          placeholderTextColor={Colors.neutral[500]}
          autoFocus
          selectTextOnFocus
          maxLength={50}
          returnKeyType="done"
          onSubmitEditing={handleSave}
          editable={!isSubmitting}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        <TextThemed
          style={styles.hint}
          lightColor={Colors.neutral[500]}
          darkColor={Colors.dark.textSecondary}
        >
          Enter a new name for this collection
        </TextThemed>
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
    borderRadius: LiquidGlassRadius.S,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    marginBottom: 12,
    letterSpacing: -0.41,
    minHeight: 50,
  },
  inputThemedColors: {
    backgroundColor: Colors.transparent.white10,
    borderColor: Colors.transparent.white30,
    color: Colors.text.primary,
  },
  hint: {
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: -0.24,
  },
})

export default RenameCollectionSheet

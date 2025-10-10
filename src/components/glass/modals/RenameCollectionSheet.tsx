import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { TextInput } from 'react-native-gesture-handler'
import { TextThemed } from '@/components/Themed'
import { GlassModalCenter } from '@/components/glass/modals/GlassModalCenter'
import { Colors } from '@/constants/Colors'

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
      }}
      rightAction={{
        label: 'Save',
        onPress: handleSave,
        disabled: !canSave,
        accessibilityLabel: 'Save collection name',
      }}
    >
      <View>
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
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />
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
})

export default RenameCollectionSheet

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { TextInput } from 'react-native-gesture-handler'
import { TextThemed } from '@/components/Themed'
import { GlassModalCenter } from '@/components/glass/modals/GlassModalCenter'
import { Colors } from '@/constants/Colors'

export type CreateCollectionSheetProps = {
  visible: boolean
  onClose: () => void
  onCreate: (name: string) => Promise<void>
}

export const CreateCollectionSheet: React.FC<CreateCollectionSheetProps> = ({
  visible,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // Reset name when modal opens
  useEffect(() => {
    if (visible) {
      setName('')
    }
  }, [visible])

  const canCreate = useMemo(() => {
    const trimmed = name.trim()
    return trimmed.length > 0 && !isSubmitting
  }, [name, isSubmitting])

  const handleCreate = useCallback(async () => {
    if (!canCreate) return
    setIsSubmitting(true)
    try {
      await onCreate(name.trim())
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }, [canCreate, name, onCreate, onClose])

  return (
    <GlassModalCenter
      visible={visible}
      title="New Collection"
      onClose={onClose}
      leftAction={{
        label: 'Cancel',
        onPress: onClose,
        accessibilityLabel: 'Cancel creation',
      }}
      rightAction={{
        label: 'Create',
        onPress: handleCreate,
        disabled: !canCreate,
        accessibilityLabel: 'Create new collection',
      }}
    >
      <View>
        <TextThemed style={styles.label}>Collection Name</TextThemed>
        <TextInput
          style={[styles.input, styles.inputThemedColors]}
          value={name}
          onChangeText={setName}
          placeholder="Enter collection name"
          placeholderTextColor={Colors.neutral[500]}
          autoFocus
          selectTextOnFocus
          maxLength={50}
          returnKeyType="done"
          onSubmitEditing={handleCreate}
        />
        <TextThemed
          style={styles.hint}
          lightColor={Colors.neutral[500]}
          darkColor={Colors.dark.textSecondary}
        >
          Choose a name that helps you identify this collection
        </TextThemed>
      </View>
    </GlassModalCenter>
  )
}

const styles = StyleSheet.create({
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

export default CreateCollectionSheet

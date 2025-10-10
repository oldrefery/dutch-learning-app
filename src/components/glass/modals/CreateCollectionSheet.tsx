import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { TextInput } from 'react-native-gesture-handler'
import { TextThemed } from '@/components/Themed'
import { GlassModalCenter } from '@/components/glass/modals/GlassModalCenter'
import { Colors } from '@/constants/Colors'
import { useCollections } from '@/hooks/useCollections'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import type { Collection } from '@/types/database'

export type CreateCollectionSheetProps = {
  visible: boolean
  onClose: () => void
  onCollectionCreated?: (collection: Collection) => void
}

export const CreateCollectionSheet: React.FC<CreateCollectionSheetProps> = ({
  visible,
  onClose,
  onCollectionCreated,
}) => {
  const [name, setName] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const { createNewCollection } = useCollections()

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

    const trimmedName = name.trim()
    setIsSubmitting(true)

    try {
      const newCollection = await createNewCollection(trimmedName)

      ToastService.show(
        `Collection "${trimmedName}" created successfully`,
        ToastType.SUCCESS
      )

      onCollectionCreated?.(newCollection)
      onClose()
    } catch {
      ToastService.show(
        'Failed to create collection. Please try again.',
        ToastType.ERROR
      )
    } finally {
      setIsSubmitting(false)
    }
  }, [canCreate, name, createNewCollection, onCollectionCreated, onClose])

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

export default CreateCollectionSheet

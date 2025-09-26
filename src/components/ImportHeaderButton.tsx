import React from 'react'
import {
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  StyleSheet,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/constants/Colors'

interface ImportHeaderButtonProps {
  importing: boolean
  selectedCount: number
  onPress: () => void
}

export function ImportHeaderButton({
  importing,
  selectedCount,
  onPress,
}: ImportHeaderButtonProps) {
  const colorScheme = useColorScheme() ?? 'light'
  const disabled = importing || selectedCount === 0

  return (
    <TouchableOpacity
      style={[
        styles.importButton,
        {
          opacity: disabled ? 0.6 : 1,
        },
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel="Import selected words"
      accessibilityHint={`Import ${selectedCount} selected words to your collection`}
    >
      {importing ? (
        <ActivityIndicator
          size="small"
          color={
            colorScheme === 'dark' ? Colors.dark.tint : Colors.primary.DEFAULT
          }
        />
      ) : (
        <Ionicons
          name="checkmark"
          size={24}
          color={
            colorScheme === 'dark' ? Colors.dark.tint : Colors.primary.DEFAULT
          }
        />
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  importButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },
})

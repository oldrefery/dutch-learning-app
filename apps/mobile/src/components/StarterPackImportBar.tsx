import React from 'react'
import { ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'

interface StarterPackImportBarProps {
  importing: boolean
  selectedCount: number
  disabled: boolean
  onImport: () => void
}

export function StarterPackImportBar({
  importing,
  selectedCount,
  disabled,
  onImport,
}: StarterPackImportBarProps) {
  const colorScheme = useNormalizedColorScheme()
  const isDisabled = disabled || importing || selectedCount === 0
  const wordLabel = selectedCount === 1 ? 'word' : 'words'

  return (
    <ViewThemed
      style={[
        styles.container,
        {
          borderTopColor:
            colorScheme === 'dark' ? Colors.dark.border : Colors.neutral[300],
        },
      ]}
    >
      <TouchableOpacity
        testID="starter-pack-import-button"
        style={[styles.button, isDisabled && styles.buttonDisabled]}
        onPress={onImport}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel={`Import ${selectedCount} selected ${wordLabel}`}
        accessibilityState={{ disabled: isDisabled }}
      >
        {importing ? (
          <ActivityIndicator size="small" color={Colors.legacy.white} />
        ) : (
          <TextThemed style={styles.buttonText}>
            {`Import ${selectedCount} ${wordLabel}`}
          </TextThemed>
        )}
      </TouchableOpacity>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  button: {
    minHeight: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary.DEFAULT,
    paddingHorizontal: 24,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: Colors.legacy.white,
    fontSize: 17,
    fontWeight: '700',
  },
})

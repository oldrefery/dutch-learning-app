import React from 'react'
import { TouchableOpacity, StyleSheet, useColorScheme } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'

interface DuplicateFilterToggleProps {
  hideDuplicates: boolean
  onToggle: () => void
  duplicateCount: number
}

export function DuplicateFilterToggle({
  hideDuplicates,
  onToggle,
  duplicateCount,
}: DuplicateFilterToggleProps) {
  const colorScheme = useColorScheme() ?? 'light'

  if (duplicateCount === 0) {
    return null // Don't show the toggle if there are no duplicates
  }

  return (
    <ViewThemed style={styles.container}>
      <TouchableOpacity style={styles.toggleButton} onPress={onToggle}>
        <ViewThemed style={styles.toggleContent}>
          <Ionicons
            name={hideDuplicates ? 'eye-off' : 'eye'}
            size={20}
            color={
              colorScheme === 'dark'
                ? Colors.dark.textSecondary
                : Colors.neutral[600]
            }
          />
          <TextThemed
            style={styles.toggleText}
            lightColor={Colors.neutral[600]}
            darkColor={Colors.dark.textSecondary}
          >
            {hideDuplicates ? 'Show' : 'Hide'} {duplicateCount} already added
            word
            {duplicateCount !== 1 ? 's' : ''}
          </TextThemed>
        </ViewThemed>
      </TouchableOpacity>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  toggleButton: {
    paddingVertical: 8,
  },
  toggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
  },
})

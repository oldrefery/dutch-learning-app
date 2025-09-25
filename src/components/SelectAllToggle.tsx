import React from 'react'
import { TouchableOpacity, useColorScheme, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'

interface SelectAllToggleProps {
  allSelected: boolean
  onToggle: () => void
  duplicateCount?: number
}

export function SelectAllToggle({
  allSelected,
  onToggle,
  duplicateCount = 0,
}: SelectAllToggleProps) {
  const colorScheme = useColorScheme() ?? 'light'

  return (
    <ViewThemed style={styles.selectAllSection}>
      <TouchableOpacity style={styles.selectAllButton} onPress={onToggle}>
        <Ionicons
          name={allSelected ? 'checkbox' : 'square-outline'}
          size={24}
          color={
            colorScheme === 'dark' ? Colors.dark.tint : Colors.primary.DEFAULT
          }
        />
        <TextThemed style={styles.selectAllText}>
          {allSelected ? 'Deselect All' : 'Select All'}
          {duplicateCount > 0 && ` Available`}
        </TextThemed>
      </TouchableOpacity>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  selectAllSection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  selectAllText: {
    fontSize: 16,
    marginLeft: 12,
    fontWeight: '500',
  },
})

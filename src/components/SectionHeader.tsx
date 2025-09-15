import React from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'

interface SectionHeaderProps {
  title: string
  showAddButton?: boolean
  onAddPress?: () => void
}

export default function SectionHeader({
  title,
  showAddButton = false,
  onAddPress,
}: SectionHeaderProps) {
  return (
    <ViewThemed style={styles.sectionHeader}>
      <TextThemed style={styles.sectionTitle}>{title}</TextThemed>
      {showAddButton && onAddPress && (
        <TouchableOpacity style={styles.addButton} onPress={onAddPress}>
          <Ionicons name="add" size={20} color={Colors.primary.DEFAULT} />
          <TextThemed style={styles.addButtonText}>Add</TextThemed>
        </TouchableOpacity>
      )}
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.neutral[900],
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.neutral[100],
  },
  addButtonText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary.DEFAULT,
  },
})

import React from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Text, View } from '@/components/Themed'

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
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {showAddButton && onAddPress && (
        <TouchableOpacity style={styles.addButton} onPress={onAddPress}>
          <Ionicons name="add" size={20} color="#3b82f6" />
          <Text style={styles.addButtonText}>Add</Text>
        </TouchableOpacity>
      )}
    </View>
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
    color: '#111827',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  addButtonText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
    color: '#3b82f6',
  },
})

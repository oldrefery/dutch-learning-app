import React from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'

interface SectionHeaderProps {
  title: string
  showAddButton?: boolean
  addButtonText?: string
  onAddPress?: () => void
  showImportButton?: boolean
  onImportPress?: () => void
}

export default function SectionHeader({
  title,
  showAddButton = false,
  addButtonText = 'Add',
  onAddPress,
  showImportButton = false,
  onImportPress,
}: SectionHeaderProps) {
  return (
    <ViewThemed style={styles.sectionHeader}>
      <TextThemed style={styles.sectionTitle}>{title}</TextThemed>
      <ViewThemed style={styles.buttonsContainer}>
        {showImportButton && onImportPress && (
          <TouchableOpacity style={styles.importButton} onPress={onImportPress}>
            <Ionicons
              name="cloud-download-outline"
              size={20}
              color={Colors.primary.DEFAULT}
            />
            <TextThemed style={styles.importButtonText}>Import</TextThemed>
          </TouchableOpacity>
        )}
        {showAddButton && onAddPress && (
          <TouchableOpacity style={styles.addButton} onPress={onAddPress}>
            <Ionicons name="add" size={20} color={Colors.primary.DEFAULT} />
            <TextThemed style={styles.addButtonText}>
              {addButtonText}
            </TextThemed>
          </TouchableOpacity>
        )}
      </ViewThemed>
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
  buttonsContainer: {
    flexDirection: 'row',
    gap: 8,
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
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.neutral[100],
  },
  importButtonText: {
    marginLeft: 4,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.primary.DEFAULT,
  },
})

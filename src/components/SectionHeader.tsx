import React from 'react'
import { StyleSheet, View } from 'react-native'
import { TextThemed } from '@/components/Themed'
import { GlassCapsuleButton } from '@/components/glass/buttons'

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
    <View style={styles.sectionHeader}>
      <TextThemed style={styles.sectionTitle}>{title}</TextThemed>
      <View style={styles.buttonsContainer}>
        {showImportButton && onImportPress && (
          <GlassCapsuleButton
            testID="import-collection-button"
            icon="cloud-download-outline"
            text="Import"
            onPress={onImportPress}
            variant="tinted"
            size="medium"
            accessibilityLabel="Import collection"
            accessibilityHint="Opens dialog to import a collection using a share code"
          />
        )}
        {showAddButton && onAddPress && (
          <GlassCapsuleButton
            testID="create-collection-button"
            icon="add"
            text={addButtonText}
            onPress={onAddPress}
            variant="tinted"
            size="medium"
            accessibilityLabel={`Create ${addButtonText.toLowerCase()}`}
            accessibilityHint="Opens dialog to create a new collection"
          />
        )}
      </View>
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
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
})

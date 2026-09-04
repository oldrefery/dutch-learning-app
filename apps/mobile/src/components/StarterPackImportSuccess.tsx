import React from 'react'
import { StyleSheet, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'

interface StarterPackImportSuccessProps {
  importedCount: number
  collectionName: string
  onStartReview: () => void
  onBackToCollections: () => void
}

export function StarterPackImportSuccess({
  importedCount,
  collectionName,
  onStartReview,
  onBackToCollections,
}: StarterPackImportSuccessProps) {
  return (
    <ViewThemed testID="starter-pack-import-success" style={styles.container}>
      <ViewThemed style={styles.iconContainer}>
        <Ionicons
          name="checkmark-circle"
          size={72}
          color={Colors.success.DEFAULT}
        />
      </ViewThemed>
      <TextThemed style={styles.title}>Starter pack imported</TextThemed>
      <TextThemed
        style={styles.message}
        lightColor={Colors.neutral[600]}
        darkColor={Colors.dark.textSecondary}
      >
        {`${importedCount} ${importedCount === 1 ? 'word is' : 'words are'} ready in “${collectionName}”.`}
      </TextThemed>
      <TouchableOpacity
        testID="starter-pack-start-review"
        style={styles.primaryButton}
        onPress={onStartReview}
        accessibilityRole="button"
        accessibilityLabel="Start first review"
      >
        <Ionicons name="play" size={20} color={Colors.legacy.white} />
        <TextThemed style={styles.primaryButtonText}>Start Review</TextThemed>
      </TouchableOpacity>
      <TouchableOpacity
        testID="starter-pack-back-to-collections"
        style={styles.secondaryButton}
        onPress={onBackToCollections}
        accessibilityRole="button"
        accessibilityLabel="Back to collections"
      >
        <TextThemed
          style={styles.secondaryButtonText}
          lightColor={Colors.primary.DEFAULT}
          darkColor={Colors.dark.tint}
        >
          Back to Collections
        </TextThemed>
      </TouchableOpacity>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 28,
  },
  primaryButton: {
    minHeight: 48,
    minWidth: 220,
    borderRadius: 24,
    backgroundColor: Colors.primary.DEFAULT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
  },
  primaryButtonText: {
    color: Colors.legacy.white,
    fontSize: 17,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 44,
    justifyContent: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
})

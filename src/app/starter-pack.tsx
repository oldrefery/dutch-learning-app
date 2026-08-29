import React from 'react'
import { StyleSheet, TouchableOpacity, useColorScheme } from 'react-native'
import { Stack } from 'expo-router'
import { TextThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { ImportHeaderButton } from '@/components/ImportHeaderButton'
import { ImportScreenContent } from '@/components/ImportScreenContent'
import { SharedCollectionErrorScreen } from '@/components/SharedCollectionErrorScreen'
import { SharedCollectionLoadingScreen } from '@/components/SharedCollectionLoadingScreen'
import { StarterPackImportSuccess } from '@/components/StarterPackImportSuccess'
import { StarterPackImportBar } from '@/components/StarterPackImportBar'
import { StarterPackReviewBanner } from '@/components/StarterPackReviewBanner'
import { useStarterPackImport } from '@/hooks/useStarterPackImport'

export default function StarterPackScreen() {
  const colorScheme = useColorScheme() ?? 'light'
  const starterPack = useStarterPackImport()

  if (starterPack.loading) {
    return (
      <SharedCollectionLoadingScreen
        title="Dutch A1 Starter Pack"
        message="Preparing the offline pack..."
      />
    )
  }

  if (starterPack.error || !starterPack.previewData || !starterPack.manifest) {
    return (
      <SharedCollectionErrorScreen
        title="Dutch A1 Starter Pack"
        error={starterPack.error ?? 'No starter pack data is available.'}
        onGoBack={starterPack.handleGoBack}
      />
    )
  }

  if (starterPack.success) {
    return (
      <>
        <Stack.Screen
          options={{
            title: 'Dutch A1 Starter Pack',
            headerBackVisible: false,
            headerStyle: {
              backgroundColor:
                colorScheme === 'dark'
                  ? Colors.dark.backgroundSecondary
                  : Colors.background.secondary,
            },
          }}
        />
        <StarterPackImportSuccess
          importedCount={starterPack.success.importedCount}
          collectionName={starterPack.success.collectionName}
          onStartReview={starterPack.handleStartReview}
          onBackToCollections={starterPack.handleBackToCollections}
        />
      </>
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Dutch A1 Starter Pack',
          headerBackTitle: 'Back',
          headerStyle: {
            backgroundColor:
              colorScheme === 'dark'
                ? Colors.dark.backgroundSecondary
                : Colors.background.secondary,
          },
          headerLeft: () => (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={starterPack.handleGoBack}
              accessibilityLabel="Cancel"
              accessibilityHint="Cancel starter pack import and go back"
            >
              <TextThemed
                style={styles.cancelButtonText}
                lightColor={Colors.primary.DEFAULT}
                darkColor={Colors.dark.tint}
              >
                Cancel
              </TextThemed>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <ImportHeaderButton
              importing={starterPack.importing}
              selectedCount={starterPack.selectedCount}
              disabled={!starterPack.importEnabled}
              onPress={starterPack.handleImport}
            />
          ),
        }}
      />

      <ImportScreenContent
        sharedData={starterPack.previewData}
        wordSelections={starterPack.wordSelections}
        collections={starterPack.collections}
        targetCollectionId={starterPack.targetCollectionId}
        selectedCount={starterPack.selectedCount}
        duplicateCount={starterPack.duplicateCount}
        allAvailableSelected={starterPack.allAvailableSelected}
        hideDuplicates={starterPack.hideDuplicates}
        contentBeforeTarget={
          <StarterPackReviewBanner
            manifest={starterPack.manifest}
            importEnabled={starterPack.importEnabled}
          />
        }
        bottomBar={
          <StarterPackImportBar
            importing={starterPack.importing}
            selectedCount={starterPack.selectedCount}
            disabled={!starterPack.importEnabled}
            onImport={starterPack.handleImport}
          />
        }
        onSelectCollection={starterPack.setTargetCollectionId}
        onToggleSelectAll={starterPack.toggleSelectAll}
        onToggleWord={starterPack.toggleWordSelection}
        onToggleHideDuplicates={starterPack.toggleHideDuplicates}
      />
    </>
  )
}

const styles = StyleSheet.create({
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: '400',
  },
})

import React from 'react'
import { StyleSheet, TouchableOpacity, useColorScheme } from 'react-native'
import { Stack, useLocalSearchParams } from 'expo-router'
import { TextThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { ImportHeaderButton } from '@/components/ImportHeaderButton'
import { ImportScreenContent } from '@/components/ImportScreenContent'
import { SharedCollectionErrorScreen } from '@/components/SharedCollectionErrorScreen'
import { SharedCollectionLoadingScreen } from '@/components/SharedCollectionLoadingScreen'
import { StarterPackImportSuccess } from '@/components/StarterPackImportSuccess'
import { StarterPackImportBar } from '@/components/StarterPackImportBar'
import { StarterPackReviewBanner } from '@/components/StarterPackReviewBanner'
import {
  useStarterPackImport,
  NEW_STARTER_COLLECTION_ID,
} from '@/hooks/useStarterPackImport'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { isDictionaryFollowingImportsEnabled } from '@/constants/dictionaryContent'
import { DictionaryFollowingTransferPanel } from '@/components/DictionaryFollowingTransferPanel'
import type { OfficialContentManifest } from '@woordenaar/content/manifest'

interface StarterPackScreenContentProps {
  packId?: string
  version?: string
}

export function StarterPackScreenContent({
  packId,
  version,
}: StarterPackScreenContentProps) {
  const colorScheme = useColorScheme() ?? 'light'
  const ownerId = useApplicationStore(state => state.currentUserId)
  const starterPack = useStarterPackImport({ packId, version })
  const screenTitle = starterPack.manifest?.title ?? 'Official Pack'

  if (starterPack.loading) {
    return (
      <SharedCollectionLoadingScreen
        title={screenTitle}
        message={
          packId
            ? 'Downloading and verifying the pack…'
            : 'Preparing the offline pack…'
        }
      />
    )
  }

  if (starterPack.error || !starterPack.previewData || !starterPack.manifest) {
    return (
      <SharedCollectionErrorScreen
        title={screenTitle}
        error={starterPack.error ?? 'No starter pack data is available.'}
        onGoBack={starterPack.handleGoBack}
        onRetry={starterPack.retryRemotePack}
        showRetry={Boolean(packId && version)}
      />
    )
  }

  if (isDictionaryFollowingImportsEnabled()) {
    if (!ownerId)
      return (
        <SharedCollectionErrorScreen
          title={screenTitle}
          error="Sign in to prepare an official shared pack import."
          onGoBack={starterPack.handleGoBack}
        />
      )
    return (
      <DictionaryFollowingTransferPanel
        ownerId={ownerId}
        officialManifest={
          starterPack.manifest as unknown as OfficialContentManifest
        }
        collections={starterPack.collections.filter(
          row => row.collection_id !== NEW_STARTER_COLLECTION_ID
        )}
        onClose={starterPack.handleBackToCollections}
      />
    )
  }

  if (starterPack.success) {
    return (
      <>
        <Stack.Screen
          options={{
            title: screenTitle,
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
          title: screenTitle,
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

export default function StarterPackScreen() {
  const currentUserId = useApplicationStore(state => state.currentUserId)
  const { packId, version } = useLocalSearchParams<{
    packId?: string
    version?: string
  }>()
  const routeIdentity = `${currentUserId ?? 'signed-out'}:${
    packId ?? 'bundled'
  }@${version ?? 'bundled'}`

  return (
    <StarterPackScreenContent
      key={routeIdentity}
      packId={packId}
      version={version}
    />
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

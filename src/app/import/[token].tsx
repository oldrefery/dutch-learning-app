import React from 'react'
import { StyleSheet, TouchableOpacity, useColorScheme } from 'react-native'
import { useLocalSearchParams, Stack } from 'expo-router'
import { TextThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { SharedCollectionLoadingScreen } from '@/components/SharedCollectionLoadingScreen'
import { SharedCollectionErrorScreen } from '@/components/SharedCollectionErrorScreen'
import { ImportHeaderButton } from '@/components/ImportHeaderButton'
import { ImportScreenContent } from '@/components/ImportScreenContent'
import { useImportSelection } from '@/hooks/useImportSelection'

export default function ImportSelectionScreen() {
  const { token } = useLocalSearchParams<{ token: string }>()
  const colorScheme = useColorScheme() ?? 'light'

  const {
    loading,
    sharedData,
    error,
    wordSelections,
    collections,
    targetCollectionId,
    importing,
    selectedCount,
    duplicateCount,
    allAvailableSelected,
    setTargetCollectionId,
    toggleWordSelection,
    toggleSelectAll,
    handleImport,
    handleGoBack,
  } = useImportSelection(token || '')

  if (loading) {
    return (
      <SharedCollectionLoadingScreen
        title="Import Words"
        message="Loading words..."
      />
    )
  }

  if (error || !sharedData) {
    return (
      <SharedCollectionErrorScreen
        title="Import Words"
        error={error || 'No data available'}
        onGoBack={handleGoBack}
        showRetry={false}
      />
    )
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Import Words',
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
              onPress={handleGoBack}
              accessibilityLabel="Cancel"
              accessibilityHint="Cancel import and go back"
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
              importing={importing}
              selectedCount={selectedCount}
              onPress={handleImport}
            />
          ),
        }}
      />

      <ImportScreenContent
        sharedData={sharedData}
        wordSelections={wordSelections}
        collections={collections}
        targetCollectionId={targetCollectionId}
        selectedCount={selectedCount}
        duplicateCount={duplicateCount}
        allAvailableSelected={allAvailableSelected}
        onSelectCollection={setTargetCollectionId}
        onToggleSelectAll={toggleSelectAll}
        onToggleWord={toggleWordSelection}
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

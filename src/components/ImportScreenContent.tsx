import React from 'react'
import type { ReactNode } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { ViewThemed } from '@/components/Themed'
import { ImportCollectionHeader } from '@/components/ImportCollectionHeader'
import { ImportTargetSection } from '@/components/ImportTargetSection'
import { SelectAllToggle } from '@/components/SelectAllToggle'
import { DuplicateFilterToggle } from '@/components/DuplicateFilterToggle'
import { WordSelectionList } from '@/components/WordSelectionList'
import type {
  ImportPreviewData,
  ImportTargetCollection,
  WordSelectionItem,
} from '@/types/ImportTypes'

interface ImportScreenContentProps {
  sharedData: ImportPreviewData
  wordSelections: WordSelectionItem[]
  collections: ImportTargetCollection[]
  targetCollectionId: string | null
  selectedCount: number
  duplicateCount: number
  allAvailableSelected: boolean
  hideDuplicates: boolean
  contentBeforeTarget?: ReactNode
  bottomBar?: ReactNode
  onSelectCollection: (collectionId: string) => void
  onToggleSelectAll: () => void
  onToggleWord: (wordId: string) => void
  onToggleHideDuplicates: () => void
}

export function ImportScreenContent({
  sharedData,
  wordSelections,
  collections,
  targetCollectionId,
  selectedCount,
  duplicateCount,
  allAvailableSelected,
  hideDuplicates,
  contentBeforeTarget,
  bottomBar,
  onSelectCollection,
  onToggleSelectAll,
  onToggleWord,
  onToggleHideDuplicates,
}: ImportScreenContentProps) {
  return (
    <ViewThemed style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <ImportCollectionHeader
          sharedData={sharedData}
          selectedCount={selectedCount}
          totalCount={
            wordSelections.length + (hideDuplicates ? duplicateCount : 0)
          }
          duplicateCount={duplicateCount}
        />

        {contentBeforeTarget}

        <ImportTargetSection
          collections={collections}
          targetCollectionId={targetCollectionId}
          onSelectCollection={onSelectCollection}
        />

        <SelectAllToggle
          allSelected={allAvailableSelected}
          onToggle={onToggleSelectAll}
          duplicateCount={duplicateCount}
        />

        <DuplicateFilterToggle
          hideDuplicates={hideDuplicates}
          onToggle={onToggleHideDuplicates}
          duplicateCount={duplicateCount}
        />

        <WordSelectionList
          wordSelections={wordSelections}
          onToggleWord={onToggleWord}
        />
      </ScrollView>
      {bottomBar}
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
})

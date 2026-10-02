import React from 'react'
import type { ReactNode } from 'react'
import { FlatList, ScrollView, StyleSheet } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { ImportCollectionHeader } from '@/components/ImportCollectionHeader'
import { ImportTargetSection } from '@/components/ImportTargetSection'
import { SelectAllToggle } from '@/components/SelectAllToggle'
import { DuplicateFilterToggle } from '@/components/DuplicateFilterToggle'
import {
  WordSelectionList,
  WordSelectionRow,
} from '@/components/WordSelectionList'
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
  virtualizeWords?: boolean
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
  virtualizeWords = false,
  onSelectCollection,
  onToggleSelectAll,
  onToggleWord,
  onToggleHideDuplicates,
}: ImportScreenContentProps) {
  const header = (
    <>
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
    </>
  )
  return (
    <ViewThemed style={styles.container}>
      {virtualizeWords ? (
        <FlatList
          data={wordSelections}
          keyExtractor={item => item.word.word_id}
          ListHeaderComponent={
            <>
              {header}
              <TextThemed style={styles.wordsTitle}>Words</TextThemed>
            </>
          }
          renderItem={({ item }) => (
            <ViewThemed style={styles.wordRow}>
              <WordSelectionRow item={item} onToggleWord={onToggleWord} />
            </ViewThemed>
          )}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
        >
          {header}
          <WordSelectionList
            wordSelections={wordSelections}
            onToggleWord={onToggleWord}
          />
        </ScrollView>
      )}
      {bottomBar}
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  wordsTitle: { padding: 16, fontSize: 18, fontWeight: '600' },
  wordRow: { paddingHorizontal: 16 },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
})

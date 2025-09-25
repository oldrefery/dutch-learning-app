import React from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { ViewThemed } from '@/components/Themed'
import { ImportCollectionHeader } from '@/components/ImportCollectionHeader'
import { ImportTargetSection } from '@/components/ImportTargetSection'
import { SelectAllToggle } from '@/components/SelectAllToggle'
import { WordSelectionList } from '@/components/WordSelectionList'
import type { SharedCollectionWords } from '@/services/collectionSharingService'

interface Collection {
  collection_id: string
  name: string
}

interface WordSelection {
  word: {
    word_id: string
    dutch_lemma: string
    translations: {
      en: string[]
    }
  }
  selected: boolean
  isDuplicate: boolean
  existingInCollection?: string
}

interface ImportScreenContentProps {
  sharedData: SharedCollectionWords
  wordSelections: WordSelection[]
  collections: Collection[]
  targetCollectionId: string | null
  selectedCount: number
  duplicateCount: number
  allAvailableSelected: boolean
  onSelectCollection: (collectionId: string) => void
  onToggleSelectAll: () => void
  onToggleWord: (wordId: string) => void
}

export function ImportScreenContent({
  sharedData,
  wordSelections,
  collections,
  targetCollectionId,
  selectedCount,
  duplicateCount,
  allAvailableSelected,
  onSelectCollection,
  onToggleSelectAll,
  onToggleWord,
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
          totalCount={wordSelections.length}
          duplicateCount={duplicateCount}
        />

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

        <WordSelectionList
          wordSelections={wordSelections}
          onToggleWord={onToggleWord}
        />
      </ScrollView>
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

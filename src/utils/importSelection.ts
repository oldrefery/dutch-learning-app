import type { Collection, Word } from '@/types/database'
import type { ImportableWord, WordSelectionItem } from '@/types/ImportTypes'

const normalizeLemma = (value?: string | null): string =>
  value && value.trim() !== '' ? value.trim().toLowerCase() : ''

const normalizePartOfSpeech = (value?: string | null): string =>
  value && value.trim() !== '' ? value.trim().toLowerCase() : 'unknown'

const normalizeArticle = (value?: string | null): string =>
  value && value.trim() !== '' ? value.trim().toLowerCase() : ''

export const getSemanticWordKey = (
  dutchLemma?: string | null,
  partOfSpeech?: string | null,
  article?: string | null
): string =>
  `${normalizeLemma(dutchLemma)}|${normalizePartOfSpeech(partOfSpeech)}|${normalizeArticle(article)}`

export const buildImportWordSelections = (
  words: ImportableWord[],
  existingWords: Word[],
  collections: Pick<Collection, 'collection_id' | 'name'>[]
): WordSelectionItem[] => {
  const collectionNameById = new Map(
    collections.map(collection => [collection.collection_id, collection.name])
  )
  const existingWordCollectionByKey = new Map<string, string | undefined>()

  existingWords.forEach(existingWord => {
    const key = getSemanticWordKey(
      existingWord.dutch_lemma,
      existingWord.part_of_speech,
      existingWord.article
    )

    if (!existingWordCollectionByKey.has(key)) {
      existingWordCollectionByKey.set(
        key,
        existingWord.collection_id
          ? collectionNameById.get(existingWord.collection_id)
          : undefined
      )
    }
  })

  return words.map(word => {
    const semanticKey = getSemanticWordKey(
      word.dutch_lemma,
      word.part_of_speech,
      word.article
    )
    const isDuplicate = existingWordCollectionByKey.has(semanticKey)

    return {
      word,
      selected: !isDuplicate,
      isDuplicate,
      existingInCollection: existingWordCollectionByKey.get(semanticKey),
    }
  })
}

const getWordLabel = (count: number): string => `word${count !== 1 ? 's' : ''}`

const getDuplicateLabel = (count: number): string =>
  `duplicate${count !== 1 ? 's' : ''}`

export const getImportSuccessMessage = (
  selectedCount: number,
  importedCount: number
): string => {
  const skippedCount = Math.max(selectedCount - importedCount, 0)

  if (importedCount === 0) {
    return 'No new words were imported. Selected words already exist in your collection.'
  }

  if (skippedCount > 0) {
    return `Successfully imported ${importedCount} ${getWordLabel(importedCount)}. Skipped ${skippedCount} ${getDuplicateLabel(skippedCount)}.`
  }

  return `Successfully imported ${importedCount} ${getWordLabel(importedCount)}`
}

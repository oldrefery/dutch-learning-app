export interface WordSearchCollectionRow {
  collection_id: string
  name: string
}

export interface WordSearchRow {
  article: string | null
  collection_id: string | null
  dutch_lemma: string
  dutch_original: string | null
  part_of_speech: string | null
  translations: unknown
  word_id: string
}

export interface WordSearchResult {
  collectionId: string
  collectionName: string
  dutchLemma: string
  partOfSpeech: string
  primaryTranslation: string
  wordId: string
}

export const normalizeWordSearchQuery = (query: string): string =>
  query.trim().replace(/\s+/g, ' ').slice(0, 80).toLocaleLowerCase('nl')

const collectTranslations = (translations: unknown): string[] => {
  if (!translations || typeof translations !== 'object') return []

  return Object.values(translations).flatMap(value =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : []
  )
}

export const buildWordSearchResults = (
  rows: readonly WordSearchRow[],
  collections: readonly WordSearchCollectionRow[],
  query: string,
  limit = 40
): WordSearchResult[] => {
  const normalizedQuery = normalizeWordSearchQuery(query)
  if (!normalizedQuery) return []

  const prefix = /^(de|het) (.+)$/.exec(normalizedQuery)
  const suffix = /^(.+) \((de|het)\)$/.exec(normalizedQuery)
  const requestedArticle = suffix?.[2] ?? prefix?.[1]
  const requestedLemma = suffix?.[1] ?? prefix?.[2]
  const collectionNames = new Map(
    collections.map(collection => [collection.collection_id, collection.name])
  )

  return rows
    .flatMap(row => {
      const translations = collectTranslations(row.translations)
      const lemma = row.dutch_lemma.toLocaleLowerCase('nl')
      const exactLemmaMatch =
        lemma === normalizedQuery ||
        (lemma === requestedLemma &&
          (row.article === requestedArticle ||
            (!row.article &&
              (!row.part_of_speech || row.part_of_speech === 'noun'))))
      const searchable = [
        row.dutch_lemma,
        row.dutch_original ?? '',
        ...translations,
      ]
      const collectionName = row.collection_id
        ? collectionNames.get(row.collection_id)
        : null

      if (
        !row.collection_id ||
        !collectionName ||
        (!exactLemmaMatch &&
          !searchable.some(value =>
            value.toLocaleLowerCase('nl').includes(normalizedQuery)
          ))
      ) {
        return []
      }

      return [
        {
          exactLemmaMatch,
          result: {
            collectionId: row.collection_id,
            collectionName,
            dutchLemma: row.dutch_lemma,
            partOfSpeech: row.part_of_speech ?? 'other',
            primaryTranslation: translations[0] ?? 'Translation unavailable',
            wordId: row.word_id,
          },
        },
      ]
    })
    .sort(
      (left, right) =>
        Number(right.exactLemmaMatch) - Number(left.exactLemmaMatch) ||
        left.result.dutchLemma.localeCompare(right.result.dutchLemma, 'nl')
    )
    .slice(0, limit)
    .map(({ result }) => result)
}

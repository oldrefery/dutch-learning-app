import type { DictionaryCardMetadata } from '@/features/dictionary/content'
import type { ReviewWord, ReviewWorkspaceData } from './types'

// Private, same-build page transport. Named tuple slots keep every personal value
// while avoiding repeated property names in large embedded RSC payloads.
type SerializedReviewWord = [
  article: ReviewWord['article'],
  collectionId: ReviewWord['collectionId'],
  dutchLemma: ReviewWord['dutchLemma'],
  dutchOriginal: ReviewWord['dutchOriginal'],
  easinessFactor: ReviewWord['easinessFactor'],
  id: ReviewWord['id'],
  imageUrl: ReviewWord['imageUrl'],
  intervalDays: ReviewWord['intervalDays'],
  lastReviewedAt: ReviewWord['lastReviewedAt'],
  nextReviewDate: ReviewWord['nextReviewDate'],
  partOfSpeech: ReviewWord['partOfSpeech'],
  repetitionCount: ReviewWord['repetitionCount'],
  translations: ReviewWord['translations'],
  ttsUrl: ReviewWord['ttsUrl'],
  dictionaryIndex: number | null,
]

interface IndexedReviewWorkspaceData extends Omit<
  ReviewWorkspaceData,
  'words'
> {
  words: SerializedReviewWord[]
  dictionaryMetadata: DictionaryCardMetadata[]
}

export interface SerializedReviewWorkspaceData {
  serializedReviewWorkspace: string
}

/** Share exact dictionary descriptors on the page wire; every personal word stays separate. */
export function serializeReviewWorkspace(
  data: ReviewWorkspaceData
): ReviewWorkspaceData | SerializedReviewWorkspaceData {
  if (data.dictionaryWatermark === undefined) return data
  const indices = new Map<string, number>()
  const dictionaryMetadata: DictionaryCardMetadata[] = []
  const words = data.words.map((word): SerializedReviewWord => {
    let dictionaryIndex: number | null = null
    if (word.dictionary) {
      const key = JSON.stringify(word.dictionary)
      dictionaryIndex = indices.get(key) ?? null
      if (dictionaryIndex === null) {
        dictionaryIndex = dictionaryMetadata.length
        indices.set(key, dictionaryIndex)
        dictionaryMetadata.push(word.dictionary)
      }
    }
    return [
      word.article,
      word.collectionId,
      word.dutchLemma,
      word.dutchOriginal,
      word.easinessFactor,
      word.id,
      word.imageUrl,
      word.intervalDays,
      word.lastReviewedAt,
      word.nextReviewDate,
      word.partOfSpeech,
      word.repetitionCount,
      word.translations,
      word.ttsUrl,
      dictionaryIndex,
    ]
  })
  const indexed: IndexedReviewWorkspaceData = {
    ...data,
    words,
    dictionaryMetadata,
  }
  // The repository already validates this JSON-only snapshot. Passing one string
  // avoids a second per-field RSC traversal on both sides of the page boundary.
  return { serializedReviewWorkspace: JSON.stringify(indexed) }
}

/** Recreate independent per-word metadata before controllers can observe the page data. */
export function deserializeReviewWorkspace(
  data: ReviewWorkspaceData | SerializedReviewWorkspaceData
): ReviewWorkspaceData {
  if (!('serializedReviewWorkspace' in data)) return data
  const indexed = JSON.parse(
    data.serializedReviewWorkspace
  ) as IndexedReviewWorkspaceData
  const { dictionaryMetadata, words: serializedWords, ...workspace } = indexed
  const words = serializedWords.map((row): ReviewWord => {
    if (!Array.isArray(row) || row.length !== 15) {
      throw new Error('Invalid review word tuple.')
    }
    const [
      article,
      collectionId,
      dutchLemma,
      dutchOriginal,
      easinessFactor,
      id,
      imageUrl,
      intervalDays,
      lastReviewedAt,
      nextReviewDate,
      partOfSpeech,
      repetitionCount,
      translations,
      ttsUrl,
      dictionaryIndex,
    ] = row
    const word: ReviewWord = {
      article,
      collectionId,
      dutchLemma,
      dutchOriginal,
      easinessFactor,
      id,
      imageUrl,
      intervalDays,
      lastReviewedAt,
      nextReviewDate,
      partOfSpeech,
      repetitionCount,
      translations,
      ttsUrl,
    }
    if (dictionaryIndex === null) return word
    if (
      !Number.isInteger(dictionaryIndex) ||
      dictionaryIndex < 0 ||
      dictionaryIndex >= dictionaryMetadata.length
    ) {
      throw new Error('Invalid review dictionary metadata index.')
    }
    const metadata = dictionaryMetadata[dictionaryIndex]
    const dictionary: DictionaryCardMetadata = {
      ...metadata,
      reference: metadata.reference ? { ...metadata.reference } : null,
      cefr: { ...metadata.cefr },
      ...(metadata.availableRevision
        ? { availableRevision: { ...metadata.availableRevision } }
        : {}),
    }
    return { ...word, dictionary }
  })
  return { ...workspace, words }
}

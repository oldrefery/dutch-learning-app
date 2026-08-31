import type { Database } from '@woordenaar/supabase-contracts'
import { isDueOnLocalDate, isMasteredWord } from '@woordenaar/domain'

type CollectionRow = Database['public']['Tables']['collections']['Row']
type WordRow = Database['public']['Tables']['words']['Row']

export type CollectionSummaryRow = Pick<
  CollectionRow,
  'collection_id' | 'created_at' | 'is_shared' | 'name' | 'updated_at'
>

export type WordSummaryRow = Pick<
  WordRow,
  'collection_id' | 'next_review_date' | 'repetition_count'
>

export interface CollectionOverview {
  id: string
  name: string
  isShared: boolean
  createdAt: string
  updatedAt: string | null
  totalWords: number
  masteredWords: number
  dueWords: number
  newWords: number
  progressPercentage: number
}

export const buildCollectionOverviews = (
  collections: CollectionSummaryRow[],
  words: WordSummaryRow[],
  now: Date = new Date()
): CollectionOverview[] => {
  const wordsByCollection = new Map<string, WordSummaryRow[]>()

  words.forEach(word => {
    if (!word.collection_id) return

    const collectionWords = wordsByCollection.get(word.collection_id) ?? []
    collectionWords.push(word)
    wordsByCollection.set(word.collection_id, collectionWords)
  })

  return collections.map(collection => {
    const collectionWords =
      wordsByCollection.get(collection.collection_id) ?? []
    const totalWords = collectionWords.length
    const masteredWords = collectionWords.filter(isMasteredWord).length
    const newWords = collectionWords.filter(
      word => word.repetition_count === 0
    ).length
    const dueWords = collectionWords.filter(word =>
      isDueOnLocalDate(word.next_review_date, now)
    ).length

    return {
      id: collection.collection_id,
      name: collection.name,
      isShared: collection.is_shared ?? false,
      createdAt: collection.created_at,
      updatedAt: collection.updated_at,
      totalWords,
      masteredWords,
      dueWords,
      newWords,
      progressPercentage:
        totalWords === 0 ? 0 : Math.round((masteredWords / totalWords) * 100),
    }
  })
}

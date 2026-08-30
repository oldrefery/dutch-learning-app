import type { Database, Json } from '@woordenaar/supabase-contracts'
import { buildCollectionOverviews } from './collection-overview'

type CollectionRow = Database['public']['Tables']['collections']['Row']
type WordRow = Database['public']['Tables']['words']['Row']

export type CollectionDetailRow = Pick<
  CollectionRow,
  'collection_id' | 'created_at' | 'is_shared' | 'name' | 'updated_at'
>

export type CollectionWordRow = Pick<
  WordRow,
  | 'article'
  | 'collection_id'
  | 'created_at'
  | 'dutch_lemma'
  | 'dutch_original'
  | 'image_url'
  | 'interval_days'
  | 'next_review_date'
  | 'part_of_speech'
  | 'repetition_count'
  | 'translations'
  | 'word_id'
>

export interface CollectionWordListItem {
  article: string | null
  createdAt: string
  dutchLemma: string
  dutchOriginal: string | null
  id: string
  imageUrl: string | null
  intervalDays: number
  isDue: boolean
  isMastered: boolean
  partOfSpeech: string | null
  repetitionCount: number
  translation: string
}

export interface CollectionDetail {
  dueWords: number
  id: string
  isShared: boolean
  masteredWords: number
  name: string
  newWords: number
  progressPercentage: number
  totalWords: number
  words: CollectionWordListItem[]
}

const isJsonRecord = (
  value: Json
): value is { [key: string]: Json | undefined } =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const getFirstEnglishTranslation = (translations: Json) => {
  if (!isJsonRecord(translations)) return 'No translation'

  const english = translations.en
  if (!Array.isArray(english)) return 'No translation'

  const firstTranslation = english.find(
    value => typeof value === 'string' && value.trim().length > 0
  )

  return typeof firstTranslation === 'string'
    ? firstTranslation
    : 'No translation'
}

const isDue = (nextReviewDate: string, now: Date) => {
  const timestamp = Date.parse(nextReviewDate)
  return Number.isFinite(timestamp) && timestamp <= now.getTime()
}

export const buildCollectionDetail = (
  collection: CollectionDetailRow,
  words: CollectionWordRow[],
  now: Date = new Date()
): CollectionDetail => {
  const [overview] = buildCollectionOverviews([collection], words, now)

  return {
    id: overview.id,
    name: overview.name,
    isShared: overview.isShared,
    totalWords: overview.totalWords,
    masteredWords: overview.masteredWords,
    dueWords: overview.dueWords,
    newWords: overview.newWords,
    progressPercentage: overview.progressPercentage,
    words: words.map(word => ({
      id: word.word_id,
      article: word.article,
      createdAt: word.created_at,
      dutchLemma: word.dutch_lemma,
      dutchOriginal: word.dutch_original,
      imageUrl: word.image_url,
      intervalDays: word.interval_days,
      isDue: isDue(word.next_review_date, now),
      isMastered: word.repetition_count > 2,
      partOfSpeech: word.part_of_speech,
      repetitionCount: word.repetition_count,
      translation: getFirstEnglishTranslation(word.translations),
    })),
  }
}

export const filterCollectionWords = (
  words: CollectionWordListItem[],
  searchQuery: string
) => {
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase('nl-NL')
  if (!normalizedQuery) return words

  return words.filter(word =>
    word.dutchLemma.toLocaleLowerCase('nl-NL').includes(normalizedQuery)
  )
}

export const isCollectionId = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )

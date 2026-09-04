import type { Database, Json } from '@woordenaar/supabase-contracts'
import { DIFFICULT_EASINESS_FACTOR_THRESHOLD } from '@woordenaar/domain'
import { buildCollectionOverviews } from './collection-overview'

type CollectionRow = Database['public']['Tables']['collections']['Row']
type WordRow = Database['public']['Tables']['words']['Row']

export type CollectionDetailRow = Pick<
  CollectionRow,
  | 'collection_id'
  | 'created_at'
  | 'is_shared'
  | 'name'
  | 'share_token'
  | 'shared_at'
  | 'updated_at'
>

export type CollectionWordRow = Pick<
  WordRow,
  | 'article'
  | 'collection_id'
  | 'created_at'
  | 'dutch_lemma'
  | 'dutch_original'
  | 'easiness_factor'
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
  isDifficult: boolean
  isDue: boolean
  isMastered: boolean
  partOfSpeech: string | null
  nextReviewDate: string
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
  sharedAt: string | null
  shareToken: string | null
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
    shareToken: collection.share_token,
    sharedAt: collection.shared_at,
    words: words.map(word => ({
      id: word.word_id,
      article: word.article,
      createdAt: word.created_at,
      dutchLemma: word.dutch_lemma,
      dutchOriginal: word.dutch_original,
      imageUrl: word.image_url,
      intervalDays: word.interval_days,
      isDifficult: word.easiness_factor <= DIFFICULT_EASINESS_FACTOR_THRESHOLD,
      isDue: isDue(word.next_review_date, now),
      isMastered: word.repetition_count > 2,
      partOfSpeech: word.part_of_speech,
      nextReviewDate: word.next_review_date,
      repetitionCount: word.repetition_count,
      translation: getFirstEnglishTranslation(word.translations),
    })),
  }
}

export const filterCollectionWords = (
  words: CollectionWordListItem[],
  searchQuery: string,
  status: 'all' | 'due' | 'difficult' | 'mastered' = 'all',
  partOfSpeech = 'all'
) => {
  const normalizedQuery = searchQuery.trim().toLocaleLowerCase('nl-NL')

  return words.filter(word => {
    const matchesSearch =
      !normalizedQuery ||
      word.dutchLemma.toLocaleLowerCase('nl-NL').includes(normalizedQuery) ||
      word.translation.toLocaleLowerCase().includes(normalizedQuery)
    const matchesStatus =
      status === 'all' ||
      (status === 'due' && word.isDue) ||
      (status === 'difficult' && word.isDifficult) ||
      (status === 'mastered' && word.isMastered)
    const matchesPartOfSpeech =
      partOfSpeech === 'all' || word.partOfSpeech === partOfSpeech

    return matchesSearch && matchesStatus && matchesPartOfSpeech
  })
}

export const isCollectionId = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )

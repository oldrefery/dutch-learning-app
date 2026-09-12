import 'server-only'

import type { Database } from '@woordenaar/supabase-contracts'
import {
  createCorrectionClient,
  readCorrectionCapability,
  reviewEventsSource,
} from './correction-client'
import type { ReviewSnapshotDatabase } from './review-snapshot-contract'
import { fetchAllRows } from '@/lib/supabase/fetch-all-rows'
import { isReviewAssessment, isReviewMode } from './review-domain'
import type {
  ReviewCollection,
  ReviewEventEvidence,
  ReviewWord,
  ReviewWorkspaceData,
} from './types'
import type { SupabaseClient } from '@supabase/supabase-js'

type CollectionRow = Pick<
  Database['public']['Tables']['collections']['Row'],
  'collection_id' | 'name'
>
type WordRow = Pick<
  Database['public']['Tables']['words']['Row'],
  | 'article'
  | 'collection_id'
  | 'dutch_lemma'
  | 'dutch_original'
  | 'easiness_factor'
  | 'image_url'
  | 'interval_days'
  | 'last_reviewed_at'
  | 'next_review_date'
  | 'part_of_speech'
  | 'repetition_count'
  | 'translations'
  | 'tts_url'
  | 'word_id'
>
type ReviewEventRow = Pick<
  Database['public']['Tables']['review_events']['Row'],
  | 'answered_correctly'
  | 'assessment'
  | 'event_id'
  | 'review_mode'
  | 'reviewed_at'
  | 'word_id'
>

const mapCollection = (row: CollectionRow): ReviewCollection => ({
  id: row.collection_id,
  name: row.name,
})

const mapWord = (row: WordRow): ReviewWord => ({
  article: row.article,
  collectionId: row.collection_id,
  dutchLemma: row.dutch_lemma,
  dutchOriginal: row.dutch_original,
  easinessFactor: row.easiness_factor,
  id: row.word_id,
  imageUrl: row.image_url,
  intervalDays: row.interval_days,
  lastReviewedAt: row.last_reviewed_at,
  nextReviewDate: row.next_review_date,
  partOfSpeech: row.part_of_speech,
  repetitionCount: row.repetition_count,
  translations: row.translations,
  ttsUrl: row.tts_url || null,
})

const mapEvent = (row: ReviewEventRow): ReviewEventEvidence | null => {
  if (!isReviewAssessment(row.assessment) || !isReviewMode(row.review_mode)) {
    return null
  }

  return {
    answeredCorrectly: row.answered_correctly,
    assessment: row.assessment,
    eventId: row.event_id,
    reviewMode: row.review_mode,
    reviewedAt: row.reviewed_at,
    wordId: row.word_id,
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === 'string'

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const mapSnapshotCollection = (value: unknown): ReviewCollection | null => {
  if (
    !isRecord(value) ||
    typeof value.collection_id !== 'string' ||
    typeof value.name !== 'string'
  ) {
    return null
  }

  return { id: value.collection_id, name: value.name }
}

const mapSnapshotWord = (value: unknown): ReviewWord | null => {
  if (
    !isRecord(value) ||
    !isNullableString(value.article) ||
    !isNullableString(value.collection_id) ||
    typeof value.dutch_lemma !== 'string' ||
    !isNullableString(value.dutch_original) ||
    !isFiniteNumber(value.easiness_factor) ||
    !isNullableString(value.image_url) ||
    !isFiniteNumber(value.interval_days) ||
    !isNullableString(value.last_reviewed_at) ||
    typeof value.next_review_date !== 'string' ||
    !isNullableString(value.part_of_speech) ||
    !isFiniteNumber(value.repetition_count) ||
    !isNullableString(value.tts_url) ||
    typeof value.word_id !== 'string' ||
    !('translations' in value)
  ) {
    return null
  }

  return {
    article: value.article,
    collectionId: value.collection_id,
    dutchLemma: value.dutch_lemma,
    dutchOriginal: value.dutch_original,
    easinessFactor: value.easiness_factor,
    id: value.word_id,
    imageUrl: value.image_url,
    intervalDays: value.interval_days,
    lastReviewedAt: value.last_reviewed_at,
    nextReviewDate: value.next_review_date,
    partOfSpeech: value.part_of_speech,
    repetitionCount: value.repetition_count,
    translations: value.translations as ReviewWord['translations'],
    ttsUrl: value.tts_url || null,
  }
}

const mapSnapshotEvent = (value: unknown): ReviewEventEvidence | null => {
  if (
    !isRecord(value) ||
    (value.answered_correctly !== null &&
      typeof value.answered_correctly !== 'boolean') ||
    typeof value.assessment !== 'string' ||
    !isReviewAssessment(value.assessment) ||
    typeof value.event_id !== 'string' ||
    typeof value.review_mode !== 'string' ||
    !isReviewMode(value.review_mode) ||
    typeof value.reviewed_at !== 'string' ||
    typeof value.word_id !== 'string'
  ) {
    return null
  }

  return {
    answeredCorrectly: value.answered_correctly,
    assessment: value.assessment,
    eventId: value.event_id,
    reviewMode: value.review_mode,
    reviewedAt: value.reviewed_at,
    wordId: value.word_id,
  }
}

export const mapReviewSnapshot = (value: unknown): ReviewWorkspaceData => {
  if (
    !isRecord(value) ||
    value.protocolVersion !== 1 ||
    typeof value.correctionsAvailable !== 'boolean' ||
    !Array.isArray(value.collections) ||
    !Array.isArray(value.words) ||
    !Array.isArray(value.events)
  ) {
    throw new Error('Could not load the review workspace.')
  }

  const collections = value.collections.map(mapSnapshotCollection)
  const words = value.words.map(mapSnapshotWord)
  const events = value.events.map(mapSnapshotEvent)
  if (
    collections.some(collection => collection === null) ||
    words.some(word => word === null) ||
    events.some(event => event === null)
  ) {
    throw new Error('Could not load the review workspace.')
  }

  return {
    correctionsAvailable: value.correctionsAvailable,
    collections: collections as ReviewCollection[],
    words: words as ReviewWord[],
    events: events as ReviewEventEvidence[],
  }
}

const isMissingReviewSnapshotRpc = (error: { code?: string } | null) =>
  error?.code === 'PGRST202' || error?.code === '42883'

const getLegacyReviewWorkspaceData = async (
  userId: string,
  supabase: Awaited<ReturnType<typeof createCorrectionClient>>
): Promise<ReviewWorkspaceData> => {
  const collectionsRequest = Promise.resolve(
    supabase
      .from('collections')
      .select('collection_id, name')
      .eq('user_id', userId)
      .order('name')
  )
  const wordsRequest = fetchAllRows<WordRow>((from, to) =>
    supabase
      .from('words')
      .select(
        'article, collection_id, dutch_lemma, dutch_original, easiness_factor, image_url, interval_days, last_reviewed_at, next_review_date, part_of_speech, repetition_count, translations, tts_url, word_id'
      )
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('next_review_date')
      .order('word_id')
      .range(from, to)
  )
  const correctionsAvailable = await readCorrectionCapability(supabase)
  const eventsRequest = fetchAllRows<ReviewEventRow>(
    (from, to) =>
      reviewEventsSource(supabase, correctionsAvailable)
        .select(
          'answered_correctly, assessment, event_id, review_mode, reviewed_at, word_id'
        )
        .eq('user_id', userId)
        .order('reviewed_at', { ascending: false })
        .order('event_id', { ascending: false })
        .range(from, to),
    { maxRows: 5000 }
  )
  const [collectionsResult, wordsResult, eventsResult] = await Promise.all([
    collectionsRequest,
    wordsRequest,
    eventsRequest,
  ])

  if (collectionsResult.error || wordsResult.error || eventsResult.error) {
    throw new Error('Could not load the review workspace.')
  }

  return {
    correctionsAvailable,
    collections: (collectionsResult.data ?? []).map(mapCollection),
    words: (wordsResult.data ?? []).map(mapWord),
    events: (eventsResult.data ?? [])
      .map(mapEvent)
      .filter((event): event is ReviewEventEvidence => event !== null),
  }
}

export async function getReviewWorkspaceData(
  userId: string
): Promise<ReviewWorkspaceData> {
  const supabase = await createCorrectionClient()
  const snapshotClient =
    supabase as unknown as SupabaseClient<ReviewSnapshotDatabase>
  const { data, error } = await snapshotClient.rpc('get_web_review_snapshot_v1')

  if (!error) {
    return mapReviewSnapshot(data)
  }

  if (isMissingReviewSnapshotRpc(error)) {
    return getLegacyReviewWorkspaceData(userId, supabase)
  }

  throw new Error('Could not load the review workspace.')
}

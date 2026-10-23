import 'server-only'

import {
  applyEffectiveCards,
  parseEffectiveCards,
  type DictionaryCardMetadata,
  type EffectiveCard,
} from '@/features/dictionary/content'
import {
  isDictionaryContentEnabled,
  isDictionaryFollowingEnabled,
  type DictionaryDatabase,
} from '@/features/dictionary/repository'
import {
  parseFollowingCards,
  validateFollowingHeads,
} from '@/features/dictionary/following-content'

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

const mapSnapshotWord = (
  value: unknown,
  contentOverride?: EffectiveCard['content']
): ReviewWord | null => {
  if (!isRecord(value)) return null
  const content = contentOverride ?? value
  if (
    !isNullableString(content.article) ||
    !isNullableString(value.collection_id) ||
    typeof content.dutch_lemma !== 'string' ||
    !isNullableString(content.dutch_original) ||
    !isFiniteNumber(value.easiness_factor) ||
    !isNullableString(content.image_url) ||
    !isFiniteNumber(value.interval_days) ||
    !isNullableString(value.last_reviewed_at) ||
    typeof value.next_review_date !== 'string' ||
    !isNullableString(content.part_of_speech) ||
    !isFiniteNumber(value.repetition_count) ||
    !isNullableString(content.tts_url) ||
    typeof value.word_id !== 'string' ||
    !('translations' in content)
  ) {
    return null
  }

  return {
    article: content.article,
    collectionId: value.collection_id,
    dutchLemma: content.dutch_lemma,
    dutchOriginal: content.dutch_original,
    easinessFactor: value.easiness_factor,
    id: value.word_id,
    imageUrl: content.image_url,
    intervalDays: value.interval_days,
    lastReviewedAt: value.last_reviewed_at,
    nextReviewDate: value.next_review_date,
    partOfSpeech: content.part_of_speech,
    repetitionCount: value.repetition_count,
    translations: content.translations as ReviewWord['translations'],
    ttsUrl: content.tts_url || null,
  }
}

const mapFollowingSnapshotWord = (
  value: unknown,
  cards: ReadonlyMap<string, EffectiveCard>
): ReviewWord | null => {
  const card =
    isRecord(value) && typeof value.word_id === 'string'
      ? cards.get(value.word_id)
      : undefined
  if (!card) throw new Error('Could not load dictionary content. Please retry.')
  const { content, wordId, ...dictionary } = card
  void wordId
  const word = mapSnapshotWord(value, content)
  return word ? { ...word, dictionary } : null
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
    (value.protocolVersion !== 1 &&
      value.protocolVersion !== 2 &&
      value.protocolVersion !== 3) ||
    typeof value.correctionsAvailable !== 'boolean' ||
    !Array.isArray(value.collections) ||
    !Array.isArray(value.words) ||
    !Array.isArray(value.events)
  ) {
    throw new Error('Could not load the review workspace.')
  }

  const collections = value.collections.map(mapSnapshotCollection)
  let snapshotWords: unknown[] = value.words
  const metadata = new Map<string, DictionaryCardMetadata>()
  let dictionaryWatermark: string | undefined
  let followingCards: ReadonlyMap<string, EffectiveCard> | undefined
  if (value.protocolVersion === 2) {
    if (
      value.dictionaryContentProtocol !== 1 ||
      value.words.some(
        word => !isRecord(word) || typeof word.word_id !== 'string'
      )
    ) {
      throw new Error('Could not load the review workspace.')
    }
    const cards = parseEffectiveCards({
      protocol_version: 1,
      cards: value.effectiveContent,
    })
    for (const [id, card] of cards) {
      const { content, wordId, ...dictionary } = card
      void [content, wordId]
      metadata.set(id, dictionary)
    }
    snapshotWords = applyEffectiveCards(
      value.words as { word_id: string }[],
      cards
    )
  }
  if (value.protocolVersion === 3) {
    if (
      value.dictionaryContentProtocol !== 2 ||
      new Set(value.words.map(word => (isRecord(word) ? word.word_id : null)))
        .size !== value.words.length ||
      value.words.some(
        word => !isRecord(word) || typeof word.word_id !== 'string'
      )
    ) {
      throw new Error('Could not load the review workspace.')
    }
    const hydrated = parseFollowingCards(value.dictionaryContent)
    validateFollowingHeads(hydrated.cards)
    dictionaryWatermark = hydrated.watermark
    if (hydrated.cards.size !== value.words.length)
      throw new Error('Could not load dictionary content. Please retry.')
    followingCards = hydrated.cards
  }
  const words = snapshotWords.map(value => {
    if (followingCards) return mapFollowingSnapshotWord(value, followingCards)
    const word = mapSnapshotWord(value)
    const dictionary = word ? metadata.get(word.id) : undefined
    return word && dictionary ? { ...word, dictionary } : word
  })
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
    ...(value.protocolVersion === 2 || value.protocolVersion === 3
      ? { dictionaryContentEnabled: true }
      : {}),
    ...(dictionaryWatermark !== undefined ? { dictionaryWatermark } : {}),
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
  if (isDictionaryContentEnabled()) {
    const dictionaryClient =
      supabase as unknown as SupabaseClient<DictionaryDatabase>
    const following = isDictionaryFollowingEnabled()
    const { data, error } = await dictionaryClient.rpc(
      following ? 'get_web_review_snapshot_v3' : 'get_web_review_snapshot_v2'
    )
    if (
      error ||
      !isRecord(data) ||
      data.protocolVersion !== (following ? 3 : 2)
    ) {
      throw new Error('Could not load the review workspace.')
    }
    return mapReviewSnapshot(data)
  }
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

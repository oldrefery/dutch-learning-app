import 'server-only'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all-rows'
import { buildCollectionDetail, isCollectionId } from './collection-detail'
import type { CollectionDetail } from './collection-detail'
import { buildCollectionOverviews } from './collection-overview'
import type { CollectionOverview, WordSummaryRow } from './collection-overview'

const queryCollectionOverviews = async (
  userId: string
): Promise<CollectionOverview[]> => {
  const supabase = await createClient()
  const collectionsRequest = supabase
    .from('collections')
    .select('collection_id, created_at, is_shared, name, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  const wordsRequest = fetchAllRows<WordSummaryRow>((from, to) =>
    supabase
      .from('words')
      .select(
        'collection_id, dutch_lemma, easiness_factor, interval_days, next_review_date, repetition_count, word_id'
      )
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('word_id', { ascending: true })
      .range(from, to)
  )

  const [collectionsResult, wordsResult] = await Promise.all([
    collectionsRequest,
    wordsRequest,
  ])

  if (collectionsResult.error || wordsResult.error) {
    throw new Error('Could not load collections.')
  }

  return buildCollectionOverviews(
    collectionsResult.data ?? [],
    wordsResult.data ?? []
  )
}

export const listCollectionOverviews = cache(queryCollectionOverviews)

const toLocalDateKey = (date: Date): string =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')

export const calculateReviewStreak = (
  reviewDates: readonly string[],
  now: Date = new Date()
): number => {
  const reviewedDays = new Set(
    reviewDates
      .map(value => new Date(value))
      .filter(value => !Number.isNaN(value.getTime()))
      .map(toLocalDateKey)
  )
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)

  if (!reviewedDays.has(toLocalDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
  }

  let streak = 0
  while (reviewedDays.has(toLocalDateKey(cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}

export async function getReviewStreak(userId: string): Promise<number> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('review_events')
    .select('reviewed_at')
    .eq('user_id', userId)
    .order('reviewed_at', { ascending: false })
    .limit(1000)

  if (error) {
    throw new Error('Could not load the review streak.')
  }

  return calculateReviewStreak((data ?? []).map(event => event.reviewed_at))
}

export async function getOwnedCollectionDetail(
  userId: string,
  collectionId: string
): Promise<CollectionDetail | null> {
  if (!isCollectionId(collectionId)) return null

  const supabase = await createClient()
  const { data: collection, error: collectionError } = await supabase
    .from('collections')
    .select(
      'collection_id, created_at, is_shared, name, share_token, shared_at, updated_at'
    )
    .eq('collection_id', collectionId)
    .eq('user_id', userId)
    .maybeSingle()

  if (collectionError) {
    throw new Error('Could not load the collection.')
  }

  if (!collection) return null

  const { data: words, error: wordsError } = await fetchAllRows((from, to) =>
    supabase
      .from('words')
      .select(
        'article, collection_id, created_at, dutch_lemma, dutch_original, easiness_factor, image_url, interval_days, next_review_date, part_of_speech, repetition_count, translations, word_id'
      )
      .eq('collection_id', collectionId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('dutch_lemma', { ascending: true })
      .order('word_id', { ascending: true })
      .range(from, to)
  )

  if (wordsError) {
    throw new Error('Could not load collection words.')
  }

  return buildCollectionDetail(collection, words ?? [])
}

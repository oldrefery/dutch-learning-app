import 'server-only'

import type { Database } from '@woordenaar/supabase-contracts'
import { createClient } from '@/lib/supabase/server'
import type { ReviewHistoryEvent } from './types'

type ReviewEventRow = Pick<
  Database['public']['Tables']['review_events']['Row'],
  | 'answered_correctly'
  | 'assessment'
  | 'event_id'
  | 'next_easiness_factor'
  | 'next_interval_days'
  | 'previous_easiness_factor'
  | 'previous_interval_days'
  | 'response_time_ms'
  | 'review_mode'
  | 'reviewed_at'
  | 'word_id'
>

export async function listRecentReviewEvents(
  userId: string
): Promise<ReviewHistoryEvent[]> {
  const supabase = await createClient()
  const [eventsResult, collectionsResult] = await Promise.all([
    supabase
      .from('review_events')
      .select(
        'answered_correctly, assessment, event_id, next_easiness_factor, next_interval_days, previous_easiness_factor, previous_interval_days, response_time_ms, review_mode, reviewed_at, word_id'
      )
      .eq('user_id', userId)
      .order('reviewed_at', { ascending: false })
      .order('event_id', { ascending: false })
      .limit(20),
    supabase
      .from('collections')
      .select('collection_id, name')
      .eq('user_id', userId),
  ])

  if (eventsResult.error || collectionsResult.error) {
    throw new Error('Could not load learning history.')
  }

  const events = (eventsResult.data ?? []) as ReviewEventRow[]
  const wordIds = [...new Set(events.map(event => event.word_id))]
  const wordsResult =
    wordIds.length === 0
      ? { data: [], error: null }
      : await supabase
          .from('words')
          .select('collection_id, dutch_lemma, word_id')
          .eq('user_id', userId)
          .in('word_id', wordIds)

  if (wordsResult.error) {
    throw new Error('Could not load learning history.')
  }

  const words = new Map(
    (wordsResult.data ?? []).map(word => [word.word_id, word] as const)
  )
  const collections = new Map(
    (collectionsResult.data ?? []).map(collection => [
      collection.collection_id,
      collection.name,
    ])
  )

  return events.map(event => {
    const word = words.get(event.word_id)
    const collectionId = word?.collection_id ?? null
    return {
      answeredCorrectly: event.answered_correctly,
      assessment: event.assessment,
      collectionId,
      collectionName: collectionId
        ? (collections.get(collectionId) ?? null)
        : null,
      dutchLemma: word?.dutch_lemma ?? null,
      eventId: event.event_id,
      nextEasinessFactor: event.next_easiness_factor,
      nextIntervalDays: event.next_interval_days,
      previousEasinessFactor: event.previous_easiness_factor,
      previousIntervalDays: event.previous_interval_days,
      responseTimeMs: event.response_time_ms,
      reviewMode: event.review_mode,
      reviewedAt: event.reviewed_at,
      wordId: event.word_id,
    }
  })
}

import 'server-only'

import type { Database } from '@woordenaar/supabase-contracts'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all-rows'
import { isReviewAssessment, isReviewMode } from './review-domain'
import type {
  ReviewCollection,
  ReviewEventEvidence,
  ReviewWord,
  ReviewWorkspaceData,
} from './types'

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

export async function getReviewWorkspaceData(
  userId: string
): Promise<ReviewWorkspaceData> {
  const supabase = await createClient()
  const [collectionsResult, wordsResult, eventsResult] = await Promise.all([
    supabase
      .from('collections')
      .select('collection_id, name')
      .eq('user_id', userId)
      .order('name'),
    fetchAllRows<WordRow>((from, to) =>
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
    ),
    fetchAllRows<ReviewEventRow>(
      (from, to) =>
        supabase
          .from('review_events')
          .select(
            'answered_correctly, assessment, event_id, review_mode, reviewed_at, word_id'
          )
          .eq('user_id', userId)
          .order('reviewed_at', { ascending: false })
          .order('event_id', { ascending: false })
          .range(from, to),
      { maxRows: 5000 }
    ),
  ])

  if (collectionsResult.error || wordsResult.error || eventsResult.error) {
    throw new Error('Could not load the review workspace.')
  }

  return {
    collections: (collectionsResult.data ?? []).map(mapCollection),
    words: (wordsResult.data ?? []).map(mapWord),
    events: (eventsResult.data ?? [])
      .map(mapEvent)
      .filter((event): event is ReviewEventEvidence => event !== null),
  }
}

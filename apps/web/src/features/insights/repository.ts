import 'server-only'

import type { Database } from '@woordenaar/supabase-contracts'
import { createClient } from '@/lib/supabase/server'
import { listOwnedDisplayWords } from '@/features/dictionary/owned-display-repository'
import type { InsightCollection, InsightsData, InsightWord } from './types'

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
  | 'interval_days'
  | 'next_review_date'
  | 'part_of_speech'
  | 'repetition_count'
  | 'translations'
  | 'word_id'
>

const mapCollection = (row: CollectionRow): InsightCollection => ({
  id: row.collection_id,
  name: row.name,
})

const mapWord = (row: WordRow): InsightWord => ({
  article: row.article,
  collection_id: row.collection_id,
  dutch_lemma: row.dutch_lemma,
  dutch_original: row.dutch_original,
  easiness_factor: row.easiness_factor,
  interval_days: row.interval_days,
  next_review_date: row.next_review_date,
  part_of_speech: row.part_of_speech,
  repetition_count: row.repetition_count,
  translations: row.translations,
  word_id: row.word_id,
})

export async function getInsightsData(userId: string): Promise<InsightsData> {
  const supabase = await createClient()
  const [collectionsResult, words] = await Promise.all([
    supabase
      .from('collections')
      .select('collection_id, name')
      .eq('user_id', userId)
      .order('name'),
    listOwnedDisplayWords(supabase, userId, { view: 'insights' }),
  ])

  if (collectionsResult.error) {
    throw new Error('Could not load learning insights.')
  }

  return {
    collections: (collectionsResult.data ?? []).map(mapCollection),
    words: words.map(mapWord),
  }
}

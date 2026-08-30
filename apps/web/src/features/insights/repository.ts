import 'server-only'

import type { Database } from '@woordenaar/supabase-contracts'
import { createClient } from '@/lib/supabase/server'
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

const mapWord = (row: WordRow): InsightWord => ({ ...row })

export async function getInsightsData(userId: string): Promise<InsightsData> {
  const supabase = await createClient()
  const [collectionsResult, wordsResult] = await Promise.all([
    supabase
      .from('collections')
      .select('collection_id, name')
      .eq('user_id', userId)
      .order('name'),
    supabase
      .from('words')
      .select(
        'article, collection_id, dutch_lemma, dutch_original, easiness_factor, interval_days, next_review_date, part_of_speech, repetition_count, translations, word_id'
      )
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('dutch_lemma'),
  ])

  if (collectionsResult.error || wordsResult.error) {
    throw new Error('Could not load learning insights.')
  }

  return {
    collections: (collectionsResult.data ?? []).map(mapCollection),
    words: (wordsResult.data ?? []).map(mapWord),
  }
}

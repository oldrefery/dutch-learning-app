import 'server-only'

import { createClient } from '@/lib/supabase/server'
import {
  buildWordDetail,
  isUuid,
  type WordDetail,
} from '@/features/words/word-detail'

export async function getOwnedReviewWordDetail(
  userId: string,
  wordId: string
): Promise<WordDetail | null> {
  if (!isUuid(wordId)) return null

  const client = await createClient()
  const { data, error } = await client
    .from('words')
    .select('*')
    .eq('user_id', userId)
    .eq('word_id', wordId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new Error('Review word details unavailable')
  return data ? buildWordDetail(data) : null
}

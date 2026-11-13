import 'server-only'

import { readOwnedDisplayWord } from '@/features/dictionary/owned-display-repository'

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
  const word = await readOwnedDisplayWord(client, userId, wordId)
  return word ? buildWordDetail(word) : null
}

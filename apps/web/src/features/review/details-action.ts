'use server'

import { requireAuthenticatedIdentity } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import {
  buildWordDetail,
  isUuid,
  type WordDetail,
} from '@/features/words/word-detail'

export async function loadReviewWordDetails(input: {
  userId: string
  wordId: string
}): Promise<
  { status: 'success'; word: WordDetail } | { status: 'error'; message: string }
> {
  const auth = await requireAuthenticatedIdentity()
  if (
    !input ||
    input.userId !== auth.userId ||
    typeof input.wordId !== 'string' ||
    !isUuid(input.wordId)
  ) {
    return {
      status: 'error',
      message: 'The word is not available for this session.',
    }
  }
  try {
    const client = await createClient()
    const { data, error } = await client
      .from('words')
      .select('*')
      .eq('user_id', auth.userId)
      .eq('word_id', input.wordId)
      .is('deleted_at', null)
      .maybeSingle()
    if (error || !data) throw new Error('Review word details unavailable')
    return { status: 'success', word: buildWordDetail(data) }
  } catch {
    return {
      status: 'error',
      message: 'Could not load the full card. Please try again.',
    }
  }
}

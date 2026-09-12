'use server'

import { requireAuthenticatedIdentity } from '@/lib/auth/session'
import { isUuid, type WordDetail } from '@/features/words/word-detail'
import { getOwnedReviewWordDetail } from './details-repository'

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
    typeof input.wordId !== 'string' ||
    !isUuid(input.wordId)
  ) {
    return {
      status: 'error',
      message: 'The word is not available for this session.',
    }
  }
  try {
    const word = await getOwnedReviewWordDetail(auth.userId, input.wordId)
    if (!word) throw new Error('Review word details unavailable')
    return { status: 'success', word }
  } catch {
    return {
      status: 'error',
      message: 'Could not load the full card. Please try again.',
    }
  }
}

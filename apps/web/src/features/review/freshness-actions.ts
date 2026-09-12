'use server'

import { revalidatePath } from 'next/cache'
import { requireAuthenticatedIdentity } from '@/lib/auth/session'

/** Refreshes authenticated workspace data after a settled review-session boundary. */
export async function flushReviewFreshness(userId: string): Promise<boolean> {
  const identity = await requireAuthenticatedIdentity()
  if (identity.userId !== userId) return false

  revalidatePath('/app', 'layout')
  return true
}

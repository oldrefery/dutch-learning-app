'use server'

import { normalizeDutchInput } from '@/features/analysis/analysis-contract'
import { getOwnedLemmaDuplicate } from '@/features/analysis/duplicate-repository'
import type { DuplicateWordResult } from '@/features/analysis/form-state'
import { requireAuthContext } from '@/lib/auth/session'

export async function findOwnedLemmaDuplicateForBatch(
  dutchText: string
): Promise<DuplicateWordResult | null> {
  const auth = await requireAuthContext()
  if (auth.accessLevel !== 'full_access') {
    throw new Error('Full access is required for batch capture.')
  }

  const validation = normalizeDutchInput(dutchText)
  if (validation.error) throw new Error(validation.error)
  return getOwnedLemmaDuplicate(auth.userId, validation.value)
}

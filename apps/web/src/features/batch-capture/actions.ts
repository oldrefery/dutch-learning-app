'use server'

import { revalidatePath } from 'next/cache'
import {
  normalizeDutchInput,
  parseSerializedWordAnalysis,
} from '@/features/analysis/analysis-contract'
import { getOwnedLemmaDuplicate } from '@/features/analysis/duplicate-repository'
import { persistAnalyzedWord } from '@/features/analysis/persistence-repository'
import type { DuplicateWordResult } from '@/features/analysis/form-state'
import { isUuid } from '@/features/words/word-detail'
import { requireAuthContext } from '@/lib/auth/session'
import type { BatchSaveResult } from './types'

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

export async function saveBatchAnalyzedWord(
  collectionId: string,
  serializedAnalysis: string
): Promise<BatchSaveResult> {
  const auth = await requireAuthContext()
  if (auth.accessLevel !== 'full_access') {
    return {
      success: false,
      message: 'Full access is required to save analyzed words.',
    }
  }
  if (!isUuid(collectionId)) {
    return { success: false, message: 'Choose a valid collection.' }
  }

  let analysis
  try {
    analysis = parseSerializedWordAnalysis(serializedAnalysis)
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : 'Analysis data is invalid.',
    }
  }

  const result = await persistAnalyzedWord(auth.userId, collectionId, analysis)
  if (!result.success) {
    return { success: false, message: result.message }
  }

  revalidatePath('/app/collections')
  revalidatePath(`/app/collections/${collectionId}`)
  return { success: true, wordId: result.wordId }
}

'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isUuid } from '@/features/words/word-detail'
import { requireAuthContext } from '@/lib/auth/session'
import { parseSerializedWordAnalysis } from './analysis-contract'
import type { WordAnalysis } from './analysis-contract'
import { getOwnedSemanticDuplicate } from './duplicate-repository'
import type { AddWordActionState, DuplicateWordResult } from './form-state'
import { persistAnalyzedWord } from './persistence-repository'

export async function findOwnedSemanticDuplicate(
  serializedAnalysis: string
): Promise<DuplicateWordResult | null> {
  const auth = await requireAuthContext()
  const analysis = parseSerializedWordAnalysis(serializedAnalysis)
  return getOwnedSemanticDuplicate(auth.userId, analysis)
}

export async function saveAnalyzedWord(
  previousState: AddWordActionState,
  formData: FormData
): Promise<AddWordActionState> {
  void previousState

  const auth = await requireAuthContext()
  if (auth.accessLevel !== 'full_access') {
    return {
      status: 'error',
      message: 'Full access is required to save analyzed words.',
    }
  }

  const collectionId = formData.get('collectionId')
  if (typeof collectionId !== 'string' || !isUuid(collectionId)) {
    return {
      status: 'error',
      message: null,
      fieldErrors: { collectionId: 'Choose a valid collection.' },
    }
  }

  let analysis: WordAnalysis
  try {
    analysis = parseSerializedWordAnalysis(formData.get('analysis'))
  } catch (error) {
    return {
      status: 'error',
      message: null,
      fieldErrors: {
        analysis:
          error instanceof Error ? error.message : 'Analysis data is invalid.',
      },
    }
  }

  const result = await persistAnalyzedWord(auth.userId, collectionId, analysis)
  if (!result.success && result.code === 'collection') {
    return {
      status: 'error',
      message: null,
      fieldErrors: { collectionId: result.message },
    }
  }
  if (!result.success) {
    return {
      status: 'error',
      message: result.message,
    }
  }

  revalidatePath('/app/collections')
  revalidatePath(`/app/collections/${collectionId}`)
  redirect(`/app/collections/${collectionId}/words/${result.wordId}`)
}

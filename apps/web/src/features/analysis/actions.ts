'use server'

import { exactPhraseInput } from '@woordenaar/domain'
import { isDictionaryFollowingEnabled } from '@/features/dictionary/repository'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { isUuid } from '@/features/words/word-detail'
import { requireAuthContext } from '@/lib/auth/session'
import { parseSerializedWordAnalysis } from './analysis-contract'
import type { WordAnalysis } from './analysis-contract'
import {
  getOwnedLemmaDuplicate,
  getOwnedSemanticDuplicate,
} from './duplicate-repository'
import type { AddWordActionState, DuplicateWordResult } from './form-state'
import { persistAnalyzedWord } from './persistence-repository'

export async function requireLegacyWordAnalysis(): Promise<void> {
  if (isDictionaryFollowingEnabled())
    throw new Error('Use published shared meanings to add a word.')
  await requireWordAnalysisAccess()
}

export async function requireWordAnalysisAccess(
  ownerId?: string
): Promise<void> {
  const auth = await requireAuthContext()
  if (ownerId && auth.userId !== ownerId)
    throw new Error('Your account changed. Analyze the word again.')
  if (auth.accessLevel !== 'full_access')
    throw new Error('Full access is required to analyze words.')
}

export async function findOwnedPhrase(ownerId: string, input: string) {
  const { userId } = await requireAuthContext()
  if (userId !== ownerId) throw new Error('Your account changed. Search again.')
  const phrase = exactPhraseInput(input)
  if (!phrase || phrase.length > 120) return null
  return getOwnedLemmaDuplicate(userId, phrase)
}

export async function findOwnedSemanticDuplicate(
  serializedAnalysis: string
): Promise<DuplicateWordResult | null> {
  const auth = await requireAuthContext()
  const analysis = parseSerializedWordAnalysis(serializedAnalysis)
  return getOwnedSemanticDuplicate(auth.userId, analysis)
}

export type SaveWordResult =
  | { success: true; wordId: string }
  | {
      success: false
      message: string
      duplicate?: boolean
      field?: 'analysis' | 'collectionId'
    }

export async function saveWordToCollection(
  ownerId: string,
  collectionId: string,
  serializedAnalysis: string
): Promise<SaveWordResult> {
  const auth = await requireAuthContext()
  if (auth.accessLevel !== 'full_access')
    return {
      success: false,
      message: 'Full access is required to save analyzed words.',
    }
  if (auth.userId !== ownerId)
    return {
      success: false,
      message: 'Your account changed. Analyze the word again.',
    }
  if (!isUuid(collectionId))
    return {
      success: false,
      field: 'collectionId',
      message: 'Choose a valid collection.',
    }

  let analysis: WordAnalysis
  try {
    analysis = parseSerializedWordAnalysis(serializedAnalysis)
  } catch (error) {
    return {
      success: false,
      field: 'analysis',
      message:
        error instanceof Error ? error.message : 'Analysis data is invalid.',
    }
  }

  const result = await persistAnalyzedWord(auth.userId, collectionId, analysis)
  if (!result.success)
    return {
      success: false,
      message: result.message,
      duplicate: result.code === 'duplicate',
      field: result.code === 'collection' ? 'collectionId' : undefined,
    }
  revalidatePath('/app/collections')
  revalidatePath(`/app/collections/${collectionId}`)
  return result
}

export async function saveAnalyzedWord(
  _previousState: AddWordActionState,
  formData: FormData
): Promise<AddWordActionState> {
  const collectionId = String(formData.get('collectionId') ?? '')
  const result = await saveWordToCollection(
    String(formData.get('ownerId') ?? ''),
    collectionId,
    String(formData.get('analysis') ?? '')
  )
  if (!result.success)
    return result.field
      ? {
          status: 'error',
          message: null,
          fieldErrors: { [result.field]: result.message },
        }
      : { status: 'error', message: result.message }
  redirect(`/app/collections/${collectionId}/words/${result.wordId}`)
}

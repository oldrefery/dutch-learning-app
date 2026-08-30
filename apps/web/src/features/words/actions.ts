'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAuthContext } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import type { WordActionState } from './form-state'
import { isUuid } from './word-detail'
import {
  buildResetWordProgressUpdate,
  hasDeleteConfirmation,
} from './word-mutations'

const getCollectionPath = (collectionId: string) =>
  `/app/collections/${collectionId}`

const getWordPath = (collectionId: string, wordId: string) =>
  `${getCollectionPath(collectionId)}/words/${wordId}`

const hasValidIdentifiers = (collectionId: string, wordId: string) =>
  isUuid(collectionId) && isUuid(wordId)

export async function moveWord(
  collectionId: string,
  wordId: string,
  _state: WordActionState,
  formData: FormData
): Promise<WordActionState> {
  const auth = await requireAuthContext()
  const targetCollectionId = formData.get('targetCollectionId')

  if (
    !hasValidIdentifiers(collectionId, wordId) ||
    typeof targetCollectionId !== 'string' ||
    !isUuid(targetCollectionId)
  ) {
    return {
      status: 'error',
      message: null,
      fieldErrors: { targetCollectionId: 'Choose a valid collection.' },
    }
  }

  if (targetCollectionId === collectionId) {
    return {
      status: 'error',
      message: null,
      fieldErrors: {
        targetCollectionId: 'Choose a different collection.',
      },
    }
  }

  const supabase = await createClient()
  const { data: targetCollection, error: targetError } = await supabase
    .from('collections')
    .select('collection_id')
    .eq('collection_id', targetCollectionId)
    .eq('user_id', auth.userId)
    .maybeSingle()

  if (targetError || !targetCollection) {
    return {
      status: 'error',
      message: null,
      fieldErrors: { targetCollectionId: 'Choose a collection you own.' },
    }
  }

  const { data: movedWord, error: moveError } = await supabase
    .from('words')
    .update({ collection_id: targetCollectionId })
    .eq('word_id', wordId)
    .eq('collection_id', collectionId)
    .eq('user_id', auth.userId)
    .is('deleted_at', null)
    .select('word_id')
    .maybeSingle()

  if (moveError || !movedWord) {
    return {
      status: 'error',
      message: 'Could not move the word. Please try again.',
    }
  }

  revalidatePath('/app/collections')
  revalidatePath(getCollectionPath(collectionId))
  revalidatePath(getCollectionPath(targetCollectionId))
  redirect(getWordPath(targetCollectionId, wordId))
}

export async function resetWordProgress(
  collectionId: string,
  wordId: string,
  previousState: WordActionState,
  formData: FormData
): Promise<WordActionState> {
  void previousState
  void formData

  const auth = await requireAuthContext()

  if (!hasValidIdentifiers(collectionId, wordId)) {
    return { status: 'error', message: 'The word could not be found.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('words')
    .update(buildResetWordProgressUpdate())
    .eq('word_id', wordId)
    .eq('collection_id', collectionId)
    .eq('user_id', auth.userId)
    .is('deleted_at', null)
    .select('word_id')
    .maybeSingle()

  if (error || !data) {
    return {
      status: 'error',
      message: 'Could not reset word progress. Please try again.',
    }
  }

  revalidatePath('/app/collections')
  revalidatePath(getCollectionPath(collectionId))
  revalidatePath(getWordPath(collectionId, wordId))

  return {
    status: 'success',
    message: 'Word progress reset.',
  }
}

export async function deleteWord(
  collectionId: string,
  wordId: string,
  _state: WordActionState,
  formData: FormData
): Promise<WordActionState> {
  const auth = await requireAuthContext()

  if (!hasValidIdentifiers(collectionId, wordId)) {
    return { status: 'error', message: 'The word could not be found.' }
  }

  if (!hasDeleteConfirmation(formData.get('confirmation'))) {
    return {
      status: 'error',
      message: null,
      fieldErrors: {
        confirmation: 'Confirm that you want to delete this word.',
      },
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('words')
    .update({ deleted_at: new Date().toISOString() })
    .eq('word_id', wordId)
    .eq('collection_id', collectionId)
    .eq('user_id', auth.userId)
    .is('deleted_at', null)
    .select('word_id')
    .maybeSingle()

  if (error || !data) {
    return {
      status: 'error',
      message: 'Could not delete the word. Please try again.',
    }
  }

  revalidatePath('/app/collections')
  revalidatePath(getCollectionPath(collectionId))
  redirect(getCollectionPath(collectionId))
}

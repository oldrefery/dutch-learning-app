'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAuthContext } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import {
  validateCollectionName,
  validateDeletionConfirmation,
} from './collection-validation'
import type { CollectionFormState } from './form-state'

export async function createCollection(
  _state: CollectionFormState,
  formData: FormData
): Promise<CollectionFormState> {
  const auth = await requireAuthContext()

  if (auth.accessLevel !== 'full_access') {
    return {
      status: 'error',
      message: 'Your account does not have permission to create collections.',
    }
  }

  const nameValidation = validateCollectionName(formData.get('name'))
  if (nameValidation.error) {
    return {
      status: 'error',
      message: null,
      fieldErrors: { name: nameValidation.error },
    }
  }

  const name = nameValidation.value
  const supabase = await createClient()
  const { error } = await supabase.from('collections').insert({
    name,
    user_id: auth.userId,
  })

  if (error) {
    return {
      status: 'error',
      message: 'Could not create the collection. Please try again.',
    }
  }

  revalidatePath('/app/collections')

  return {
    status: 'success',
    message: `Collection “${name}” created.`,
  }
}

export async function renameCollection(
  collectionId: string,
  _state: CollectionFormState,
  formData: FormData
): Promise<CollectionFormState> {
  const auth = await requireAuthContext()

  if (auth.accessLevel !== 'full_access') {
    return {
      status: 'error',
      message: 'Your account does not have permission to rename collections.',
    }
  }

  const nameValidation = validateCollectionName(formData.get('name'))
  if (nameValidation.error) {
    return {
      status: 'error',
      message: null,
      fieldErrors: { name: nameValidation.error },
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('collections')
    .update({ name: nameValidation.value })
    .eq('collection_id', collectionId)
    .eq('user_id', auth.userId)
    .select('collection_id')
    .maybeSingle()

  if (error || !data) {
    return {
      status: 'error',
      message: 'Could not rename the collection. Please try again.',
    }
  }

  revalidatePath('/app/collections')
  revalidatePath(`/app/collections/${collectionId}`)

  return {
    status: 'success',
    message: `Collection renamed to “${nameValidation.value}”.`,
  }
}

export async function deleteCollection(
  collectionId: string,
  _state: CollectionFormState,
  formData: FormData
): Promise<CollectionFormState> {
  const auth = await requireAuthContext()

  if (auth.accessLevel !== 'full_access') {
    return {
      status: 'error',
      message: 'Your account does not have permission to delete collections.',
    }
  }

  const supabase = await createClient()
  const { data: collection, error: collectionError } = await supabase
    .from('collections')
    .select('collection_id, name')
    .eq('collection_id', collectionId)
    .eq('user_id', auth.userId)
    .maybeSingle()

  if (collectionError || !collection) {
    return {
      status: 'error',
      message: 'The collection could not be found.',
    }
  }

  const confirmationError = validateDeletionConfirmation(
    formData.get('confirmation'),
    collection.name
  )
  if (confirmationError) {
    return {
      status: 'error',
      message: null,
      fieldErrors: { confirmation: confirmationError },
    }
  }

  const deletedAt = new Date().toISOString()
  const { data: tombstonedWords, error: wordsError } = await supabase
    .from('words')
    .update({ deleted_at: deletedAt })
    .eq('collection_id', collectionId)
    .eq('user_id', auth.userId)
    .is('deleted_at', null)
    .select('word_id')

  if (wordsError) {
    return {
      status: 'error',
      message: 'Could not prepare the collection for deletion. Try again.',
    }
  }

  const { data: deletedCollection, error: deleteError } = await supabase
    .from('collections')
    .delete()
    .eq('collection_id', collectionId)
    .eq('user_id', auth.userId)
    .select('collection_id')
    .maybeSingle()

  if (deleteError || !deletedCollection) {
    const wordIds = tombstonedWords?.map(word => word.word_id) ?? []
    if (wordIds.length > 0) {
      await supabase
        .from('words')
        .update({ deleted_at: null })
        .eq('user_id', auth.userId)
        .in('word_id', wordIds)
        .eq('deleted_at', deletedAt)
    }

    return {
      status: 'error',
      message: 'Could not delete the collection. Please try again.',
    }
  }

  revalidatePath('/app/collections')
  redirect('/app/collections')
}

'use server'

import { revalidatePath } from 'next/cache'
import { requireAuthContext } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import type { CollectionFormState } from './form-state'

const MAX_COLLECTION_NAME_LENGTH = 50

const getCollectionName = (formData: FormData) => {
  const value = formData.get('name')
  return typeof value === 'string' ? value.trim() : ''
}

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

  const name = getCollectionName(formData)
  if (!name) {
    return {
      status: 'error',
      message: null,
      fieldErrors: { name: 'Enter a collection name.' },
    }
  }
  if (name.length > MAX_COLLECTION_NAME_LENGTH) {
    return {
      status: 'error',
      message: null,
      fieldErrors: {
        name: `Use ${MAX_COLLECTION_NAME_LENGTH} characters or fewer.`,
      },
    }
  }

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

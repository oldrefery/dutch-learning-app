'use server'

import { revalidatePath } from 'next/cache'
import { getEdgeFunctionErrorMessage } from '@/features/analysis/edge-errors'
import { createClient } from '@/lib/supabase/server'
import { parseDeleteAccountResponse } from './account-deletion'
import type { DeleteAccountFormState } from './form-state'

const getFormValue = (formData: FormData, name: string) => {
  const value = formData.get(name)
  return typeof value === 'string' ? value.trim() : ''
}

export async function deleteAccount(
  _state: DeleteAccountFormState,
  formData: FormData
): Promise<DeleteAccountFormState> {
  if (
    getFormValue(formData, 'confirmationPhrase') !== 'DELETE' ||
    formData.get('understand') !== 'yes'
  ) {
    return {
      status: 'error',
      message: 'Confirm the warning and enter DELETE exactly.',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) {
    return { status: 'error', message: 'Your session has expired.' }
  }

  const confirmationEmail = getFormValue(formData, 'confirmationEmail')
  if (
    !user.email ||
    confirmationEmail.toLowerCase() !== user.email.toLowerCase()
  ) {
    return {
      status: 'error',
      message: 'Enter the email address of the signed-in account.',
    }
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()
  if (sessionError || !session) {
    return { status: 'error', message: 'Your session has expired.' }
  }

  const { data, error } = await supabase.functions.invoke<unknown>(
    'delete-account',
    {
      headers: { Authorization: `Bearer ${session.access_token}` },
    }
  )
  if (error) {
    return {
      status: 'error',
      message: await getEdgeFunctionErrorMessage(
        error,
        'Could not delete the account. Please try again.'
      ),
    }
  }

  const response = parseDeleteAccountResponse(data)
  if (!response.success) {
    return { status: 'error', message: response.error }
  }

  await supabase.auth.signOut({ scope: 'local' })
  revalidatePath('/', 'layout')
  return { status: 'success', message: 'Account deleted.' }
}

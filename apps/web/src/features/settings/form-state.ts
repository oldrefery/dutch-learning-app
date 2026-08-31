export interface DeleteAccountFormState {
  message: string | null
  status: 'idle' | 'error' | 'success'
}

export const INITIAL_DELETE_ACCOUNT_STATE: DeleteAccountFormState = {
  message: null,
  status: 'idle',
}

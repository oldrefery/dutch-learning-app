export interface AuthFormState {
  status: 'idle' | 'error' | 'success'
  message: string | null
  fieldErrors?: {
    email?: string
    password?: string
    confirmPassword?: string
  }
}

export type AuthFormAction = (
  state: AuthFormState,
  formData: FormData
) => Promise<AuthFormState>

export const INITIAL_AUTH_FORM_STATE: AuthFormState = {
  status: 'idle',
  message: null,
}

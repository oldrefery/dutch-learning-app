import type { User, Session } from '@supabase/supabase-js'

export interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  error: string | null
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface SignupCredentials {
  email: string
  password: string
  confirmPassword?: string
}

export interface AuthActions {
  signIn: (credentials: LoginCredentials) => Promise<void>
  signUp: (credentials: SignupCredentials) => Promise<void>
  signOut: () => Promise<void>
  clearError: () => void
  checkAuthState: () => Promise<void>
}

export type AuthStore = AuthState & AuthActions

export interface AuthFormProps {
  onSubmit: (credentials: LoginCredentials | SignupCredentials) => Promise<void>
  loading?: boolean
  error?: string | null
  type: 'login' | 'signup'
}

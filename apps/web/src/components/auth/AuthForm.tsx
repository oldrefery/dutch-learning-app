'use client'

import { useActionState } from 'react'
import type { AuthFormAction } from '@/lib/auth/types'
import { INITIAL_AUTH_FORM_STATE } from '@/lib/auth/types'
import styles from './Auth.module.css'

type AuthFormMode = 'login' | 'signup' | 'forgot-password' | 'reset-password'

interface AuthFormProps {
  action: AuthFormAction
  mode: AuthFormMode
  nextPath?: string
}

const MODE_LABELS: Record<AuthFormMode, string> = {
  login: 'Sign in',
  signup: 'Create account',
  'forgot-password': 'Send reset link',
  'reset-password': 'Update password',
}

export function AuthForm({ action, mode, nextPath }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_AUTH_FORM_STATE
  )
  const showEmail = mode !== 'reset-password'
  const showPassword = mode !== 'forgot-password'
  const showConfirmation = mode === 'signup' || mode === 'reset-password'

  return (
    <form action={formAction} className={styles.form}>
      {nextPath && <input name="next" type="hidden" value={nextPath} />}
      {showEmail && (
        <label className={styles.field}>
          Email
          <input
            autoComplete="email"
            className={styles.input}
            name="email"
            required
            type="email"
          />
          {state.fieldErrors?.email && (
            <span className={styles.error}>{state.fieldErrors.email}</span>
          )}
        </label>
      )}

      {showPassword && (
        <label className={styles.field}>
          {mode === 'reset-password' ? 'New password' : 'Password'}
          <input
            autoComplete={
              mode === 'login' ? 'current-password' : 'new-password'
            }
            className={styles.input}
            minLength={6}
            name="password"
            required
            type="password"
          />
          {state.fieldErrors?.password && (
            <span className={styles.error}>{state.fieldErrors.password}</span>
          )}
        </label>
      )}

      {showConfirmation && (
        <label className={styles.field}>
          Confirm password
          <input
            autoComplete="new-password"
            className={styles.input}
            minLength={6}
            name="confirmPassword"
            required
            type="password"
          />
          {state.fieldErrors?.confirmPassword && (
            <span className={styles.error}>
              {state.fieldErrors.confirmPassword}
            </span>
          )}
        </label>
      )}

      {state.message && (
        <p
          className={
            state.status === 'error'
              ? 'text-sm text-red-600 dark:text-red-400'
              : 'text-sm text-emerald-700 dark:text-emerald-400'
          }
          role={state.status === 'error' ? 'alert' : 'status'}
        >
          {state.message}
        </p>
      )}

      <button
        className={`dw-button dw-button--primary ${styles.submit}`}
        disabled={pending}
        type="submit"
      >
        {pending ? 'Please wait…' : MODE_LABELS[mode]}
      </button>
    </form>
  )
}

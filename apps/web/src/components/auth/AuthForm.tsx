'use client'

import { useActionState } from 'react'
import type { AuthFormAction } from '@/lib/auth/types'
import { INITIAL_AUTH_FORM_STATE } from '@/lib/auth/types'

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
    <form action={formAction} className="mt-8 space-y-5">
      {nextPath && <input name="next" type="hidden" value={nextPath} />}
      {showEmail && (
        <label className="block text-sm font-medium">
          Email
          <input
            autoComplete="email"
            className="mt-2 w-full rounded-xl border border-neutral-300 bg-transparent px-4 py-3 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-white"
            name="email"
            required
            type="email"
          />
          {state.fieldErrors?.email && (
            <span className="mt-2 block text-sm text-red-600 dark:text-red-400">
              {state.fieldErrors.email}
            </span>
          )}
        </label>
      )}

      {showPassword && (
        <label className="block text-sm font-medium">
          {mode === 'reset-password' ? 'New password' : 'Password'}
          <input
            autoComplete={
              mode === 'login' ? 'current-password' : 'new-password'
            }
            className="mt-2 w-full rounded-xl border border-neutral-300 bg-transparent px-4 py-3 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-white"
            minLength={6}
            name="password"
            required
            type="password"
          />
          {state.fieldErrors?.password && (
            <span className="mt-2 block text-sm text-red-600 dark:text-red-400">
              {state.fieldErrors.password}
            </span>
          )}
        </label>
      )}

      {showConfirmation && (
        <label className="block text-sm font-medium">
          Confirm password
          <input
            autoComplete="new-password"
            className="mt-2 w-full rounded-xl border border-neutral-300 bg-transparent px-4 py-3 outline-none focus:border-neutral-900 dark:border-neutral-700 dark:focus:border-white"
            minLength={6}
            name="confirmPassword"
            required
            type="password"
          />
          {state.fieldErrors?.confirmPassword && (
            <span className="mt-2 block text-sm text-red-600 dark:text-red-400">
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
        className="w-full rounded-xl bg-neutral-900 px-4 py-3 font-medium text-white disabled:cursor-wait disabled:opacity-60 dark:bg-white dark:text-neutral-950"
        disabled={pending}
        type="submit"
      >
        {pending ? 'Please wait…' : MODE_LABELS[mode]}
      </button>
    </form>
  )
}

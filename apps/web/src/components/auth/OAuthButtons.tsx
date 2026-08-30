'use client'

import { useActionState } from 'react'
import { signInWithOAuth } from '@/app/(auth)/actions'
import { INITIAL_AUTH_FORM_STATE } from '@/lib/auth/types'

interface OAuthButtonsProps {
  nextPath: string
}

export function OAuthButtons({ nextPath }: OAuthButtonsProps) {
  const [state, action, pending] = useActionState(
    signInWithOAuth,
    INITIAL_AUTH_FORM_STATE
  )

  return (
    <form action={action} className="mt-6 grid gap-3 sm:grid-cols-2">
      <input name="next" type="hidden" value={nextPath} />
      <button
        className="rounded-xl border border-neutral-300 px-4 py-3 text-sm font-medium disabled:opacity-60 dark:border-neutral-700"
        disabled={pending}
        name="provider"
        type="submit"
        value="google"
      >
        Continue with Google
      </button>
      <button
        className="rounded-xl border border-neutral-300 px-4 py-3 text-sm font-medium disabled:opacity-60 dark:border-neutral-700"
        disabled={pending}
        name="provider"
        type="submit"
        value="apple"
      >
        Continue with Apple
      </button>
      {state.message && (
        <p
          className="text-sm text-red-600 sm:col-span-2 dark:text-red-400"
          role="alert"
        >
          {state.message}
        </p>
      )}
    </form>
  )
}

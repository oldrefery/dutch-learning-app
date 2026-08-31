'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clearPersistentBatchCapture } from '@/features/batch-capture/usePersistentBatchCapture'
import { clearAnalysisHistory } from '@/features/history/analysis-history'
import { deleteAccount } from './actions'
import { INITIAL_DELETE_ACCOUNT_STATE } from './form-state'
import { clearWebSettings } from './settings-storage'

export function DeleteAccountPanel({
  email,
  userId,
}: {
  email: string | null
  userId: string
}) {
  const router = useRouter()
  const [isExpanded, setIsExpanded] = useState(false)
  const [state, action, pending] = useActionState(
    deleteAccount,
    INITIAL_DELETE_ACCOUNT_STATE
  )

  useEffect(() => {
    if (state.status !== 'success') return
    clearAnalysisHistory(userId)
    clearPersistentBatchCapture()
    clearWebSettings(userId)
    router.replace('/login?message=account-deleted')
    router.refresh()
  }, [router, state.status, userId])

  if (!isExpanded) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 dark:border-rose-900 dark:bg-rose-950">
        <h2 className="text-lg font-semibold text-rose-950 dark:text-rose-100">
          Delete account
        </h2>
        <p className="mt-2 text-sm text-rose-900/80 dark:text-rose-100/80">
          Permanently delete your account, collections, words, review history,
          and access record. This action cannot be undone.
        </p>
        <button
          className="mt-5 rounded-xl border border-rose-700 px-4 py-2 text-sm font-medium text-rose-800 outline-none focus-visible:ring-2 focus-visible:ring-rose-600 dark:border-rose-400 dark:text-rose-200"
          onClick={() => setIsExpanded(true)}
          type="button"
        >
          Begin account deletion
        </button>
      </div>
    )
  }

  return (
    <form
      action={action}
      className="rounded-2xl border border-rose-300 bg-rose-50 p-6 dark:border-rose-800 dark:bg-rose-950"
    >
      <h2 className="text-lg font-semibold text-rose-950 dark:text-rose-100">
        Confirm permanent deletion
      </h2>
      <p className="mt-2 text-sm text-rose-900/80 dark:text-rose-100/80">
        The existing Supabase deletion service will remove the authentication
        account and all data linked by database cascade rules.
      </p>

      <label className="mt-5 block text-sm font-medium" htmlFor="delete-email">
        Account email
      </label>
      <input
        autoComplete="email"
        className="mt-2 w-full rounded-xl border border-rose-300 bg-white px-3 py-2 text-neutral-950 outline-none focus-visible:ring-2 focus-visible:ring-rose-600 dark:border-rose-800"
        id="delete-email"
        name="confirmationEmail"
        placeholder={email ?? 'Signed-in email'}
        required
        type="email"
      />

      <label className="mt-4 block text-sm font-medium" htmlFor="delete-phrase">
        Enter DELETE exactly
      </label>
      <input
        autoComplete="off"
        className="mt-2 w-full rounded-xl border border-rose-300 bg-white px-3 py-2 font-mono text-neutral-950 outline-none focus-visible:ring-2 focus-visible:ring-rose-600 dark:border-rose-800"
        id="delete-phrase"
        name="confirmationPhrase"
        pattern="DELETE"
        required
      />

      <label className="mt-4 flex items-start gap-3 text-sm">
        <input
          className="mt-1 size-4 accent-rose-700"
          name="understand"
          required
          type="checkbox"
          value="yes"
        />
        <span>
          I understand that this permanently deletes my account and all learning
          data.
        </span>
      </label>

      {state.message && (
        <p
          aria-live="assertive"
          className="mt-4 text-sm text-rose-800 dark:text-rose-200"
          role="alert"
        >
          {state.message}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? 'Deleting account…' : 'Delete my account permanently'}
        </button>
        <button
          className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700"
          disabled={pending}
          onClick={() => setIsExpanded(false)}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

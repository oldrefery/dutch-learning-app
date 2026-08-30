'use client'

import { useActionState, useEffect, useRef } from 'react'
import { createCollection } from './actions'
import { INITIAL_COLLECTION_FORM_STATE } from './form-state'

export function CreateCollectionForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [state, action, pending] = useActionState(
    createCollection,
    INITIAL_COLLECTION_FORM_STATE
  )

  useEffect(() => {
    if (state.status === 'success') {
      formRef.current?.reset()
    }
  }, [state.status])

  return (
    <form
      ref={formRef}
      action={action}
      className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <h2 className="text-base font-semibold">Create a collection</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Start with an empty collection, then add Dutch words to it.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label className="sr-only" htmlFor="collection-name">
            Collection name
          </label>
          <input
            aria-describedby="collection-name-error"
            aria-invalid={Boolean(state.fieldErrors?.name)}
            className="w-full rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-sm outline-none focus:border-neutral-600 dark:border-neutral-700 dark:focus:border-neutral-400"
            id="collection-name"
            maxLength={50}
            name="name"
            placeholder="Collection name"
            required
            type="text"
          />
          {state.fieldErrors?.name && (
            <p
              className="mt-2 text-sm text-red-600 dark:text-red-400"
              id="collection-name-error"
            >
              {state.fieldErrors.name}
            </p>
          )}
        </div>
        <button
          className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-950"
          disabled={pending}
          type="submit"
        >
          {pending ? 'Creating…' : 'Create'}
        </button>
      </div>
      {state.message && (
        <p
          aria-live="polite"
          className={`mt-3 text-sm ${
            state.status === 'success'
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-red-600 dark:text-red-400'
          }`}
          role={state.status === 'error' ? 'alert' : 'status'}
        >
          {state.message}
        </p>
      )}
    </form>
  )
}

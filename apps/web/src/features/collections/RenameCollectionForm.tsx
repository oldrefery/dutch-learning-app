'use client'

import { useActionState } from 'react'
import { renameCollection } from './actions'
import { INITIAL_COLLECTION_FORM_STATE } from './form-state'

export function RenameCollectionForm({
  collectionId,
  currentName,
}: {
  collectionId: string
  currentName: string
}) {
  const renameCollectionWithId = renameCollection.bind(null, collectionId)
  const [state, action, pending] = useActionState(
    renameCollectionWithId,
    INITIAL_COLLECTION_FORM_STATE
  )

  return (
    <form
      action={action}
      className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <h2 className="text-base font-semibold">Rename collection</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Change the name shown on web and mobile after the next sync.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label className="sr-only" htmlFor="rename-collection-name">
            New collection name
          </label>
          <input
            aria-describedby="rename-collection-name-error"
            aria-invalid={Boolean(state.fieldErrors?.name)}
            className="w-full rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-sm outline-none focus:border-neutral-600 dark:border-neutral-700 dark:focus:border-neutral-400"
            defaultValue={currentName}
            id="rename-collection-name"
            maxLength={50}
            name="name"
            required
            type="text"
          />
          {state.fieldErrors?.name && (
            <p
              className="mt-2 text-sm text-red-600 dark:text-red-400"
              id="rename-collection-name-error"
            >
              {state.fieldErrors.name}
            </p>
          )}
        </div>
        <button
          className="rounded-xl border border-neutral-300 px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700"
          disabled={pending}
          type="submit"
        >
          {pending ? 'Saving…' : 'Save name'}
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

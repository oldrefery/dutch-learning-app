'use client'

import { useActionState } from 'react'
import { deleteCollection } from './actions'
import { INITIAL_COLLECTION_FORM_STATE } from './form-state'

export function DeleteCollectionForm({
  collectionId,
  collectionName,
  totalWords,
}: {
  collectionId: string
  collectionName: string
  totalWords: number
}) {
  const deleteCollectionWithId = deleteCollection.bind(null, collectionId)
  const [state, action, pending] = useActionState(
    deleteCollectionWithId,
    INITIAL_COLLECTION_FORM_STATE
  )

  return (
    <form
      action={action}
      className="rounded-2xl border border-red-200 bg-white p-5 dark:border-red-950 dark:bg-neutral-900"
    >
      <h2 className="text-base font-semibold text-red-700 dark:text-red-400">
        Delete collection
      </h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        This permanently removes the collection and marks its {totalWords}{' '}
        {totalWords === 1 ? 'word' : 'words'} as deleted for mobile sync.
      </p>
      <p className="mt-3 text-sm">
        Enter <strong>{collectionName}</strong> to confirm.
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label className="sr-only" htmlFor="delete-collection-confirmation">
            Collection name confirmation
          </label>
          <input
            aria-describedby="delete-collection-confirmation-error"
            aria-invalid={Boolean(state.fieldErrors?.confirmation)}
            autoComplete="off"
            className="w-full rounded-xl border border-red-200 bg-transparent px-4 py-3 text-sm outline-none focus:border-red-500 dark:border-red-950"
            id="delete-collection-confirmation"
            name="confirmation"
            required
            type="text"
          />
          {state.fieldErrors?.confirmation && (
            <p
              className="mt-2 text-sm text-red-600 dark:text-red-400"
              id="delete-collection-confirmation-error"
            >
              {state.fieldErrors.confirmation}
            </p>
          )}
        </div>
        <button
          className="rounded-xl bg-red-700 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-600"
          disabled={pending}
          type="submit"
        >
          {pending ? 'Deleting…' : 'Delete permanently'}
        </button>
      </div>
      {state.message && (
        <p
          aria-live="polite"
          className="mt-3 text-sm text-red-600 dark:text-red-400"
          role="alert"
        >
          {state.message}
        </p>
      )}
    </form>
  )
}

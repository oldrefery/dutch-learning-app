'use client'

import { useActionState } from 'react'
import type { CollectionOption } from './repository'
import { deleteWord, moveWord, resetWordProgress } from './actions'
import { INITIAL_WORD_ACTION_STATE } from './form-state'

const ActionMessage = ({
  message,
  status,
}: {
  message: string | null
  status: 'idle' | 'success' | 'error'
}) => {
  if (!message) return null

  return (
    <p
      aria-live="polite"
      className={`mt-3 text-sm ${
        status === 'success'
          ? 'text-emerald-700 dark:text-emerald-400'
          : 'text-red-600 dark:text-red-400'
      }`}
      role={status === 'error' ? 'alert' : 'status'}
    >
      {message}
    </p>
  )
}

function MoveWordForm({
  collectionId,
  moveTargets,
  wordId,
}: {
  collectionId: string
  moveTargets: CollectionOption[]
  wordId: string
}) {
  const moveWordWithIds = moveWord.bind(null, collectionId, wordId)
  const [state, action, pending] = useActionState(
    moveWordWithIds,
    INITIAL_WORD_ACTION_STATE
  )

  return (
    <form
      action={action}
      className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <h2 className="text-base font-semibold">Move word</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Move this word and its current learning progress to another collection.
      </p>
      {moveTargets.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
          Create another collection before moving this word.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label className="sr-only" htmlFor="target-collection">
              Target collection
            </label>
            <select
              aria-describedby="target-collection-error"
              aria-invalid={Boolean(state.fieldErrors?.targetCollectionId)}
              className="w-full rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-sm dark:border-neutral-700"
              defaultValue=""
              id="target-collection"
              name="targetCollectionId"
              required
            >
              <option disabled value="">
                Choose collection
              </option>
              {moveTargets.map(collection => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>
            {state.fieldErrors?.targetCollectionId && (
              <p
                className="mt-2 text-sm text-red-600 dark:text-red-400"
                id="target-collection-error"
              >
                {state.fieldErrors.targetCollectionId}
              </p>
            )}
          </div>
          <button
            className="rounded-xl border border-neutral-300 px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700"
            disabled={pending}
            type="submit"
          >
            {pending ? 'Moving…' : 'Move'}
          </button>
        </div>
      )}
      <ActionMessage message={state.message} status={state.status} />
    </form>
  )
}

function ResetWordForm({
  collectionId,
  wordId,
}: {
  collectionId: string
  wordId: string
}) {
  const resetWordWithIds = resetWordProgress.bind(null, collectionId, wordId)
  const [state, action, pending] = useActionState(
    resetWordWithIds,
    INITIAL_WORD_ACTION_STATE
  )

  return (
    <form
      action={action}
      className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
    >
      <h2 className="text-base font-semibold">Reset learning progress</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Return this word to its initial SRS state. Review history remains
        available for future insights.
      </p>
      <button
        className="mt-4 rounded-xl border border-neutral-300 px-5 py-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700"
        disabled={pending}
        type="submit"
      >
        {pending ? 'Resetting…' : 'Reset progress'}
      </button>
      <ActionMessage message={state.message} status={state.status} />
    </form>
  )
}

function DeleteWordForm({
  collectionId,
  wordId,
}: {
  collectionId: string
  wordId: string
}) {
  const deleteWordWithIds = deleteWord.bind(null, collectionId, wordId)
  const [state, action, pending] = useActionState(
    deleteWordWithIds,
    INITIAL_WORD_ACTION_STATE
  )

  return (
    <form
      action={action}
      className="rounded-2xl border border-red-200 bg-white p-5 dark:border-red-950 dark:bg-neutral-900"
    >
      <h2 className="text-base font-semibold text-red-700 dark:text-red-400">
        Delete word
      </h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        The word will disappear from active collections and remain as a
        tombstone for mobile synchronization.
      </p>
      <label className="mt-4 flex items-start gap-3 text-sm">
        <input
          className="mt-1"
          name="confirmation"
          required
          type="checkbox"
          value="delete"
        />
        <span>I understand that this removes the word and its progress.</span>
      </label>
      {state.fieldErrors?.confirmation && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {state.fieldErrors.confirmation}
        </p>
      )}
      <button
        className="mt-4 rounded-xl bg-red-700 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-600"
        disabled={pending}
        type="submit"
      >
        {pending ? 'Deleting…' : 'Delete word'}
      </button>
      <ActionMessage message={state.message} status={state.status} />
    </form>
  )
}

export function WordManagementForms({
  collectionId,
  moveTargets,
  wordId,
}: {
  collectionId: string
  moveTargets: CollectionOption[]
  wordId: string
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <MoveWordForm
        collectionId={collectionId}
        moveTargets={moveTargets}
        wordId={wordId}
      />
      <ResetWordForm collectionId={collectionId} wordId={wordId} />
      <DeleteWordForm collectionId={collectionId} wordId={wordId} />
    </div>
  )
}

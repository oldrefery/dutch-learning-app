'use client'

import { useActionState, useState } from 'react'
import { updateCollectionSharing } from './actions'
import type { CollectionSharingState } from './form-state'

interface CollectionSharingPanelProps {
  collectionId: string
  initialState: CollectionSharingState
}

export function CollectionSharingPanel({
  collectionId,
  initialState,
}: CollectionSharingPanelProps) {
  const action = updateCollectionSharing.bind(null, collectionId)
  const [state, formAction, pending] = useActionState(action, initialState)
  const [copyMessage, setCopyMessage] = useState<string | null>(null)

  const copyShareLink = async () => {
    if (!state.shareUrl) return
    try {
      await navigator.clipboard.writeText(state.shareUrl)
      setCopyMessage('Link copied.')
    } catch {
      setCopyMessage('Copy failed. Select the link manually.')
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <p className="text-sm font-medium text-neutral-500">Sharing</p>
      <h3 className="mt-1 text-lg font-semibold">
        {state.isShared ? 'Published collection' : 'Private collection'}
      </h3>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
        {state.isShared
          ? 'Anyone with this link can preview the collection after signing in and import selected words.'
          : 'Publish this collection to create a stable woordenaar.app import link.'}
      </p>

      {state.isShared && state.shareUrl && (
        <div className="mt-4">
          <label className="text-sm font-medium" htmlFor="collection-share-url">
            Share link
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              className="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
              id="collection-share-url"
              readOnly
              value={state.shareUrl}
            />
            <button
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700"
              onClick={() => void copyShareLink()}
              type="button"
            >
              Copy link
            </button>
          </div>
        </div>
      )}

      <form action={formAction} className="mt-4">
        <button
          className={`rounded-xl px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${
            state.isShared
              ? 'border border-neutral-300 dark:border-neutral-700'
              : 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-950'
          }`}
          disabled={pending}
          name="intent"
          type="submit"
          value={state.isShared ? 'stop' : 'publish'}
        >
          {pending
            ? 'Updating…'
            : state.isShared
              ? 'Stop sharing'
              : 'Publish collection'}
        </button>
      </form>

      {(state.message || copyMessage) && (
        <p
          className={`mt-3 text-sm ${
            state.status === 'error'
              ? 'text-red-600 dark:text-red-400'
              : 'text-neutral-600 dark:text-neutral-400'
          }`}
          role={state.status === 'error' ? 'alert' : 'status'}
        >
          {copyMessage ?? state.message}
        </p>
      )}
    </div>
  )
}

'use client'

import {
  BATCH_CAPTURE_MAX_ITEMS,
  parseBatchCaptureInput,
} from '@woordenaar/domain'
import { useMemo, useState } from 'react'
import type { CollectionOption } from '@/features/words/repository'

interface BatchCaptureComposerProps {
  collections: CollectionOption[]
  defaultCollectionId: string
  onCreateQueue: (
    items: ReturnType<typeof parseBatchCaptureInput>['items'],
    targetCollectionId: string
  ) => void
}

export function BatchCaptureComposer({
  collections,
  defaultCollectionId,
  onCreateQueue,
}: BatchCaptureComposerProps) {
  const [rawInput, setRawInput] = useState('')
  const [targetCollectionId, setTargetCollectionId] =
    useState(defaultCollectionId)
  const parsed = useMemo(() => parseBatchCaptureInput(rawInput), [rawInput])
  const disabled =
    parsed.items.length === 0 ||
    parsed.hasBlockingIssues ||
    targetCollectionId === ''

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-xl font-semibold tracking-tight">
        Capture a word list
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
        Enter one Dutch word or expression per line. Add an optional, unverified
        translation hint after a semicolon. Every AI result must be reviewed
        before it is saved.
      </p>

      <label className="mt-5 block text-sm font-medium" htmlFor="batch-input">
        Dutch words
      </label>
      <textarea
        autoCapitalize="none"
        autoComplete="off"
        className="mt-2 min-h-64 w-full rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-sm leading-6 outline-none focus:border-neutral-600 dark:border-neutral-700 dark:focus:border-neutral-400"
        id="batch-input"
        onChange={event => setRawInput(event.target.value)}
        placeholder={'huis ; house\nopstaan ; to get up\nhoe gaat het'}
        spellCheck={false}
        value={rawInput}
      />

      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <label className="text-sm font-medium" htmlFor="batch-collection">
            Target collection
          </label>
          <select
            className="mt-2 w-full rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-sm dark:border-neutral-700"
            id="batch-collection"
            onChange={event => setTargetCollectionId(event.target.value)}
            value={targetCollectionId}
          >
            {collections.map(collection => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </select>
        </div>
        <button
          className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-950"
          disabled={disabled}
          onClick={() => onCreateQueue(parsed.items, targetCollectionId)}
          type="button"
        >
          Create review queue
        </button>
      </div>

      <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
        {parsed.items.length} valid{' '}
        {parsed.items.length === 1 ? 'item' : 'items'} · maximum{' '}
        {BATCH_CAPTURE_MAX_ITEMS}
      </p>
      {parsed.issues.length > 0 && (
        <ul className="mt-3 grid gap-2" aria-label="Batch input issues">
          {parsed.issues.map(issue => (
            <li
              className={`text-sm ${
                issue.blocking
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-amber-700 dark:text-amber-300'
              }`}
              key={`${issue.line}-${issue.code}`}
            >
              Line {issue.line}: {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

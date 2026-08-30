'use client'

import type { CollectionOption } from '@/features/words/repository'
import { isWebBatchCaptureFinished } from './batch-capture-domain'
import type { WebBatchCaptureItem } from './types'

const STATUS_LABELS: Record<WebBatchCaptureItem['status'], string> = {
  queued: 'Queued',
  checking_duplicate: 'Checking duplicate',
  possible_duplicate: 'Possible duplicate',
  analyzing: 'Analyzing',
  awaiting_review: 'Awaiting review',
  failed: 'Needs attention',
  completed: 'Saved',
  skipped: 'Skipped',
  cancelled: 'Cancelled',
}

const statusClassName = (status: WebBatchCaptureItem['status']): string => {
  if (status === 'completed') {
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
  }
  if (status === 'failed' || status === 'possible_duplicate') {
    return 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'
  }
  if (status === 'cancelled' || status === 'skipped') {
    return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
  }
  return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
}

interface BatchCaptureQueueProps {
  activeItemId: string | null
  collections: CollectionOption[]
  isPaused: boolean
  items: WebBatchCaptureItem[]
  onAnalyzeDuplicate: (itemId: string) => void
  onCancelRemaining: () => void
  onClear: () => void
  onPause: () => void
  onRetry: (itemId: string) => void
  onSkip: (itemId: string) => void
  onStart: () => void
  onTargetCollectionChange: (collectionId: string) => void
  targetCollectionId: string
}

export function BatchCaptureQueue({
  activeItemId,
  collections,
  isPaused,
  items,
  onAnalyzeDuplicate,
  onCancelRemaining,
  onClear,
  onPause,
  onRetry,
  onSkip,
  onStart,
  onTargetCollectionChange,
  targetCollectionId,
}: BatchCaptureQueueProps) {
  const finished = isWebBatchCaptureFinished(items)
  const completedCount = items.filter(
    item => item.status === 'completed'
  ).length
  const resolvedCount = items.filter(item =>
    ['completed', 'skipped', 'cancelled'].includes(item.status)
  ).length

  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-medium text-neutral-500">
              Persistent review queue
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              {resolvedCount} of {items.length} resolved
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              {completedCount} saved · queue progress is stored in this browser
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {!finished && (
              <button
                className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-950"
                disabled={Boolean(activeItemId)}
                onClick={isPaused ? onStart : onPause}
                type="button"
              >
                {isPaused ? 'Start / Resume' : 'Pause'}
              </button>
            )}
            <button
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700"
              disabled={Boolean(activeItemId)}
              onClick={finished ? onClear : onCancelRemaining}
              type="button"
            >
              {finished ? 'Clear queue' : 'Cancel remaining'}
            </button>
          </div>
        </div>

        <label
          className="mt-5 block text-sm font-medium"
          htmlFor="queue-target"
        >
          Target collection
        </label>
        <select
          className="mt-2 w-full rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-sm disabled:opacity-60 dark:border-neutral-700"
          disabled={Boolean(activeItemId)}
          id="queue-target"
          onChange={event => onTargetCollectionChange(event.target.value)}
          value={targetCollectionId}
        >
          {collections.map(collection => (
            <option key={collection.id} value={collection.id}>
              {collection.name}
            </option>
          ))}
        </select>
      </div>

      {items.map(item => (
        <article
          className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
          key={item.id}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="font-semibold">{item.dutchText}</h3>
              {item.translationHint && (
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  Unverified hint: {item.translationHint}
                </p>
              )}
            </div>
            <span
              className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${statusClassName(item.status)}`}
            >
              {STATUS_LABELS[item.status]}
            </span>
          </div>

          {item.duplicate && (
            <p className="mt-3 text-sm text-amber-700 dark:text-amber-300">
              A word with this lemma already exists
              {item.duplicate.collectionName
                ? ` in “${item.duplicate.collectionName}”`
                : ' in your vocabulary'}
              .
            </p>
          )}
          {item.error && (
            <p className="mt-3 text-sm text-red-600 dark:text-red-400">
              {item.error}
            </p>
          )}

          {item.status === 'possible_duplicate' && (
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white dark:bg-amber-600"
                onClick={() => onAnalyzeDuplicate(item.id)}
                type="button"
              >
                Analyze anyway
              </button>
              <button
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700"
                onClick={() => onSkip(item.id)}
                type="button"
              >
                Skip
              </button>
            </div>
          )}

          {item.status === 'failed' && (
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-medium text-white dark:bg-amber-600"
                onClick={() => onRetry(item.id)}
                type="button"
              >
                Retry
              </button>
              <button
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700"
                onClick={() => onSkip(item.id)}
                type="button"
              >
                Skip
              </button>
            </div>
          )}
        </article>
      ))}
    </div>
  )
}

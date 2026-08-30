import Link from 'next/link'
import type { ReviewCollection, ReviewScope, ReviewSessionMode } from './types'

const MODE_OPTIONS: readonly {
  description: string
  label: string
  value: ReviewSessionMode
}[] = [
  {
    value: 'adaptive',
    label: 'Adaptive',
    description: 'Adjust the challenge separately for every word.',
  },
  {
    value: 'recognition',
    label: 'Recognition',
    description: 'Choose the correct meaning.',
  },
  {
    value: 'meaning-recall',
    label: 'Meaning Recall',
    description: 'See Dutch and recall the meaning.',
  },
  {
    value: 'dutch-production',
    label: 'Dutch Production',
    description: 'See a translation and produce the Dutch word.',
  },
]

interface ReviewSetupProps {
  collectionId: string | null
  collections: ReviewCollection[]
  dueCount: number
  emptyMessage: string | null
  mode: ReviewSessionMode
  onCollectionChange: (value: string) => void
  onModeChange: (value: ReviewSessionMode) => void
  onScopeChange: (value: ReviewScope) => void
  onStart: () => void
  scope: ReviewScope
}

export function ReviewSetup({
  collectionId,
  collections,
  dueCount,
  emptyMessage,
  mode,
  onCollectionChange,
  onModeChange,
  onScopeChange,
  onStart,
  scope,
}: ReviewSetupProps) {
  return (
    <section>
      <p className="text-sm font-medium text-neutral-500">Learning session</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Review</h1>
      <p className="mt-3 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
        Choose a challenge and a due-word scope. Progress is shared with the
        mobile app.
      </p>
      <Link
        className="mt-5 inline-flex rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700"
        href="/app/review/audio"
      >
        Open Audio Review
      </Link>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {MODE_OPTIONS.map(option => (
          <button
            aria-pressed={mode === option.value}
            className={`rounded-2xl border p-5 text-left transition ${
              mode === option.value
                ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-950'
                : 'border-neutral-200 bg-white hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-900'
            }`}
            key={option.value}
            onClick={() => onModeChange(option.value)}
            type="button"
          >
            <span className="font-semibold">{option.label}</span>
            <span
              className={`mt-1 block text-sm ${
                mode === option.value
                  ? 'text-neutral-300 dark:text-neutral-600'
                  : 'text-neutral-600 dark:text-neutral-400'
              }`}
            >
              {option.description}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <label className="text-sm font-medium" htmlFor="review-scope">
          Review scope
        </label>
        <select
          className="mt-2 w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
          id="review-scope"
          onChange={event => onScopeChange(event.target.value as ReviewScope)}
          value={scope}
        >
          <option value="all-due">All due words</option>
          <option value="collection-due">One collection</option>
          <option value="difficult-due">Difficult due words</option>
        </select>

        {scope === 'collection-due' && (
          <label className="mt-4 block text-sm font-medium">
            Collection
            <select
              className="mt-2 w-full rounded-xl border border-neutral-300 bg-transparent px-3 py-2 dark:border-neutral-700"
              onChange={event => onCollectionChange(event.target.value)}
              value={collectionId ?? ''}
            >
              <option disabled value="">
                Choose a collection
              </option>
              {collections.map(collection => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {dueCount} {dueCount === 1 ? 'word is' : 'words are'} due in this
            scope.
          </p>
          <button
            className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-950"
            disabled={dueCount === 0}
            onClick={onStart}
            type="button"
          >
            Start review
          </button>
        </div>
        {emptyMessage && (
          <p className="mt-4 text-sm text-amber-700 dark:text-amber-300">
            {emptyMessage}
          </p>
        )}
      </div>
    </section>
  )
}

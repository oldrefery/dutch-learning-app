import { CreateCollectionForm } from '@/features/collections/CreateCollectionForm'
import type { CollectionOverview } from '@/features/collections/collection-overview'
import { listCollectionOverviews } from '@/features/collections/repository'
import { requireAuthContext } from '@/lib/auth/session'
import Link from 'next/link'

const SummaryCard = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
    <p className="text-sm text-neutral-600 dark:text-neutral-400">{label}</p>
    <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
  </div>
)

const CollectionCard = ({ collection }: { collection: CollectionOverview }) => (
  <article className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold">
          <Link
            className="rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-neutral-500"
            href={`/app/collections/${collection.id}`}
          >
            {collection.name}
          </Link>
        </h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          {collection.totalWords}{' '}
          {collection.totalWords === 1 ? 'word' : 'words'}
          {collection.isShared ? ' · Shared' : ''}
        </p>
      </div>
      {collection.dueWords > 0 && (
        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {collection.dueWords} due
        </span>
      )}
    </div>
    <div className="mt-5">
      <div className="mb-2 flex items-center justify-between gap-4 text-xs text-neutral-600 dark:text-neutral-400">
        <span>
          {collection.masteredWords}/{collection.totalWords} mastered
        </span>
        <span>{collection.progressPercentage}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          aria-hidden="true"
          className="h-full rounded-full bg-emerald-600 dark:bg-emerald-400"
          style={{ width: `${collection.progressPercentage}%` }}
        />
      </div>
    </div>
    <Link
      className="mt-5 inline-flex text-sm font-medium text-neutral-700 hover:underline dark:text-neutral-300"
      href={`/app/collections/${collection.id}`}
    >
      View collection
    </Link>
  </article>
)

export default async function CollectionsPage() {
  const auth = await requireAuthContext()
  const collections = await listCollectionOverviews(auth.userId)
  const totals = collections.reduce(
    (result, collection) => ({
      words: result.words + collection.totalWords,
      mastered: result.mastered + collection.masteredWords,
      due: result.due + collection.dueWords,
      newWords: result.newWords + collection.newWords,
    }),
    { words: 0, mastered: 0, due: 0, newWords: 0 }
  )

  return (
    <section>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-500">
            Your learning workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Collections
          </h1>
        </div>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {collections.length}{' '}
          {collections.length === 1 ? 'collection' : 'collections'}
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        <SummaryCard label="Words" value={totals.words} />
        <SummaryCard label="Mastered" value={totals.mastered} />
        <SummaryCard label="Due now" value={totals.due} />
        <SummaryCard label="New" value={totals.newWords} />
      </div>

      <div className="mt-6">
        {auth.accessLevel === 'full_access' ? (
          <CreateCollectionForm />
        ) : (
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
            This account has read-only access. You can study existing words, but
            collection changes are disabled.
          </div>
        )}
      </div>

      {collections.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 px-6 py-12 text-center dark:border-neutral-700">
          <h2 className="text-lg font-semibold">No collections yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600 dark:text-neutral-400">
            Create your first collection to organize the Dutch words you want to
            learn.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {collections.map(collection => (
            <CollectionCard collection={collection} key={collection.id} />
          ))}
        </div>
      )}
    </section>
  )
}

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CollectionWordList } from '@/features/collections/CollectionWordList'
import { DeleteCollectionForm } from '@/features/collections/DeleteCollectionForm'
import { RenameCollectionForm } from '@/features/collections/RenameCollectionForm'
import { getOwnedCollectionDetail } from '@/features/collections/repository'
import { requireAuthContext } from '@/lib/auth/session'

const SummaryCard = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
    <p className="text-sm text-neutral-600 dark:text-neutral-400">{label}</p>
    <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
  </div>
)

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ collectionId: string }>
}) {
  const auth = await requireAuthContext()
  const { collectionId } = await params
  const collection = await getOwnedCollectionDetail(auth.userId, collectionId)

  if (!collection) {
    notFound()
  }

  return (
    <section>
      <Link
        className="text-sm text-neutral-600 hover:underline dark:text-neutral-400"
        href="/app/collections"
      >
        ← All collections
      </Link>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-500">
            {collection.isShared ? 'Shared collection' : 'Private collection'}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {collection.name}
          </h1>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {collection.progressPercentage}% mastered
          </p>
          <div className="flex flex-wrap gap-3">
            {collection.dueWords > 0 && (
              <Link
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700"
                href={`/app/review?scope=collection-due&collectionId=${collection.id}`}
              >
                Review {collection.dueWords} due
              </Link>
            )}
            {auth.accessLevel === 'full_access' && (
              <Link
                className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-950"
                href={`/app/collections/${collection.id}/words/new`}
              >
                Add word
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-4">
        <SummaryCard label="Words" value={collection.totalWords} />
        <SummaryCard label="Mastered" value={collection.masteredWords} />
        <SummaryCard label="Due now" value={collection.dueWords} />
        <SummaryCard label="New" value={collection.newWords} />
      </div>

      <div className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-neutral-500">
              Collection content
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">
              Words
            </h2>
          </div>
        </div>
        <CollectionWordList
          collectionId={collection.id}
          words={collection.words}
        />
      </div>

      <div className="mt-10 border-t border-neutral-200 pt-8 dark:border-neutral-800">
        <h2 className="text-2xl font-semibold tracking-tight">
          Collection settings
        </h2>
        {auth.accessLevel === 'full_access' ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <RenameCollectionForm
              collectionId={collection.id}
              currentName={collection.name}
            />
            <DeleteCollectionForm
              collectionId={collection.id}
              collectionName={collection.name}
              totalWords={collection.totalWords}
            />
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
            This account has read-only access. Renaming and deletion are
            disabled.
          </div>
        )}
      </div>
    </section>
  )
}

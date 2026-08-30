import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AddWordWorkflow } from '@/features/analysis/AddWordWorkflow'
import {
  hasOwnedCollection,
  listOwnedCollectionOptions,
} from '@/features/analysis/repository'
import { requireAuthContext } from '@/lib/auth/session'

export default async function AddWordPage({
  params,
}: {
  params: Promise<{ collectionId: string }>
}) {
  const auth = await requireAuthContext()
  const { collectionId } = await params
  const collections = await listOwnedCollectionOptions(auth.userId)

  if (!hasOwnedCollection(collectionId, collections)) {
    notFound()
  }

  return (
    <section>
      <Link
        className="text-sm text-neutral-600 hover:underline dark:text-neutral-400"
        href={`/app/collections/${collectionId}`}
      >
        ← Back to collection
      </Link>
      <div className="mt-5">
        <p className="text-sm font-medium text-neutral-500">
          AI-assisted vocabulary
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Add a Dutch word
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
          Analyze a word, review the complete result, choose an image, and save
          it to one of your collections.
        </p>
      </div>

      <div className="mt-8">
        {auth.accessLevel === 'full_access' ? (
          <AddWordWorkflow
            collections={collections}
            initialCollectionId={collectionId}
          />
        ) : (
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
            Full access is required to analyze and save new words.
          </div>
        )}
      </div>
    </section>
  )
}

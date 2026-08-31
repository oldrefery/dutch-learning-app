import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SharedCollectionImport } from '@/features/sharing/SharedCollectionImport'
import { getSharedCollectionImportContext } from '@/features/sharing/repository'
import { requireAuthContext } from '@/lib/auth/session'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: 'Import shared collection',
}

export default async function SharedCollectionPage({
  params,
}: {
  params: Promise<{ shareToken: string }>
}) {
  const auth = await requireAuthContext()
  const { shareToken } = await params
  const context = await getSharedCollectionImportContext(
    auth.userId,
    shareToken
  )

  if (!context) notFound()

  const duplicateCount = context.previewWords.filter(
    word => word.isDuplicate
  ).length

  return (
    <section>
      <Link
        className="text-sm text-neutral-600 hover:underline dark:text-neutral-400"
        href="/app/collections"
      >
        ← My collections
      </Link>
      <div className="mt-5 max-w-3xl">
        <p className="text-sm font-medium text-neutral-500">
          Shared collection
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {context.collection.name}
        </h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          Review the words, choose what to keep, and import them into one of
          your collections. Your own progress starts from the beginning.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-sm text-neutral-500">Shared words</p>
          <p className="mt-2 text-3xl font-semibold">
            {context.previewWords.length}
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-sm text-neutral-500">Already yours</p>
          <p className="mt-2 text-3xl font-semibold">{duplicateCount}</p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-sm text-neutral-500">Available</p>
          <p className="mt-2 text-3xl font-semibold">
            {context.previewWords.length - duplicateCount}
          </p>
        </div>
      </div>

      <div className="mt-8">
        <SharedCollectionImport
          collectionName={context.collection.name}
          collections={context.collections}
          shareToken={shareToken}
          words={context.previewWords}
        />
      </div>
    </section>
  )
}

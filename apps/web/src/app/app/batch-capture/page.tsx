import Link from 'next/link'
import { BatchCaptureWorkspace } from '@/features/batch-capture/BatchCaptureWorkspace'
import { listOwnedCollectionOptions } from '@/features/analysis/repository'
import { requireAuthContext } from '@/lib/auth/session'

export default async function BatchCapturePage() {
  const auth = await requireAuthContext()
  const collections = await listOwnedCollectionOptions(auth.userId)

  return (
    <section>
      <Link
        className="text-sm text-neutral-600 hover:underline dark:text-neutral-400"
        href="/app/collections"
      >
        ← All collections
      </Link>

      <div className="mt-5 max-w-3xl">
        <p className="text-sm font-medium text-neutral-500">
          AI-assisted acquisition
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Batch capture
        </h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          Build a recoverable queue of up to 30 Dutch words. Analysis runs one
          item at a time, and nothing is saved without your approval.
        </p>
      </div>

      <div className="mt-8">
        {auth.accessLevel !== 'full_access' ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
            Full access is required because batch capture uses AI analysis and
            creates new words.
          </div>
        ) : collections.length === 0 ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="text-lg font-semibold">Create a collection first</h2>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Batch results need an owned collection before analysis can start.
            </p>
            <Link
              className="mt-4 inline-flex rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-950"
              href="/app/collections"
            >
              Go to collections
            </Link>
          </div>
        ) : (
          <BatchCaptureWorkspace
            collections={collections}
            userId={auth.userId}
          />
        )}
      </div>
    </section>
  )
}

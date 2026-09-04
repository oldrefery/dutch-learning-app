import Link from 'next/link'
import { AddWordWorkflow } from '@/features/analysis/AddWordWorkflow'
import { listOwnedCollectionOptions } from '@/features/analysis/repository'
import { requireAuthContext } from '@/lib/auth/session'

export default async function AddWordPage() {
  const auth = await requireAuthContext()
  const collections = await listOwnedCollectionOptions(auth.userId)

  return (
    <section className="mx-auto max-w-[840px]">
      <p className="dw-label">AI-assisted vocabulary</p>
      <h1 className="dw-page-title mt-2">Add a Dutch word</h1>
      <p className="dw-support mt-3 max-w-2xl">
        Enter the word exactly as you met it. Review the analysis before saving
        it to a collection.
      </p>

      <div className="mt-8">
        {auth.accessLevel !== 'full_access' ? (
          <div className="dw-surface border-dashed p-6">
            <span className="dw-chip">🔒 Read-only</span>
            <h2 className="mt-4 text-lg font-semibold">
              Adding words is not part of your access
            </h2>
            <p className="dw-support mt-2">
              You can still review existing words and import shared collections.
            </p>
          </div>
        ) : collections.length === 0 ? (
          <div className="dw-surface border-dashed p-6">
            <h2 className="text-lg font-semibold">Create a collection first</h2>
            <p className="dw-support mt-2">
              Every analyzed word needs a collection before it can be saved.
            </p>
            <Link
              className="dw-button dw-button--primary mt-5"
              href="/app/collections"
            >
              Open collections
            </Link>
          </div>
        ) : (
          <AddWordWorkflow
            collections={collections}
            initialCollectionId={collections[0].id}
            userId={auth.userId}
          />
        )}
      </div>
    </section>
  )
}

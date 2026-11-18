import { AddWordWorkflow } from '@/features/analysis/AddWordWorkflow'
import { listOwnedCollectionOptions } from '@/features/analysis/repository'
import { isDictionaryFollowingEnabled } from '@/features/dictionary/repository'
import { requireAuthContext } from '@/lib/auth/session'

export default async function AddWordPage() {
  const auth = await requireAuthContext()
  const followingEnabled = isDictionaryFollowingEnabled()
  const collections = await listOwnedCollectionOptions(auth.userId)

  return (
    <section className="mx-auto max-w-[840px]">
      <p className="dw-label">
        {followingEnabled ? 'Shared vocabulary' : 'AI-assisted vocabulary'}
      </p>
      <h1 className="dw-page-title mt-2">Add a Dutch word</h1>
      <p className="dw-support mt-3 max-w-2xl">
        {followingEnabled && auth.accessLevel !== 'full_access'
          ? 'Find a published Dutch meaning and select the meanings to add to a collection.'
          : 'Enter the word exactly as you met it. Review the analysis before saving it to a collection.'}
      </p>

      <div className="mt-8">
        {followingEnabled && auth.accessLevel !== 'full_access' ? (
          <AddWordWorkflow
            key={`${auth.userId}:following`}
            followingEnabled
            collections={collections}
            initialCollectionId={collections[0]?.id ?? ''}
            useStoredCollectionPreference
            userId={auth.userId}
          />
        ) : auth.accessLevel !== 'full_access' ? (
          <div className="dw-surface border-dashed p-6">
            <span className="dw-chip">🔒 Read-only</span>
            <h2 className="mt-4 text-lg font-semibold">
              Adding words is not part of your access
            </h2>
            <p className="dw-support mt-2">
              You can still review existing words and import shared collections.
            </p>
          </div>
        ) : (
          <AddWordWorkflow
            collections={collections}
            canAnalyze
            followingEnabled={followingEnabled}
            initialCollectionId={collections[0]?.id ?? ''}
            useStoredCollectionPreference
            userId={auth.userId}
          />
        )}
      </div>
    </section>
  )
}

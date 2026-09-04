import Link from 'next/link'
import { StarterPackImport } from '@/features/starter-pack/StarterPackImport'
import { getStarterPackContext } from '@/features/starter-pack/repository'
import {
  buildStarterPackPreview,
  loadOfficialStarterPack,
} from '@/features/starter-pack/starter-pack-domain'
import { requireAuthContext } from '@/lib/auth/session'

export default async function StarterPackPage() {
  const auth = await requireAuthContext()
  const manifest = loadOfficialStarterPack()
  const context = await getStarterPackContext(auth.userId)
  const entries = buildStarterPackPreview(manifest, context.existingWords)
  const availableCount = entries.filter(entry => !entry.isDuplicate).length

  return (
    <section>
      <Link
        className="text-sm text-neutral-600 hover:underline dark:text-neutral-400"
        href="/app/collections"
      >
        ← All collections
      </Link>

      <div className="mt-5 max-w-3xl">
        <p className="dw-label">
          Official content · Version {manifest.version}
        </p>
        <h1 className="dw-page-title mt-2">{manifest.title}</h1>
        <p className="dw-support mt-3">{manifest.description}</p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Pack size
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {manifest.entries.length}
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Available to import
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">
            {availableCount}
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Content review
          </p>
          <p className="mt-2 text-lg font-semibold">Approved</p>
          <p className="mt-1 text-xs text-neutral-500">
            {manifest.reviewedAt.slice(0, 10)}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <StarterPackImport
          canCreateCollection={auth.accessLevel === 'full_access'}
          collections={context.collections}
          entries={entries}
          packTitle={manifest.title}
        />
      </div>
    </section>
  )
}

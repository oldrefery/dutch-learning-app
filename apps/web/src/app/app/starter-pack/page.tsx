import Link from 'next/link'
import { StarterPackImport } from '@/features/starter-pack/StarterPackImport'
import { getStarterPackContext } from '@/features/starter-pack/repository'
import {
  getOfficialContentCatalog,
  loadRemoteOfficialStarterPack,
} from '@/features/starter-pack/official-content-repository'
import {
  buildStarterPackPreview,
  loadOfficialStarterPack,
} from '@/features/starter-pack/starter-pack-domain'
import { requireAuthContext } from '@/lib/auth/session'

interface StarterPackPageProps {
  searchParams: Promise<{ pack?: string }>
}

export default async function StarterPackPage({
  searchParams,
}: StarterPackPageProps) {
  const auth = await requireAuthContext()
  const [{ pack: requestedPackId }, catalog, context] = await Promise.all([
    searchParams,
    getOfficialContentCatalog(),
    getStarterPackContext(auth.userId),
  ])
  const selectedCatalogItem = catalog.find(
    item => item.packId === requestedPackId
  )
  const manifest = selectedCatalogItem
    ? await loadRemoteOfficialStarterPack(
        selectedCatalogItem.packId,
        selectedCatalogItem.version
      )
    : loadOfficialStarterPack()
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

      {catalog.length > 0 && (
        <nav aria-label="Official content packs" className="mt-6">
          <p className="dw-label">Choose an official pack</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              aria-current={!selectedCatalogItem ? 'page' : undefined}
              className={`rounded-xl border px-4 py-2 text-sm font-medium ${
                !selectedCatalogItem
                  ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200'
                  : 'border-neutral-300 dark:border-neutral-700'
              }`}
              href="/app/starter-pack"
            >
              A1 Essentials · Offline
            </Link>
            {catalog.map(item => (
              <Link
                aria-current={
                  selectedCatalogItem?.packId === item.packId
                    ? 'page'
                    : undefined
                }
                className={`rounded-xl border px-4 py-2 text-sm font-medium ${
                  selectedCatalogItem?.packId === item.packId
                    ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200'
                    : 'border-neutral-300 dark:border-neutral-700'
                }`}
                href={`/app/starter-pack?pack=${encodeURIComponent(item.packId)}`}
                key={item.packId}
              >
                {item.cefrLevel} · {item.title}
              </Link>
            ))}
          </div>
        </nav>
      )}

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
          packId={manifest.packId}
          packTitle={manifest.title}
          packVersion={manifest.version}
        />
      </div>
    </section>
  )
}

import Link from 'next/link'
import type { OfficialContentCatalogItem } from '@woordenaar/content/remote'
import { OfficialPackPicker } from '@/features/starter-pack/OfficialPackPicker'
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
import type { StarterPackManifest } from '@/features/starter-pack/starter-pack-domain'
import { requireAuthContext } from '@/lib/auth/session'

interface StarterPackPageProps {
  searchParams: Promise<{ pack?: string }>
}

interface CatalogResult {
  catalog: OfficialContentCatalogItem[]
  unavailable: boolean
}

const loadCatalog = async (): Promise<CatalogResult> => {
  try {
    return { catalog: await getOfficialContentCatalog(), unavailable: false }
  } catch {
    return { catalog: [], unavailable: true }
  }
}

function CollectionBackLink() {
  return (
    <Link
      className="text-sm text-neutral-600 hover:underline dark:text-neutral-400"
      href="/app/collections"
    >
      ← All collections
    </Link>
  )
}

function UnavailablePack({
  message,
  retryHref,
}: {
  message: string
  retryHref?: string
}) {
  return (
    <section>
      <CollectionBackLink />
      <div className="dw-surface mt-5 max-w-3xl p-6">
        <p className="dw-label">Official content</p>
        <h1 className="dw-page-title mt-2">Official pack unavailable</h1>
        <p className="dw-support mt-3">{message}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          {retryHref && (
            <Link className="dw-button dw-button--primary" href={retryHref}>
              Try again
            </Link>
          )}
          <Link
            className="dw-button dw-button--secondary"
            href="/app/starter-pack"
          >
            Use A1 Essentials
          </Link>
        </div>
      </div>
    </section>
  )
}

export default async function StarterPackPage({
  searchParams,
}: StarterPackPageProps) {
  const auth = await requireAuthContext()
  const [{ pack: requestedPackId }, catalogResult, context] = await Promise.all(
    [searchParams, loadCatalog(), getStarterPackContext(auth.userId)]
  )
  const { catalog, unavailable: catalogUnavailable } = catalogResult
  const selectedCatalogItem = catalog.find(
    item => item.packId === requestedPackId
  )

  if (requestedPackId && catalogUnavailable) {
    return (
      <UnavailablePack
        message="The online catalog could not be loaded. A1 Essentials is still available offline."
        retryHref={`/app/starter-pack?pack=${encodeURIComponent(requestedPackId)}`}
      />
    )
  }

  if (requestedPackId && !selectedCatalogItem) {
    return (
      <UnavailablePack message="The requested official pack could not be found. Choose another pack from the catalog." />
    )
  }

  let manifest: StarterPackManifest
  if (selectedCatalogItem) {
    try {
      manifest = await loadRemoteOfficialStarterPack(
        selectedCatalogItem.packId,
        selectedCatalogItem.version
      )
    } catch {
      return (
        <UnavailablePack
          message="This official pack version is temporarily unavailable. Try again or continue with A1 Essentials."
          retryHref={`/app/starter-pack?pack=${encodeURIComponent(selectedCatalogItem.packId)}`}
        />
      )
    }
  } else {
    manifest = loadOfficialStarterPack()
  }
  const entries = buildStarterPackPreview(manifest, context.existingWords)
  const availableCount = entries.filter(entry => !entry.isDuplicate).length

  return (
    <section>
      <CollectionBackLink />

      {catalogUnavailable && (
        <div
          className="mt-5 border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200"
          role="status"
        >
          The online catalog is temporarily unavailable. A1 Essentials remains
          available offline.
        </div>
      )}

      <div className="mt-5 max-w-3xl">
        <p className="dw-label">
          Official content · Version {manifest.version}
        </p>
        <h1 className="dw-page-title mt-2">{manifest.title}</h1>
        <p className="dw-support mt-3">{manifest.description}</p>
      </div>

      {catalog.length > 0 && (
        <OfficialPackPicker
          catalog={catalog}
          selectedPackId={selectedCatalogItem?.packId}
        />
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
          key={`${manifest.packId}@${manifest.version}`}
          packId={manifest.packId}
          packTitle={manifest.title}
          packVersion={manifest.version}
        />
      </div>
    </section>
  )
}

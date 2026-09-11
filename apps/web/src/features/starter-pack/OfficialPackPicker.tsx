'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { OfficialContentCatalogItem } from '@woordenaar/content/remote'

interface OfficialPackPickerProps {
  catalog: OfficialContentCatalogItem[]
  selectedPackId?: string
}

const ESSENTIALS_PATH = '/app/starter-pack'

export const formatOfficialPackLabel = (
  item: OfficialContentCatalogItem
): string => {
  const redundantPrefix = new RegExp(
    `^Dutch\\s+${item.cefrLevel}\\s*(?:[·:—-]\\s*)?`,
    'i'
  )
  const conciseTitle = item.title.replace(redundantPrefix, '').trim()
  const wordLabel = item.entryCount === 1 ? 'word' : 'words'

  return `${item.cefrLevel} · ${conciseTitle || item.title} · ${item.entryCount} ${wordLabel}`
}

const getPackPath = (packId: string): string =>
  `${ESSENTIALS_PATH}?pack=${encodeURIComponent(packId)}`

export function OfficialPackPicker({
  catalog,
  selectedPackId,
}: OfficialPackPickerProps) {
  const router = useRouter()
  const selectedPath = selectedPackId
    ? getPackPath(selectedPackId)
    : ESSENTIALS_PATH

  return (
    <nav aria-label="Official content packs" className="mt-6">
      <p className="dw-label">Choose an official pack</p>

      <div className="mt-3 md:hidden">
        <label className="dw-sr-only" htmlFor="official-pack-picker">
          Official content pack
        </label>
        <select
          className="w-full border border-neutral-300 bg-white px-4 py-3 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          id="official-pack-picker"
          onChange={event => router.push(event.target.value)}
          value={selectedPath}
        >
          <option value={ESSENTIALS_PATH}>A1 Essentials · Offline</option>
          {catalog.map(item => (
            <option key={item.packId} value={getPackPath(item.packId)}>
              {formatOfficialPackLabel(item)}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 hidden gap-2 md:grid md:grid-cols-2 xl:grid-cols-3">
        <Link
          aria-current={!selectedPackId ? 'page' : undefined}
          className={`border px-4 py-3 text-sm font-medium ${
            !selectedPackId
              ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200'
              : 'border-neutral-300 dark:border-neutral-700'
          }`}
          href={ESSENTIALS_PATH}
        >
          A1 Essentials · Offline
        </Link>
        {catalog.map(item => (
          <Link
            aria-current={selectedPackId === item.packId ? 'page' : undefined}
            className={`border px-4 py-3 text-sm font-medium ${
              selectedPackId === item.packId
                ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200'
                : 'border-neutral-300 dark:border-neutral-700'
            }`}
            href={getPackPath(item.packId)}
            key={item.packId}
          >
            {formatOfficialPackLabel(item)}
          </Link>
        ))}
      </div>
    </nav>
  )
}

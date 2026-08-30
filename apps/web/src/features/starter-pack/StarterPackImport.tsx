'use client'

import Link from 'next/link'
import { useActionState, useMemo, useState } from 'react'
import { importStarterPack } from './actions'
import { INITIAL_STARTER_PACK_IMPORT_STATE } from './form-state'
import type { StarterPackTargetCollection } from './repository'
import {
  NEW_STARTER_PACK_COLLECTION_ID,
  type StarterPackPreviewEntry,
} from './starter-pack-domain'

interface StarterPackImportProps {
  canCreateCollection: boolean
  collections: StarterPackTargetCollection[]
  entries: StarterPackPreviewEntry[]
  packTitle: string
}

export function StarterPackImport({
  canCreateCollection,
  collections,
  entries,
  packTitle,
}: StarterPackImportProps) {
  const availableEntryIds = useMemo(
    () =>
      entries.filter(item => !item.isDuplicate).map(item => item.entry.entryId),
    [entries]
  )
  const [selectedEntryIds, setSelectedEntryIds] = useState(
    () => new Set(availableEntryIds)
  )
  const [hideDuplicates, setHideDuplicates] = useState(true)
  const [targetCollectionId, setTargetCollectionId] = useState(
    canCreateCollection
      ? NEW_STARTER_PACK_COLLECTION_ID
      : (collections[0]?.id ?? '')
  )
  const [state, action, pending] = useActionState(
    importStarterPack,
    INITIAL_STARTER_PACK_IMPORT_STATE
  )

  const visibleEntries = hideDuplicates
    ? entries.filter(item => !item.isDuplicate)
    : entries
  const duplicateCount = entries.length - availableEntryIds.length
  const allAvailableSelected = availableEntryIds.every(entryId =>
    selectedEntryIds.has(entryId)
  )

  const toggleEntry = (entryId: string) => {
    setSelectedEntryIds(previous => {
      const next = new Set(previous)
      if (next.has(entryId)) next.delete(entryId)
      else next.add(entryId)
      return next
    })
  }

  const toggleAllAvailable = () => {
    setSelectedEntryIds(
      allAvailableSelected ? new Set() : new Set(availableEntryIds)
    )
  }

  if (state.status === 'success' && state.collectionId) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/40">
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
          Starter pack imported
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">
          {state.importedCount} new{' '}
          {state.importedCount === 1 ? 'word is' : 'words are'} ready
        </h2>
        <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">
          {state.message}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-950"
            href={`/app/review?scope=collection-due&collectionId=${state.collectionId}`}
          >
            Start review
          </Link>
          <Link
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700"
            href={`/app/collections/${state.collectionId}`}
          >
            Open {state.collectionName}
          </Link>
        </div>
      </div>
    )
  }

  const hasTarget = canCreateCollection || collections.length > 0

  return (
    <form action={action}>
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <label className="text-sm font-medium" htmlFor="starter-target">
              Target collection
            </label>
            <select
              className="mt-2 w-full rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-sm outline-none focus:border-neutral-600 dark:border-neutral-700 dark:focus:border-neutral-400"
              disabled={!hasTarget || pending}
              id="starter-target"
              name="targetCollectionId"
              onChange={event => setTargetCollectionId(event.target.value)}
              required
              value={targetCollectionId}
            >
              {canCreateCollection && (
                <option value={NEW_STARTER_PACK_COLLECTION_ID}>
                  Create “{packTitle}”
                </option>
              )}
              {collections.map(collection => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>
            {!hasTarget && (
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                This read-only account needs an existing collection before it
                can import the starter pack.
              </p>
            )}
          </div>
          <button
            className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-950"
            disabled={!hasTarget || selectedEntryIds.size === 0 || pending}
            type="submit"
          >
            {pending
              ? 'Importing…'
              : `Import ${selectedEntryIds.size} ${selectedEntryIds.size === 1 ? 'word' : 'words'}`}
          </button>
        </div>

        {state.message && (
          <p
            className="mt-3 text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {state.message}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {selectedEntryIds.size} selected · {duplicateCount} already in your
          collections
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700"
            onClick={toggleAllAvailable}
            type="button"
          >
            {allAvailableSelected ? 'Clear selection' : 'Select available'}
          </button>
          {duplicateCount > 0 && (
            <button
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700"
              onClick={() => setHideDuplicates(previous => !previous)}
              type="button"
            >
              {hideDuplicates ? 'Show duplicates' : 'Hide duplicates'}
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {visibleEntries.map(item => {
          const { entry } = item
          const translation = entry.translations.en.join(', ')
          const inputId = `starter-entry-${entry.entryId}`

          return (
            <label
              className={`flex gap-3 rounded-2xl border p-4 ${
                item.isDuplicate
                  ? 'border-neutral-200 bg-neutral-100 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-500'
                  : 'cursor-pointer border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900'
              }`}
              htmlFor={inputId}
              key={entry.entryId}
            >
              <input
                checked={selectedEntryIds.has(entry.entryId)}
                className="mt-1 size-4 accent-neutral-900 dark:accent-neutral-100"
                disabled={item.isDuplicate || pending}
                id={inputId}
                name="entryIds"
                onChange={() => toggleEntry(entry.entryId)}
                type="checkbox"
                value={entry.entryId}
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold">
                    {entry.article ? `${entry.article} ` : ''}
                    {entry.dutchLemma}
                  </span>
                  <span className="text-xs uppercase tracking-wide text-neutral-500">
                    {entry.partOfSpeech}
                  </span>
                </span>
                <span className="mt-1 block text-sm text-neutral-600 dark:text-neutral-400">
                  {translation}
                </span>
                {item.isDuplicate && (
                  <span className="mt-2 block text-xs font-medium">
                    Already exists
                    {item.duplicateCollectionName
                      ? ` in ${item.duplicateCollectionName}`
                      : ''}
                  </span>
                )}
              </span>
            </label>
          )
        })}
      </div>
    </form>
  )
}

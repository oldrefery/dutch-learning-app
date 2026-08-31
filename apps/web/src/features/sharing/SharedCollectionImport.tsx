'use client'

import Link from 'next/link'
import { useActionState, useMemo, useState } from 'react'
import { importSharedCollection } from './actions'
import { INITIAL_SHARED_COLLECTION_IMPORT_STATE } from './form-state'
import type { SharedCollectionPreviewWord } from './shared-collection-domain'
import type { SharedTargetCollection } from './repository'

interface SharedCollectionImportProps {
  collectionName: string
  collections: SharedTargetCollection[]
  shareToken: string
  words: SharedCollectionPreviewWord[]
}

export function SharedCollectionImport({
  collectionName,
  collections,
  shareToken,
  words,
}: SharedCollectionImportProps) {
  const availableWordIds = useMemo(
    () => words.filter(word => !word.isDuplicate).map(word => word.id),
    [words]
  )
  const [selectedWordIds, setSelectedWordIds] = useState(
    () => new Set(availableWordIds)
  )
  const [hideDuplicates, setHideDuplicates] = useState(true)
  const [targetCollectionId, setTargetCollectionId] = useState(
    collections[0]?.id ?? ''
  )
  const action = importSharedCollection.bind(null, shareToken)
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_SHARED_COLLECTION_IMPORT_STATE
  )

  if (state.status === 'success' && state.collectionId) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900 dark:bg-emerald-950/40">
        <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
          Shared collection imported
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

  const duplicateCount = words.length - availableWordIds.length
  const visibleWords = hideDuplicates
    ? words.filter(word => !word.isDuplicate)
    : words
  const allAvailableSelected = availableWordIds.every(wordId =>
    selectedWordIds.has(wordId)
  )
  const hasTargetCollection = collections.length > 0

  const toggleWord = (wordId: string) => {
    setSelectedWordIds(previous => {
      const next = new Set(previous)
      if (next.has(wordId)) next.delete(wordId)
      else next.add(wordId)
      return next
    })
  }

  const toggleAllAvailable = () => {
    setSelectedWordIds(
      allAvailableSelected ? new Set() : new Set(availableWordIds)
    )
  }

  return (
    <form action={formAction}>
      <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div>
            <label className="text-sm font-medium" htmlFor="shared-target">
              Import into
            </label>
            <select
              className="mt-2 w-full rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-sm outline-none focus:border-neutral-600 dark:border-neutral-700 dark:focus:border-neutral-400"
              disabled={!hasTargetCollection || pending}
              id="shared-target"
              name="targetCollectionId"
              onChange={event => setTargetCollectionId(event.target.value)}
              required
              value={targetCollectionId}
            >
              {collections.map(collection => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>
            {!hasTargetCollection && (
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                You need an existing collection before importing.{' '}
                <Link className="underline" href="/app/collections">
                  Open collections
                </Link>
                .
              </p>
            )}
          </div>
          <button
            className="rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-950"
            disabled={
              !hasTargetCollection || selectedWordIds.size === 0 || pending
            }
            type="submit"
          >
            {pending
              ? 'Importing…'
              : `Import ${selectedWordIds.size} ${selectedWordIds.size === 1 ? 'word' : 'words'}`}
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
          {selectedWordIds.size} selected · {duplicateCount} already in your
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
        {visibleWords.map(word => {
          const inputId = `shared-word-${word.id}`
          return (
            <label
              className={`flex gap-3 rounded-2xl border p-4 ${
                word.isDuplicate
                  ? 'border-neutral-200 bg-neutral-100 text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900/50 dark:text-neutral-500'
                  : 'cursor-pointer border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900'
              }`}
              htmlFor={inputId}
              key={word.id}
            >
              <input
                checked={selectedWordIds.has(word.id)}
                className="mt-1 size-4 accent-neutral-900 dark:accent-neutral-100"
                disabled={word.isDuplicate || pending}
                id={inputId}
                name="wordIds"
                onChange={() => toggleWord(word.id)}
                type="checkbox"
                value={word.id}
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold">
                    {word.article ? `${word.article} ` : ''}
                    {word.dutchLemma}
                  </span>
                  <span className="text-xs uppercase tracking-wide text-neutral-500">
                    {word.partOfSpeech ?? 'unknown'}
                  </span>
                </span>
                <span className="mt-1 block text-sm text-neutral-600 dark:text-neutral-400">
                  {word.translation}
                </span>
                {word.isDuplicate && (
                  <span className="mt-2 block text-xs font-medium">
                    Already exists
                    {word.duplicateCollectionName
                      ? ` in ${word.duplicateCollectionName}`
                      : ''}
                  </span>
                )}
              </span>
            </label>
          )
        })}
      </div>

      {words.length === 0 && (
        <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          “{collectionName}” does not contain any active words yet.
        </div>
      )}
    </form>
  )
}

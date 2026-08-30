'use client'

import { useMemo, useState } from 'react'
import { filterCollectionWords } from './collection-detail'
import type { CollectionWordListItem } from './collection-detail'

const WordStatus = ({ word }: { word: CollectionWordListItem }) => {
  if (word.isMastered) {
    return (
      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
        Mastered
      </span>
    )
  }

  if (word.isDue) {
    return (
      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        Due
      </span>
    )
  }

  return null
}

export function CollectionWordList({
  words,
}: {
  words: CollectionWordListItem[]
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const filteredWords = useMemo(
    () => filterCollectionWords(words, searchQuery),
    [searchQuery, words]
  )

  return (
    <div>
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <label className="sr-only" htmlFor="collection-word-search">
          Search Dutch words
        </label>
        <input
          className="w-full rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-sm outline-none focus:border-neutral-600 dark:border-neutral-700 dark:focus:border-neutral-400"
          id="collection-word-search"
          onChange={event => setSearchQuery(event.target.value)}
          placeholder="Search Dutch words…"
          type="search"
          value={searchQuery}
        />
        {searchQuery.trim() && (
          <p aria-live="polite" className="mt-2 text-xs text-neutral-500">
            {filteredWords.length} of {words.length} words
          </p>
        )}
      </div>

      {filteredWords.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 px-6 py-12 text-center dark:border-neutral-700">
          <h2 className="text-lg font-semibold">
            {words.length === 0 ? 'No words in this collection' : 'No matches'}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600 dark:text-neutral-400">
            {words.length === 0
              ? 'Add words from the web analysis flow when it becomes available in the next Phase 3 slice.'
              : `No Dutch words match “${searchQuery.trim()}”.`}
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {filteredWords.map(word => (
            <article
              className="flex items-start justify-between gap-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900"
              key={word.id}
            >
              <div className="min-w-0">
                <h3 className="truncate text-lg font-semibold">
                  {[word.article, word.dutchLemma].filter(Boolean).join(' ')}
                </h3>
                <p className="mt-1 truncate text-sm text-neutral-600 dark:text-neutral-400">
                  {word.translation}
                </p>
                <p className="mt-2 text-xs text-neutral-500">
                  {word.partOfSpeech ?? 'Unknown type'} · interval{' '}
                  {word.intervalDays}d · {word.repetitionCount} repetitions
                </p>
              </div>
              <WordStatus word={word} />
            </article>
          ))}
        </div>
      )}
    </div>
  )
}

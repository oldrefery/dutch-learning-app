'use client'

import Link from 'next/link'
import { Ellipsis, Play, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { filterCollectionWords } from './collection-detail'
import type { CollectionWordListItem } from './collection-detail'
import styles from './CollectionDetail.module.css'

type StatusFilter = 'all' | 'due' | 'difficult' | 'mastered'

const STATUS_OPTIONS: readonly { label: string; value: StatusFilter }[] = [
  { value: 'all', label: 'All' },
  { value: 'due', label: 'Due' },
  { value: 'difficult', label: 'Difficult' },
  { value: 'mastered', label: 'Mastered' },
]

function WordStatus({ word }: { word: CollectionWordListItem }) {
  if (word.isDifficult) return <Badge tone="warning">Difficult</Badge>
  if (word.isDue) return <Badge tone="warning">Due today</Badge>
  if (word.isMastered) return <Badge tone="success">Established</Badge>
  if (word.repetitionCount === 0) return <Badge>New</Badge>
  return <Badge>Short · {word.intervalDays} d</Badge>
}

const getStatusCount = (
  words: CollectionWordListItem[],
  status: StatusFilter
) =>
  status === 'all'
    ? words.length
    : words.filter(word =>
        status === 'due'
          ? word.isDue
          : status === 'difficult'
            ? word.isDifficult
            : word.isMastered
      ).length

function formatNextReview(word: CollectionWordListItem) {
  if (word.isDue) return 'Today'
  const parsed = new Date(word.nextReviewDate)
  if (Number.isNaN(parsed.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
    .format(parsed)
    .toUpperCase()
}

export function CollectionWordList({
  collectionId,
  words,
}: {
  collectionId: string
  words: CollectionWordListItem[]
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [partOfSpeech, setPartOfSpeech] = useState('all')
  const partOfSpeechOptions = useMemo(
    () =>
      [
        ...new Set(words.map(word => word.partOfSpeech).filter(Boolean)),
      ].sort() as string[],
    [words]
  )
  const filteredWords = useMemo(
    () => filterCollectionWords(words, searchQuery, status, partOfSpeech),
    [partOfSpeech, searchQuery, status, words]
  )

  const playWord = (word: CollectionWordListItem) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(word.dutchLemma)
    utterance.lang = 'nl-NL'
    window.speechSynthesis.speak(utterance)
  }

  return (
    <div>
      <div className={styles.filterBar}>
        <label className={styles.search}>
          <Search aria-hidden="true" size={16} />
          <span className="dw-sr-only">Search Dutch lemma or translation</span>
          <input
            onChange={event => setSearchQuery(event.target.value)}
            placeholder="Search Dutch lemma"
            type="search"
            value={searchQuery}
          />
        </label>

        <div aria-label="Word status" className={styles.segments} role="group">
          {STATUS_OPTIONS.map(option => (
            <button
              aria-pressed={status === option.value}
              className={styles.segment}
              key={option.value}
              onClick={() => setStatus(option.value)}
              type="button"
            >
              {option.label} {getStatusCount(words, option.value)}
            </button>
          ))}
        </div>

        <select
          aria-label="Part of speech"
          className={styles.select}
          onChange={event => setPartOfSpeech(event.target.value)}
          value={partOfSpeech}
        >
          <option value="all">Part of speech</option>
          {partOfSpeechOptions.map(option => (
            <option key={option} value={option}>
              {option[0].toUpperCase() + option.slice(1)}
            </option>
          ))}
        </select>

        <span aria-live="polite" className={styles.showing}>
          Showing {filteredWords.length} of {words.length}
        </span>
      </div>

      {filteredWords.length === 0 ? (
        <div className={styles.empty}>
          <h2>
            {words.length === 0 ? 'No words in this collection' : 'No matches'}
          </h2>
          <p className="dw-support">
            {words.length === 0
              ? 'Use Add word to analyse Dutch vocabulary and save it here.'
              : 'Try a different search or clear one of the filters.'}
          </p>
        </div>
      ) : (
        <div className={styles.table}>
          <div className={`${styles.row} ${styles.headerRow}`}>
            <span>Word</span>
            <span>Translation</span>
            <span>Type</span>
            <span>Status</span>
            <span>Next</span>
            <span />
          </div>

          {filteredWords.map(word => {
            const detailsHref = `/app/collections/${collectionId}/words/${word.id}`
            return (
              <article className={styles.row} key={word.id}>
                <Link className={styles.word} href={detailsHref}>
                  {word.article && (
                    <span className={styles.article}>{word.article} </span>
                  )}
                  {word.dutchLemma}
                </Link>
                <span className={styles.translation}>{word.translation}</span>
                <span className={styles.meta}>
                  {word.partOfSpeech ?? 'Unknown'}
                </span>
                <span>
                  <WordStatus word={word} />
                </span>
                <span
                  className={`${styles.meta} ${word.isDue ? styles.due : ''}`}
                >
                  {formatNextReview(word)}
                </span>
                <span className={styles.rowActions}>
                  <button
                    aria-label={`Play ${word.dutchLemma}`}
                    className="dw-icon-button"
                    onClick={() => playWord(word)}
                    type="button"
                  >
                    <Play aria-hidden="true" size={15} />
                  </button>
                  <Link
                    aria-label={`Open ${word.dutchLemma}`}
                    href={detailsHref}
                  >
                    <Ellipsis aria-hidden="true" size={18} />
                  </Link>
                </span>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

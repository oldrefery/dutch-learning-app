'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { TransferPreviewWord } from './dictionary-transfer-contract'
import styles from './DictionaryTransfer.module.css'

const PAGE_SIZE = 50

export function DictionaryDocumentPreview({
  words,
  selected,
  disabled,
  onToggle,
  onSelectAll,
}: {
  words: TransferPreviewWord[]
  selected: Set<number>
  disabled: boolean
  onToggle: (index: number) => void
  onSelectAll: (select: boolean) => void
}) {
  const [page, setPage] = useState(0)
  const available = words.filter(word => !word.duplicate).length
  const pageCount = Math.max(1, Math.ceil(words.length / PAGE_SIZE))
  return (
    <div>
      <div className={styles.actions}>
        <p>
          {available} available · {words.length - available} already added ·{' '}
          {selected.size} selected
        </p>
        <Button
          disabled={disabled || available === 0}
          onClick={() => onSelectAll(selected.size !== available)}
          type="button"
          variant="secondary"
        >
          {selected.size === available
            ? 'Deselect all'
            : 'Select all available'}
        </Button>
      </div>
      <ul aria-label="Import preview" className={styles.words}>
        {words.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(word => (
          <li className={styles.word} key={word.index}>
            <input
              checked={selected.has(word.index)}
              disabled={disabled || word.duplicate}
              id={`document-word-${word.index}`}
              onChange={() => onToggle(word.index)}
              type="checkbox"
            />
            <label htmlFor={`document-word-${word.index}`}>
              <strong>{word.lemma}</strong>
              <span className="dw-support">{word.translation}</span>
              {word.duplicate && (
                <span className="dw-support">
                  Already added
                  {word.duplicateCollection
                    ? ` in ${word.duplicateCollection}`
                    : ''}
                </span>
              )}
            </label>
          </li>
        ))}
      </ul>
      {pageCount > 1 && (
        <nav aria-label="Preview pages" className={styles.pagination}>
          <Button
            disabled={disabled || page === 0}
            onClick={() => setPage(page - 1)}
            type="button"
            variant="secondary"
          >
            Previous
          </Button>
          <span>
            Page {page + 1} of {pageCount}
          </span>
          <Button
            disabled={disabled || page + 1 === pageCount}
            onClick={() => setPage(page + 1)}
            type="button"
            variant="secondary"
          >
            Next
          </Button>
        </nav>
      )}
    </div>
  )
}

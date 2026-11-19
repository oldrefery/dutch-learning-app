'use client'

import {
  BATCH_CAPTURE_MAX_ITEMS,
  parseBatchCaptureInput,
} from '@woordenaar/domain'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { CollectionOption } from '@/features/words/repository'
import styles from './BatchCapture.module.css'

interface BatchCaptureComposerProps {
  collections: CollectionOption[]
  defaultCollectionId: string
  onCreateQueue: (
    items: ReturnType<typeof parseBatchCaptureInput>['items'],
    targetCollectionId: string,
    autoSave: boolean
  ) => void
}

export function BatchCaptureComposer({
  collections,
  defaultCollectionId,
  onCreateQueue,
}: BatchCaptureComposerProps) {
  const [autoSave, setAutoSave] = useState(false)
  const [rawInput, setRawInput] = useState('')
  const [targetCollectionId, setTargetCollectionId] =
    useState(defaultCollectionId)
  const parsed = useMemo(() => parseBatchCaptureInput(rawInput), [rawInput])
  const disabled =
    parsed.items.length === 0 ||
    parsed.hasBlockingIssues ||
    targetCollectionId === ''

  return (
    <div className={styles.composer}>
      <h2 className="text-xl font-semibold tracking-tight">
        Capture a word list
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600 dark:text-neutral-400">
        Enter one Dutch word or expression per line. Add an optional, unverified
        translation hint after a semicolon. Review the whole list and save it in
        one step, or save ready words automatically.
      </p>

      <label className={styles.fieldLabel} htmlFor="batch-input">
        Dutch words
      </label>
      <textarea
        autoCapitalize="none"
        autoComplete="off"
        id="batch-input"
        onChange={event => setRawInput(event.target.value)}
        placeholder={'huis ; house\nopstaan ; to get up\nhoe gaat het'}
        spellCheck={false}
        value={rawInput}
      />

      <label className="mt-3 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={autoSave}
          onChange={event => setAutoSave(event.target.checked)}
        />
        Automatically save ready words to the target collection
      </label>

      <div className={styles.composerFooter}>
        <div>
          <label className="text-sm font-medium" htmlFor="batch-collection">
            Target collection
          </label>
          <select
            id="batch-collection"
            onChange={event => setTargetCollectionId(event.target.value)}
            value={targetCollectionId}
          >
            {collections.map(collection => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          disabled={disabled}
          onClick={() =>
            onCreateQueue(parsed.items, targetCollectionId, autoSave)
          }
          type="button"
        >
          {autoSave ? 'Analyze and save' : 'Analyze'} {parsed.items.length}{' '}
          words
        </Button>
      </div>

      <p className={styles.counters}>
        <span>{parsed.items.length} valid</span>
        <span>{parsed.issues.length} unrecognized</span>
        <span>
          {rawInput ? rawInput.split(/\r?\n/).length : 0} /{' '}
          {BATCH_CAPTURE_MAX_ITEMS} lines
        </span>
      </p>
      {parsed.issues.length > 0 && (
        <ul className={styles.issues} aria-label="Batch input issues">
          {parsed.issues.map(issue => (
            <li key={`${issue.line}-${issue.code}`}>
              Line {issue.line}: {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

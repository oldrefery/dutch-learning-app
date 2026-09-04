'use client'

import { Button } from '@/components/ui/Button'
import type { CollectionOption } from '@/features/words/repository'
import styles from './BatchCapture.module.css'
import { isWebBatchCaptureFinished } from './batch-capture-domain'
import type { WebBatchCaptureItem } from './types'

const STATUS_LABELS: Record<WebBatchCaptureItem['status'], string> = {
  queued: 'Queued',
  checking_duplicate: 'Checking duplicate',
  possible_duplicate: 'Possible duplicate',
  analyzing: 'Analyzing',
  awaiting_review: 'Awaiting review',
  failed: 'Failed',
  completed: 'Completed · saved',
  skipped: 'Skipped',
  cancelled: 'Cancelled',
}

const STATUS_GLYPHS: Record<WebBatchCaptureItem['status'], string> = {
  queued: '·',
  checking_duplicate: '◴',
  possible_duplicate: '!',
  analyzing: '◴',
  awaiting_review: '!',
  failed: '×',
  completed: '✓',
  skipped: '–',
  cancelled: '×',
}

const statusClassName = (status: WebBatchCaptureItem['status']) => {
  if (status === 'completed') return styles.stateSuccess
  if (status === 'failed') return styles.stateError
  if (status === 'possible_duplicate' || status === 'awaiting_review') {
    return styles.stateWarning
  }
  if (status === 'analyzing' || status === 'checking_duplicate') {
    return styles.stateActive
  }
  return styles.stateNeutral
}

interface BatchCaptureQueueProps {
  activeItemId: string | null
  collections: CollectionOption[]
  isPaused: boolean
  items: WebBatchCaptureItem[]
  onAnalyzeDuplicate: (itemId: string) => void
  onCancelRemaining: () => void
  onClear: () => void
  onPause: () => void
  onRetry: (itemId: string) => void
  onSkip: (itemId: string) => void
  onStart: () => void
  onTargetCollectionChange: (collectionId: string) => void
  targetCollectionId: string
}

export function BatchCaptureQueue({
  activeItemId,
  collections,
  isPaused,
  items,
  onAnalyzeDuplicate,
  onCancelRemaining,
  onClear,
  onPause,
  onRetry,
  onSkip,
  onStart,
  onTargetCollectionChange,
  targetCollectionId,
}: BatchCaptureQueueProps) {
  const finished = isWebBatchCaptureFinished(items)
  const completedCount = items.filter(
    item => item.status === 'completed'
  ).length
  const resolvedCount = items.filter(item =>
    ['completed', 'skipped', 'cancelled'].includes(item.status)
  ).length
  const progress = items.length === 0 ? 0 : (resolvedCount / items.length) * 100

  return (
    <div className={styles.queue}>
      <header className={styles.queueHeader}>
        <div className={styles.queueTop}>
          <div>
            <span className="dw-chip">
              {finished ? 'Finished' : isPaused ? 'Paused' : 'Running'}
            </span>
            <h2>Batch queue</h2>
            <p className={styles.summary}>
              {completedCount} saved · {items.length - resolvedCount} remaining
            </p>
          </div>
          <div className={styles.queueActions}>
            {!finished && (
              <Button
                disabled={Boolean(activeItemId)}
                onClick={isPaused ? onStart : onPause}
                type="button"
                variant="secondary"
              >
                {isPaused ? 'Resume' : 'Pause'}
              </Button>
            )}
            <Button
              disabled={Boolean(activeItemId)}
              onClick={finished ? onClear : onCancelRemaining}
              type="button"
              variant="ghost"
            >
              {finished ? 'Clear completed' : 'Cancel all'}
            </Button>
          </div>
        </div>
        <div className={styles.progressRow}>
          <div
            className="dw-progress"
            role="progressbar"
            aria-valuenow={progress}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <span className={styles.summary}>
            {resolvedCount} / {items.length}
          </span>
        </div>
        <label className={styles.target} htmlFor="queue-target">
          Target collection
          <select
            disabled={Boolean(activeItemId)}
            id="queue-target"
            onChange={event => onTargetCollectionChange(event.target.value)}
            value={targetCollectionId}
          >
            {collections.map(collection => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      <div className={styles.table}>
        <div className={`${styles.row} ${styles.rowHeader}`}>
          <span>#</span>
          <span>Entry</span>
          <span>Hint</span>
          <span>State</span>
          <span>Action</span>
        </div>
        {items.map((item, index) => (
          <article className={styles.row} key={item.id}>
            <span className={styles.index}>
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className={styles.entry}>{item.dutchText}</span>
            <span className={styles.hint}>
              {item.translationHint ?? 'No hint'}
            </span>
            <span className={`${styles.state} ${statusClassName(item.status)}`}>
              <span aria-hidden="true">{STATUS_GLYPHS[item.status]}</span>
              {STATUS_LABELS[item.status]}
            </span>
            <span className={styles.itemActions}>
              {item.status === 'possible_duplicate' && (
                <>
                  <Button
                    onClick={() => onAnalyzeDuplicate(item.id)}
                    type="button"
                  >
                    Analyze anyway
                  </Button>
                  <Button
                    onClick={() => onSkip(item.id)}
                    type="button"
                    variant="ghost"
                  >
                    Skip
                  </Button>
                </>
              )}
              {item.status === 'failed' && (
                <>
                  <Button onClick={() => onRetry(item.id)} type="button">
                    Retry
                  </Button>
                  <Button
                    onClick={() => onSkip(item.id)}
                    type="button"
                    variant="ghost"
                  >
                    Skip
                  </Button>
                </>
              )}
              {!['possible_duplicate', 'failed'].includes(item.status) && (
                <span className={styles.summary}>—</span>
              )}
            </span>
            {(item.error || item.duplicate) && (
              <span className={styles.itemMessage}>
                {item.error ??
                  `Already exists${item.duplicate?.collectionName ? ` in ${item.duplicate.collectionName}` : ''}.`}
              </span>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}

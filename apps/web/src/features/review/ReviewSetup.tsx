import Link from 'next/link'
import { Headphones, Play } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { ReviewCollection, ReviewScope, ReviewSessionMode } from './types'
import styles from './Review.module.css'

const MODE_OPTIONS: readonly {
  description: string
  label: string
  value: ReviewSessionMode
}[] = [
  {
    value: 'adaptive',
    label: 'Adaptive',
    description: 'Moves each word between recognition, recall and production.',
  },
  {
    value: 'recognition',
    label: 'Recognition',
    description: 'Choose the correct meaning from four options.',
  },
  {
    value: 'meaning-recall',
    label: 'Meaning recall',
    description: 'See the Dutch word, then recall its meaning.',
  },
  {
    value: 'dutch-production',
    label: 'Dutch production',
    description: 'See a translation and produce the Dutch word.',
  },
]

const SCOPE_OPTIONS: readonly { label: string; value: ReviewScope }[] = [
  { value: 'all-due', label: 'All due' },
  { value: 'collection-due', label: 'One collection' },
  { value: 'difficult-due', label: 'Difficult' },
]

interface ReviewSetupProps {
  adaptiveReviewEnabled: boolean
  collectionId: string | null
  collections: ReviewCollection[]
  dueCount: number
  emptyMessage: string | null
  mode: ReviewSessionMode
  onCollectionChange: (value: string) => void
  onModeChange: (value: ReviewSessionMode) => void
  onScopeChange: (value: ReviewScope) => void
  onStart: () => void
  scope: ReviewScope
}

export function ReviewSetup({
  adaptiveReviewEnabled,
  collectionId,
  collections,
  dueCount,
  emptyMessage,
  mode,
  onCollectionChange,
  onModeChange,
  onScopeChange,
  onStart,
  scope,
}: ReviewSetupProps) {
  const estimateMinutes = Math.max(1, Math.ceil(dueCount * 0.35))

  return (
    <section className={styles.setup}>
      <header className={styles.intro}>
        <p className="dw-label">Learning session</p>
        <h1 className="dw-page-title">Review</h1>
        <p className="dw-support">
          Choose how you want to practise. Your progress stays in sync with the
          mobile app.
        </p>
      </header>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <span className="dw-label">1 · Choose a mode</span>
        </div>
        <div
          aria-label="Review mode"
          className={styles.modeGrid}
          role="radiogroup"
        >
          {MODE_OPTIONS.map(option => {
            const disabled =
              option.value === 'adaptive' && !adaptiveReviewEnabled
            return (
              <button
                aria-checked={mode === option.value}
                className={styles.modeCard}
                disabled={disabled}
                key={option.value}
                onClick={() => onModeChange(option.value)}
                role="radio"
                type="button"
              >
                <span className={styles.modeTop}>
                  <span aria-hidden="true" className={styles.radio} />
                  <span className={styles.modeName}>{option.label}</span>
                  {option.value === 'adaptive' && !disabled && (
                    <Badge className={styles.modeBadge} tone="accent">
                      Recommended
                    </Badge>
                  )}
                  {disabled && (
                    <Badge className={styles.modeBadge}>Needs 10+</Badge>
                  )}
                </span>
                <span className={styles.modeDescription}>
                  {option.description}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <span className="dw-label">2 · Choose a scope</span>
        </div>
        <div
          aria-label="Review scope"
          className={styles.scopeControl}
          role="radiogroup"
        >
          {SCOPE_OPTIONS.map(option => (
            <button
              aria-checked={scope === option.value}
              className={styles.scopeButton}
              key={option.value}
              onClick={() => onScopeChange(option.value)}
              role="radio"
              type="button"
            >
              {option.label}
              <span className={styles.scopeCount}>
                {scope === option.value ? dueCount : '—'} due
              </span>
            </button>
          ))}
        </div>

        {scope === 'collection-due' && (
          <select
            aria-label="Collection"
            className={`dw-field ${styles.collectionSelect}`}
            onChange={event => onCollectionChange(event.target.value)}
            value={collectionId ?? ''}
          >
            <option disabled value="">
              Choose a collection
            </option>
            {collections.map(collection => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {emptyMessage && (
        <p aria-live="polite" className={styles.error}>
          {emptyMessage} <Link href="/app/guide">Read the learning guide</Link>.
        </p>
      )}

      <div className={styles.startRow}>
        <p className={styles.estimate}>
          {dueCount} {dueCount === 1 ? 'word' : 'words'} · about{' '}
          {estimateMinutes} min
        </p>
        <div className={styles.startActions}>
          <Link className={styles.audioLink} href="/app/review/audio">
            <Headphones aria-hidden="true" size={16} /> Audio review
          </Link>
          <Button disabled={dueCount === 0} onClick={onStart} type="button">
            <Play aria-hidden="true" fill="currentColor" size={15} />
            Start · {dueCount}
            <span className="dw-key">Enter</span>
          </Button>
        </div>
      </div>
    </section>
  )
}

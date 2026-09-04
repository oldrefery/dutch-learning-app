import { BarChart3, MoreHorizontal, Plus, Share2 } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { CreateCollectionForm } from '@/features/collections/CreateCollectionForm'
import type { CollectionOverview } from '@/features/collections/collection-overview'
import {
  getReviewStreak,
  listCollectionOverviews,
} from '@/features/collections/repository'
import { requireAuthContext } from '@/lib/auth/session'
import styles from './CollectionsPage.module.css'

function Metric({
  label,
  suffix,
  value,
}: {
  label: string
  suffix?: string
  value: number
}) {
  return (
    <div className={styles.metric}>
      <div className={styles.metricValue}>
        {value}{' '}
        {suffix && <span className={styles.metricSuffix}>{suffix}</span>}
      </div>
      <span className={styles.metricLabel}>{label}</span>
    </div>
  )
}

function CollectionRow({
  collection,
  canEdit,
}: {
  collection: CollectionOverview
  canEdit: boolean
}) {
  const hasWords = collection.totalWords > 0
  const hasDueWords = collection.dueWords > 0

  return (
    <article className={styles.collectionRow}>
      <div>
        <Link
          className={styles.collectionName}
          href={`/app/collections/${collection.id}`}
        >
          {collection.name}
        </Link>
        <span className={styles.collectionMeta}>
          {collection.totalWords} words · {collection.masteredWords} mastered
        </span>
      </div>

      <div className={styles.progress}>
        <div className={styles.progressTrack}>
          <span style={{ width: `${collection.progressPercentage}%` }} />
        </div>
        <span className={styles.progressLabel}>
          {hasWords
            ? `${collection.progressPercentage}% mastered`
            : 'Empty collection'}
        </span>
      </div>

      <div className={styles.states}>
        {hasDueWords ? (
          <Badge tone="warning">◴ {collection.dueWords} due</Badge>
        ) : (
          <span className={styles.emptyDue}>
            {hasWords ? 'Nothing due' : 'Not scheduled yet'}
          </span>
        )}
        {collection.isShared && (
          <Badge tone="accent">
            <Share2 aria-hidden="true" size={12} /> Shared
          </Badge>
        )}
      </div>

      <div />

      <div className={styles.rowActions}>
        {hasDueWords ? (
          <Link
            className={`dw-button dw-button--secondary ${styles.reviewLink}`}
            href={`/app/review?scope=collection-due&collectionId=${collection.id}`}
          >
            Review {collection.dueWords}
          </Link>
        ) : !hasWords && canEdit ? (
          <Link
            className={`dw-button dw-button--primary ${styles.reviewLink}`}
            href={`/app/collections/${collection.id}/words/new`}
          >
            Add first word
          </Link>
        ) : (
          <span className={`dw-button ${styles.disabledButton}`}>Review</span>
        )}
        <Link
          aria-label={`Open ${collection.name}`}
          className={`dw-icon-button ${styles.menuButton}`}
          href={`/app/collections/${collection.id}`}
        >
          <MoreHorizontal aria-hidden="true" size={19} />
        </Link>
      </div>
    </article>
  )
}

export default async function CollectionsPage() {
  const auth = await requireAuthContext()
  const [collections, streak] = await Promise.all([
    listCollectionOverviews(auth.userId),
    getReviewStreak(auth.userId),
  ])
  const totals = collections.reduce(
    (result, collection) => ({
      words: result.words + collection.totalWords,
      mastered: result.mastered + collection.masteredWords,
      due: result.due + collection.dueWords,
      difficult: result.difficult + collection.difficultWords,
    }),
    { words: 0, mastered: 0, due: 0, difficult: 0 }
  )
  const masteredPercentage =
    totals.words === 0 ? 0 : Math.round((totals.mastered / totals.words) * 100)
  const canEdit = auth.accessLevel === 'full_access'

  return (
    <section className={styles.page}>
      <div className={styles.intro}>
        <div className={styles.introCopy}>
          <p className={styles.eyebrow}>
            {collections.length} collections · {totals.words} words
          </p>
          <h1 className="dw-page-title">Collections</h1>
          <p className={styles.description}>
            See what needs attention today and continue from the collection that
            matters most.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link
            className="dw-button dw-button--secondary"
            href="/app/starter-pack"
          >
            Starter pack
          </Link>
          {canEdit && (
            <details className={styles.creator}>
              <summary className="dw-button dw-button--secondary">
                <Plus aria-hidden="true" size={16} />
                New collection
              </summary>
              <div className={styles.creatorPanel}>
                <CreateCollectionForm />
              </div>
            </details>
          )}
        </div>
      </div>

      <div className={styles.metricsBand}>
        <Metric label="Total words" value={totals.words} />
        <Metric
          label="Mastered"
          suffix={`${masteredPercentage}%`}
          value={totals.mastered}
        />
        <Metric label="Due today" value={totals.due} />
        <Metric label="Difficult" value={totals.difficult} />
        <Metric label="Streak" suffix="days" value={streak} />
        <div className={styles.metricActions}>
          {totals.due > 0 ? (
            <Link
              className={`dw-button dw-button--primary ${styles.reviewButton}`}
              href="/app/review"
            >
              Start review · {totals.due}
            </Link>
          ) : (
            <span
              className={`dw-button ${styles.reviewButton} ${styles.disabledButton}`}
            >
              Nothing due
            </span>
          )}
          <Link
            aria-label="Open insights"
            className="dw-icon-button"
            href="/app/insights"
          >
            <BarChart3 aria-hidden="true" size={18} />
          </Link>
        </div>
      </div>

      <div>
        <div className={styles.sectionHeading}>
          <span className="dw-label">Your collections</span>
          <span className={styles.sort}>SORT · DUE FIRST</span>
        </div>

        {collections.length === 0 ? (
          <div className={`${styles.emptyState} mt-3`}>
            <h2>No collections yet</h2>
            <p>
              Create your first collection or import the A1 starter pack to get
              to a reviewable set quickly.
            </p>
          </div>
        ) : (
          <div className={`${styles.collectionList} mt-3`}>
            {[...collections]
              .sort((left, right) => right.dueWords - left.dueWords)
              .map(collection => (
                <CollectionRow
                  canEdit={canEdit}
                  collection={collection}
                  key={collection.id}
                />
              ))}
          </div>
        )}
      </div>

      {!canEdit && (
        <div className="dw-surface p-5">
          <Badge>🔒 Read-only</Badge>
          <p className="dw-support mt-3">
            You can study existing words and import a shared collection.
            Creating and editing collections is not part of your access.
          </p>
        </div>
      )}
    </section>
  )
}

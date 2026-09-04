import { Ellipsis, Plus, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { CollectionWordList } from '@/features/collections/CollectionWordList'
import styles from '@/features/collections/CollectionDetail.module.css'
import { DeleteCollectionForm } from '@/features/collections/DeleteCollectionForm'
import { RenameCollectionForm } from '@/features/collections/RenameCollectionForm'
import { getOwnedCollectionDetail } from '@/features/collections/repository'
import { CollectionSharingPanel } from '@/features/sharing/CollectionSharingPanel'
import { buildSharedCollectionUrl } from '@/features/sharing/shared-collection-domain'
import { requireAuthContext } from '@/lib/auth/session'

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ collectionId: string }>
}) {
  const auth = await requireAuthContext()
  const { collectionId } = await params
  const collection = await getOwnedCollectionDetail(auth.userId, collectionId)

  if (!collection) notFound()

  return (
    <section className={styles.detail}>
      <header className={styles.header}>
        <Link className={styles.breadcrumb} href="/app/collections">
          Collections <span>/</span> <strong>{collection.name}</strong>
        </Link>

        <div className={styles.headingRow}>
          <div>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>{collection.name}</h1>
              {collection.isShared && (
                <Badge tone="accent">⇄ Shared · link active</Badge>
              )}
            </div>
            <div className={styles.stats}>
              <span>{collection.totalWords} words</span>
              <span>
                {collection.masteredWords} mastered ·{' '}
                {collection.progressPercentage}%
              </span>
              <span className={styles.due}>{collection.dueWords} due</span>
            </div>
          </div>

          <div className={styles.actions}>
            {collection.dueWords > 0 ? (
              <Link
                className="dw-button dw-button--primary"
                href={`/app/review?scope=collection-due&collectionId=${collection.id}`}
              >
                <RotateCcw aria-hidden="true" size={16} />
                Review this collection · {collection.dueWords}
              </Link>
            ) : (
              <span className="dw-button">Nothing due</span>
            )}
            {auth.accessLevel === 'full_access' && (
              <Link
                className="dw-button dw-button--secondary"
                href={`/app/collections/${collection.id}/words/new`}
              >
                <Plus aria-hidden="true" size={16} /> Add word
              </Link>
            )}
            <Link
              aria-label="Collection settings"
              className="dw-icon-button"
              href={`/app/collections/${collection.id}#collection-settings`}
            >
              <Ellipsis aria-hidden="true" size={18} />
            </Link>
          </div>
        </div>
      </header>

      <div className={styles.content}>
        <CollectionWordList
          collectionId={collection.id}
          words={collection.words}
        />

        <section className={styles.settings} id="collection-settings">
          <h2>Collection settings</h2>
          <div className={styles.settingsGrid}>
            <CollectionSharingPanel
              collectionId={collection.id}
              initialState={{
                status: 'idle',
                message: null,
                isShared: collection.isShared,
                shareUrl:
                  collection.isShared && collection.shareToken
                    ? buildSharedCollectionUrl(collection.shareToken)
                    : null,
              }}
            />
            {auth.accessLevel === 'full_access' ? (
              <>
                <RenameCollectionForm
                  collectionId={collection.id}
                  currentName={collection.name}
                />
                <DeleteCollectionForm
                  collectionId={collection.id}
                  collectionName={collection.name}
                  totalWords={collection.totalWords}
                />
              </>
            ) : (
              <div className="dw-surface dw-support" style={{ padding: 20 }}>
                This account has read-only access. Renaming and deletion are
                disabled.
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  )
}

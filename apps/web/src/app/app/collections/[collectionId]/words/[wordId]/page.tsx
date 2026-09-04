import Link from 'next/link'
import { notFound } from 'next/navigation'
import { WordDetailCard } from '@/features/words/WordDetailCard'
import { WordImageManager } from '@/features/words/WordImageManager'
import { WordManagementForms } from '@/features/words/WordManagementForms'
import styles from '@/features/words/WordPage.module.css'
import { getOwnedWordPageData } from '@/features/words/repository'
import { requireAuthContext } from '@/lib/auth/session'

export default async function WordDetailPage({
  params,
}: {
  params: Promise<{ collectionId: string; wordId: string }>
}) {
  const auth = await requireAuthContext()
  const { collectionId, wordId } = await params
  const data = await getOwnedWordPageData(auth.userId, collectionId, wordId)

  if (!data) notFound()

  return (
    <section className={styles.page}>
      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <Link href="/app/collections">Collections</Link> <span>/</span>{' '}
        <Link href={`/app/collections/${data.collection.id}`}>
          {data.collection.name}
        </Link>{' '}
        <span>/</span> <strong>{data.word.dutchLemma}</strong>
      </nav>

      <div className={styles.cardWrap}>
        <WordDetailCard headingLevel="h1" word={data.word} />
      </div>

      {data.word.dutchOriginal &&
        data.word.dutchOriginal !== data.word.dutchLemma && (
          <p className={styles.origin}>
            Analysed from · {data.word.dutchOriginal}
          </p>
        )}

      {auth.accessLevel === 'full_access' && (
        <section className={styles.management}>
          <div className={styles.managementTitle}>
            <span className="dw-label">Image</span>
          </div>
          <WordImageManager
            collectionId={data.collection.id}
            word={data.word}
          />
        </section>
      )}

      <section className={styles.management}>
        <div className={styles.managementTitle}>
          <span className="dw-label">Word actions</span>
        </div>
        <div className={styles.managementStack}>
          <WordManagementForms
            canUseAi={auth.accessLevel === 'full_access'}
            collectionId={data.collection.id}
            moveTargets={data.moveTargets}
            wordId={data.word.id}
          />
        </div>
      </section>
    </section>
  )
}

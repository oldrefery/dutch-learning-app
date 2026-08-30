import Link from 'next/link'
import { notFound } from 'next/navigation'
import { WordDetailCard } from '@/features/words/WordDetailCard'
import { WordManagementForms } from '@/features/words/WordManagementForms'
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

  if (!data) {
    notFound()
  }

  const displayWord = [data.word.article, data.word.dutchLemma]
    .filter(Boolean)
    .join(' ')

  return (
    <section>
      <nav
        aria-label="Breadcrumb"
        className="text-sm text-neutral-600 dark:text-neutral-400"
      >
        <Link className="hover:underline" href="/app/collections">
          Collections
        </Link>{' '}
        <span aria-hidden="true">/</span>{' '}
        <Link
          className="hover:underline"
          href={`/app/collections/${data.collection.id}`}
        >
          {data.collection.name}
        </Link>
      </nav>

      <div className="mt-5">
        <p className="text-sm font-medium text-neutral-500">Word details</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {displayWord}
        </h1>
        {data.word.dutchOriginal &&
          data.word.dutchOriginal !== data.word.dutchLemma && (
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Analyzed from: {data.word.dutchOriginal}
            </p>
          )}
      </div>

      <div className="mt-8">
        <WordDetailCard word={data.word} />
      </div>

      <div className="mt-10 border-t border-neutral-200 pt-8 dark:border-neutral-800">
        <h2 className="text-2xl font-semibold tracking-tight">Word actions</h2>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
          These actions update the same Supabase record used by the mobile app.
        </p>
        <div className="mt-4">
          <WordManagementForms
            collectionId={data.collection.id}
            moveTargets={data.moveTargets}
            wordId={data.word.id}
          />
        </div>
      </div>
    </section>
  )
}

import { ArrowRight } from 'lucide-react'
import { Suspense } from 'react'
import Link from 'next/link'
import { searchOwnedWords } from '@/features/search/repository'
import { SearchScreen, SearchProgress } from '@/features/search/SearchScreen'
import { normalizeWordSearchQuery } from '@/features/search/word-search'
import { requireAuthContext } from '@/lib/auth/session'
import styles from './SearchPage.module.css'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const params = await searchParams
  const query = normalizeWordSearchQuery(
    typeof params.q === 'string' ? params.q : ''
  )
  return (
    <SearchScreen query={query}>
      <Suspense key={query} fallback={<SearchProgress />}>
        <SearchResults query={query} />
      </Suspense>
    </SearchScreen>
  )
}

async function SearchResults({ query }: { query: string }) {
  const auth = await requireAuthContext()
  const results = query ? await searchOwnedWords(auth.userId, query) : []

  return !query ? (
    <div className={styles.empty}>
      <h2 className="text-lg font-semibold">Type a word to begin</h2>
      <p className="dw-support mt-2">
        Partial matches work for Dutch, English, and Russian text.
      </p>
    </div>
  ) : results.length === 0 ? (
    <div className={styles.empty}>
      <h2 className="text-lg font-semibold">No matching words</h2>
      <p className="dw-support mt-2">
        Try a shorter spelling or search for a translation.
      </p>
    </div>
  ) : (
    <div className={styles.results}>
      {results.map(result => (
        <Link
          className={styles.row}
          href={`/app/collections/${result.collectionId}/words/${result.wordId}`}
          key={result.wordId}
        >
          <span className={styles.lemma}>{result.dutchLemma}</span>
          <span className={styles.translation}>
            {result.primaryTranslation}
          </span>
          <span className={styles.collection}>{result.collectionName}</span>
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      ))}
    </div>
  )
}

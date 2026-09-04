import { ArrowRight, Search } from 'lucide-react'
import Form from 'next/form'
import Link from 'next/link'
import { searchOwnedWords } from '@/features/search/repository'
import { WORD_SEARCH_PATH } from '@/features/search/routes'
import { normalizeWordSearchQuery } from '@/features/search/word-search'
import { requireAuthContext } from '@/lib/auth/session'
import styles from './SearchPage.module.css'

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>
}) {
  const auth = await requireAuthContext()
  const params = await searchParams
  const query = normalizeWordSearchQuery(
    typeof params.q === 'string' ? params.q : ''
  )
  const results = query ? await searchOwnedWords(auth.userId, query) : []

  return (
    <section className={styles.page}>
      <p className="dw-label">Your vocabulary</p>
      <h1 className="dw-page-title mt-2">Search words</h1>
      <p className="dw-support mt-3">
        Search Dutch words and their English or Russian translations across all
        collections.
      </p>

      <Form action={WORD_SEARCH_PATH} className={styles.form}>
        <Search aria-hidden="true" size={18} />
        <input
          autoComplete="off"
          autoFocus
          defaultValue={query}
          maxLength={80}
          name="q"
          placeholder="Dutch word or translation"
          type="search"
        />
        <button className="dw-button dw-button--primary" type="submit">
          Search
        </button>
      </Form>

      {!query ? (
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
      )}
    </section>
  )
}

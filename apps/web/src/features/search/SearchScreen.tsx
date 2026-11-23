'use client'

import { LoaderCircle, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { SearchForm, usePendingSearch } from './SearchNavigation'
import styles from '@/app/app/search/SearchPage.module.css'

export function SearchProgress() {
  return (
    <div className={styles.pending} role="status">
      <LoaderCircle aria-hidden="true" size={20} />
      Searching…
    </div>
  )
}

export function SearchScreen({
  query,
  children,
}: {
  query: string
  children: ReactNode
}) {
  return (
    <section className={styles.page}>
      <p className="dw-label">Your vocabulary</p>
      <h1 className="dw-page-title mt-2">Search words</h1>
      <p className="dw-support mt-3">
        Search Dutch words and their English or Russian translations across all
        collections.
      </p>

      <SearchForm className={styles.form}>
        <Search aria-hidden="true" size={18} />
        <input
          autoComplete="off"
          aria-label="Dutch word or translation"
          autoFocus
          key={query}
          defaultValue={query}
          maxLength={80}
          name="q"
          placeholder="Dutch word or translation"
          type="search"
        />
        <button className="dw-button dw-button--primary" type="submit">
          Search
        </button>
      </SearchForm>

      {children}
    </section>
  )
}

export function PendingSearchScreen({ children }: { children: ReactNode }) {
  const query = usePendingSearch()
  return query === null ? (
    children
  ) : (
    <SearchScreen query={query}>
      <SearchProgress />
    </SearchScreen>
  )
}

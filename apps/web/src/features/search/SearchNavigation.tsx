'use client'

import Form from 'next/form'
import { useRouter } from 'next/navigation'
import {
  createContext,
  startTransition,
  useContext,
  useOptimistic,
  type FormEvent,
  type ReactNode,
} from 'react'
import { WORD_SEARCH_PATH } from './routes'
import { normalizeWordSearchQuery } from './word-search'

const SearchContext = createContext<{
  query: string | null
  submit?: (event: FormEvent<HTMLFormElement>) => void
}>({ query: null })

export function SearchNavigation({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [query, showQuery] = useOptimistic<string | null>(null)
  function submit(event: FormEvent<HTMLFormElement>) {
    const value = normalizeWordSearchQuery(
      String(new FormData(event.currentTarget).get('q') ?? '')
    )
    event.preventDefault()
    startTransition(() => {
      showQuery(value)
      router.push(
        value
          ? WORD_SEARCH_PATH + '?' + new URLSearchParams({ q: value })
          : WORD_SEARCH_PATH
      )
    })
  }
  return (
    <SearchContext.Provider value={{ query, submit }}>
      {children}
    </SearchContext.Provider>
  )
}

export function SearchForm({
  className,
  children,
}: {
  className: string
  children: ReactNode
}) {
  const { submit } = useContext(SearchContext)
  return (
    <Form action={WORD_SEARCH_PATH} className={className} onSubmit={submit}>
      {children}
    </Form>
  )
}

export function usePendingSearch() {
  return useContext(SearchContext).query
}

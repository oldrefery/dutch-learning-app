import { act, fireEvent, render, screen } from '@testing-library/react'
import { Suspense, use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SearchForm, SearchNavigation } from './SearchNavigation'
import { PendingSearchScreen, SearchScreen } from './SearchScreen'

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }))

function Results({ query, ready }: { query: string; ready: Promise<void> }) {
  if (query !== 'old') use(ready)
  return <SearchScreen query={query}>Result for {query}</SearchScreen>
}

it('immediately replaces previous content and keeps the latest submitted search visible', async () => {
  let finish!: () => void
  const ready = new Promise<void>(resolve => {
    finish = resolve
  })
  const push = jest.fn()
  jest
    .mocked(useRouter)
    .mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)
  function Workspace() {
    const [query, setQuery] = useState('old')
    push.mockImplementation((href: string) =>
      setQuery(new URL(href, 'https://example.org').searchParams.get('q')!)
    )
    return (
      <SearchNavigation>
        <SearchForm className="header">
          <input name="q" aria-label="Header query" />
          <button>Go</button>
        </SearchForm>
        <PendingSearchScreen>
          <Results query={query} ready={ready} />
        </PendingSearchScreen>
      </SearchNavigation>
    )
  }
  render(
    <Suspense fallback="Loading">
      <Workspace />
    </Suspense>
  )
  fireEvent.change(screen.getByLabelText('Header query'), {
    target: { value: 'huis' },
  })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
  })
  expect(screen.getByRole('status')).toHaveTextContent('Searching')
  expect(screen.queryByText('Result for old')).toBeNull()
  const input = screen.getByLabelText('Dutch word or translation')
  expect(input).toHaveValue('huis')
  fireEvent.change(input, { target: { value: 'de eieren' } })
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))
  })
  expect(push).toHaveBeenLastCalledWith('/app/search?q=de+eieren')
  expect(screen.getByRole('status')).toBeVisible()
  await act(async () => finish())
  expect(screen.getByText('Result for de eieren')).toBeVisible()
  expect(screen.queryByRole('status')).toBeNull()
})

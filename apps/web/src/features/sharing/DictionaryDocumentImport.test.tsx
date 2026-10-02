import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { requestDictionaryTransfer } from './dictionary-transfer-contract'
import { DictionaryDocumentImport } from './DictionaryDocumentImport'
import {
  document,
  OWNER,
  TARGET,
  savedReply,
} from './__fixtures__/dictionary-transfer'

jest.mock('next/navigation', () => ({ useRouter: jest.fn() }))
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('./dictionary-transfer-contract', () => ({
  ...jest.requireActual('./dictionary-transfer-contract'),
  requestDictionaryTransfer: jest.fn(),
}))
let auth: (event: string, session: { user: { id: string } } | null) => void
const refresh = jest.fn()
beforeEach(() => {
  jest.resetAllMocks()
  jest.mocked(useRouter).mockReturnValue({ refresh } as never)
  jest.mocked(createClient).mockReturnValue({
    auth: {
      onAuthStateChange: (callback: typeof auth) => {
        auth = callback
        callback('INITIAL_SESSION', { user: { id: OWNER } })
        return { data: { subscription: { unsubscribe: jest.fn() } } }
      },
    },
  } as never)
  jest.mocked(requestDictionaryTransfer).mockResolvedValue(savedReply)
})
const show = (value = document) => {
  render(
    <DictionaryDocumentImport
      ownerId={OWNER}
      collections={[{ id: TARGET, name: 'Existing readonly collection' }]}
      existingWords={[]}
    />
  )
  fireEvent.change(screen.getByLabelText('JSON document'), {
    target: { value: JSON.stringify(value) },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Preview words' }))
}
const submit = () =>
  fireEvent.click(screen.getByRole('button', { name: /Import \d+ selected/ }))
it('previews without writing, excludes document duplicates, and imports the selected content', async () => {
  show({ ...document, entries: [...document.entries, ...document.entries] })
  expect(requestDictionaryTransfer).not.toHaveBeenCalled()
  expect(screen.getAllByRole('checkbox')[1]).toBeDisabled()
  expect(screen.getByLabelText('Import into')).toHaveValue(TARGET)
  submit()
  await screen.findByRole('heading', { name: 'Import complete' })
  expect(requestDictionaryTransfer).toHaveBeenCalledTimes(1)
  expect(requestDictionaryTransfer).toHaveBeenCalledWith(
    expect.objectContaining({ selectedIndexes: [0], collectionId: TARGET })
  )
  expect(screen.getByRole('status')).toHaveTextContent('1 selected word saved')
  expect(
    screen.getByRole('link', { name: 'Open Existing readonly collection' })
  ).toHaveAttribute('href', `/app/collections/${TARGET}`)
})
it('rejects a future-schema document before allowing an import', () => {
  show({ ...document, schema_version: 2 } as never)
  expect(screen.getByRole('alert')).toHaveTextContent('schema-v1')
  expect(screen.queryByLabelText('Import into')).not.toBeInTheDocument()
  expect(requestDictionaryTransfer).not.toHaveBeenCalled()
})
it('requires a manual preview after an uncertain mutation and never replays automatically', async () => {
  jest
    .mocked(requestDictionaryTransfer)
    .mockRejectedValue(new Error('Lost reply'))
  show()
  submit()
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'could not be confirmed'
  )
  expect(
    screen.getByRole('button', { name: 'Import 1 selected word' })
  ).toBeDisabled()
  expect(
    screen.getByRole('link', { name: 'Check the selected collection' })
  ).toHaveAttribute('href', `/app/collections/${TARGET}`)
  expect(requestDictionaryTransfer).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Preview words' }))
  expect(
    screen.getByRole('button', { name: 'Import 1 selected word' })
  ).toBeEnabled()
  expect(requestDictionaryTransfer).toHaveBeenCalledTimes(1)
})
it('retains saved success after a router refresh failure and offers no retry button', async () => {
  refresh.mockImplementation(() => {
    throw new Error('Refresh failed')
  })
  show()
  submit()
  await screen.findByRole('heading', { name: 'Import complete' })
  expect(screen.getByText(/The words are saved/)).toBeVisible()
  expect(
    screen.queryByRole('button', { name: /Import \d+/ })
  ).not.toBeInTheDocument()
  expect(requestDictionaryTransfer).toHaveBeenCalledTimes(1)
})
it('suppresses delayed success after owner ABA and blocks duplicate submit', async () => {
  let resolve: (value: typeof savedReply) => void = () => {}
  jest.mocked(requestDictionaryTransfer).mockImplementation(
    () =>
      new Promise(done => {
        resolve = done
      })
  )
  show()
  const button = screen.getByRole('button', { name: 'Import 1 selected word' })
  fireEvent.click(button)
  fireEvent.click(button)
  expect(requestDictionaryTransfer).toHaveBeenCalledTimes(1)
  act(() => {
    auth('SIGNED_OUT', null)
    auth('SIGNED_IN', { user: { id: OWNER } })
  })
  await act(async () => resolve(savedReply))
  expect(
    screen.queryByRole('heading', { name: 'Import complete' })
  ).not.toBeInTheDocument()
  expect(screen.queryByLabelText('JSON document')).not.toBeInTheDocument()
  expect(refresh).not.toHaveBeenCalled()
})
it('paginates a large preview while retaining all-page selection', async () => {
  show({
    ...document,
    entries: Array.from({ length: 101 }, (_, index) => ({
      content: {
        ...document.entries[0].content,
        dutch_lemma: `fixture${index}`,
      },
    })),
  })
  expect(screen.getAllByRole('checkbox')).toHaveLength(50)
  expect(screen.getByText('Page 1 of 3')).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
  fireEvent.click(screen.getAllByRole('checkbox')[0])
  submit()
  await waitFor(() =>
    expect(requestDictionaryTransfer).toHaveBeenCalledTimes(1)
  )
  const command = jest.mocked(requestDictionaryTransfer).mock.calls[0][0]
  expect(command.kind).toBe('import')
  if (command.kind !== 'import') throw new Error('Wrong command')
  expect(command.selectedIndexes).toHaveLength(100)
  expect(command.selectedIndexes).not.toContain(50)
  expect(command.selectedIndexes).toContain(100)
})

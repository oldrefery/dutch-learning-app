import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createClient } from '@/lib/supabase/client'
import { requestDictionaryTransfer } from './dictionary-transfer-contract'
import { DictionaryExportPanel } from './DictionaryExportPanel'
import { document, OWNER, TARGET } from './__fixtures__/dictionary-transfer'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('./dictionary-transfer-contract', () => ({
  ...jest.requireActual('./dictionary-transfer-contract'),
  requestDictionaryTransfer: jest.fn(),
}))
let auth: (event: string, session: { user: { id: string } } | null) => void
const writeText = jest.fn()
beforeEach(() => {
  jest.resetAllMocks()
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })
  writeText.mockResolvedValue(undefined)
  jest.mocked(createClient).mockReturnValue({
    auth: {
      onAuthStateChange: (callback: typeof auth) => {
        auth = callback
        callback('INITIAL_SESSION', { user: { id: OWNER } })
        return { data: { subscription: { unsubscribe: jest.fn() } } }
      },
    },
  } as never)
  jest
    .mocked(requestDictionaryTransfer)
    .mockResolvedValue({ status: 'exported', ownerId: OWNER, document })
})
const show = () =>
  render(<DictionaryExportPanel ownerId={OWNER} collectionId={TARGET} />)
it('prepares valid JSON first, then copies only after a separate user click', async () => {
  show()
  fireEvent.click(screen.getByRole('button', { name: 'Prepare JSON export' }))
  const textarea = await screen.findByLabelText('JSON export')
  expect(textarea).toHaveValue(JSON.stringify(document))
  expect(textarea).toHaveAttribute('readonly')
  expect(writeText).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Copy JSON' }))
  await waitFor(() =>
    expect(writeText).toHaveBeenCalledWith(JSON.stringify(document))
  )
  expect(
    screen.getByRole('link', { name: 'Import a JSON export' })
  ).toHaveAttribute('href', '/app/dictionary-import')
})
it('leaves a manual selection fallback after clipboard rejection', async () => {
  writeText.mockRejectedValue(new Error('Denied'))
  show()
  fireEvent.click(screen.getByRole('button', { name: 'Prepare JSON export' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Copy JSON' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('copy it manually')
  expect(screen.getByLabelText('JSON export')).toHaveValue(
    JSON.stringify(document)
  )
})
it('suppresses a delayed private document after sign-out and same-owner sign-back', async () => {
  let resolve: (
    value: Awaited<ReturnType<typeof requestDictionaryTransfer>>
  ) => void = () => {}
  jest.mocked(requestDictionaryTransfer).mockImplementation(
    () =>
      new Promise(done => {
        resolve = done
      })
  )
  show()
  const button = screen.getByRole('button', { name: 'Prepare JSON export' })
  fireEvent.click(button)
  fireEvent.click(button)
  expect(requestDictionaryTransfer).toHaveBeenCalledTimes(1)
  act(() => {
    auth('SIGNED_OUT', null)
    auth('SIGNED_IN', { user: { id: OWNER } })
  })
  await act(async () =>
    resolve({ status: 'exported', ownerId: OWNER, document })
  )
  expect(screen.queryByLabelText('JSON export')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Reload page' })).toBeVisible()
  expect(writeText).not.toHaveBeenCalled()
})
it('hides a prepared document and prevents copying after sign-out', async () => {
  show()
  fireEvent.click(screen.getByRole('button', { name: 'Prepare JSON export' }))
  await screen.findByLabelText('JSON export')
  act(() => auth('SIGNED_OUT', null))
  expect(screen.queryByLabelText('JSON export')).not.toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Copy JSON' })
  ).not.toBeInTheDocument()
  expect(writeText).not.toHaveBeenCalled()
})

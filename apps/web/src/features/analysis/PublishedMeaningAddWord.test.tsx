import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PublishedMeaningAddWord } from './PublishedMeaningAddWord'
import { AddWordWorkflow } from './AddWordWorkflow'
import GlobalAddWordPage from '@/app/app/add/page'
import { analyzeWordWithAi } from './analysis-client'
import AddWordPage from '@/app/app/collections/[collectionId]/words/new/page'
import { DictionaryFollowingTransferPanel } from '@/features/sharing/DictionaryFollowingTransferPanel'
import { lookupPublishedMeanings } from './dictionary-meaning-lookup'
import { requireAuthContext } from '@/lib/auth/session'
import { hasOwnedCollection, listOwnedCollectionOptions } from './repository'
import { isDictionaryFollowingEnabled } from '@/features/dictionary/repository'
import { useWebSettings } from '@/features/settings/useWebSettings'
import {
  TRANSFER_OWNER,
  TRANSFER_OTHER,
  transferSession,
} from '@/features/sharing/__fixtures__/following-transfer'

jest.mock('@/features/dictionary/DictionaryCreationPanel', () => ({
  DictionaryCreationPanel: jest.fn(() => null),
}))
jest.mock('@/features/sharing/DictionaryFollowingTransferPanel', () => ({
  DictionaryFollowingTransferPanel: jest.fn(() => (
    <div>Retained meaning panel</div>
  )),
}))
jest.mock('./dictionary-meaning-lookup', () => ({
  lookupPublishedMeanings: jest.fn(),
}))
jest.mock('./actions', () => ({
  findOwnedSemanticDuplicate: jest.fn(),
  saveAnalyzedWord: jest.fn(),
}))
jest.mock('./analysis-client', () => ({
  analyzeWordWithAi: jest.fn(),
  findWordImages: jest.fn(),
  getNextImageOffset: jest.fn(),
}))
jest.mock('@/lib/auth/session', () => ({ requireAuthContext: jest.fn() }))
jest.mock('./repository', () => ({
  hasOwnedCollection: jest.fn(),
  listOwnedCollectionOptions: jest.fn(),
}))
jest.mock('@/features/dictionary/repository', () => ({
  isDictionaryFollowingEnabled: jest.fn(),
}))
jest.mock('@/features/settings/useWebSettings', () => ({
  useWebSettings: jest.fn(),
}))
const FIND = 'Find published meanings'
const INPUT = 'Dutch word or expression'
const RETAINED = 'Retained meaning panel'
const document = transferSession().document
const collections = [{ id: TRANSFER_OTHER, name: 'Owned' }]
const props = { ownerId: TRANSFER_OWNER, collections, followingEnabled: true }
beforeEach(() => {
  jest.clearAllMocks()
  jest
    .mocked(useWebSettings)
    .mockReturnValue({ settings: { lastSelectedCollectionId: null } } as never)
  jest.mocked(lookupPublishedMeanings).mockResolvedValue(document)
  jest.mocked(isDictionaryFollowingEnabled).mockReturnValue(true)
  jest.mocked(requireAuthContext).mockResolvedValue({
    userId: TRANSFER_OWNER,
    accessLevel: 'read_only',
  } as never)
  jest.mocked(listOwnedCollectionOptions).mockResolvedValue(collections)
  jest.mocked(hasOwnedCollection).mockReturnValue(true)
})
it('mounts retained adoption without a lookup and passes the full original only after an explicit request', async () => {
  render(<PublishedMeaningAddWord {...props} />)
  expect(screen.getByText(RETAINED)).toBeInTheDocument()
  expect(lookupPublishedMeanings).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText(INPUT), { target: { value: 'huis' } })
  fireEvent.click(screen.getByRole('button', { name: FIND }))
  await waitFor(() =>
    expect(DictionaryFollowingTransferPanel).toHaveBeenLastCalledWith(
      expect.objectContaining({
        document,
        ownerId: TRANSFER_OWNER,
        collections,
      }),
      undefined
    )
  )
  expect(lookupPublishedMeanings).toHaveBeenCalledWith(
    TRANSFER_OWNER,
    'huis',
    true,
    expect.any(Function)
  )
})
it('keeps retained sessions and explicit retries available for empty or offline results', async () => {
  jest
    .mocked(lookupPublishedMeanings)
    .mockResolvedValueOnce({ ...document, entries: [] })
    .mockRejectedValueOnce(new Error('Offline'))
  render(<PublishedMeaningAddWord {...props} />)
  fireEvent.click(screen.getByRole('button', { name: FIND }))
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent(
      'No published meaning matches'
    )
  )
  fireEvent.click(screen.getByRole('button', { name: FIND }))
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('Offline')
  )
  expect(screen.getByText(RETAINED)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: FIND }))
  await waitFor(() =>
    expect(DictionaryFollowingTransferPanel).toHaveBeenLastCalledWith(
      expect.objectContaining({ document }),
      undefined
    )
  )
})
it('refuses an old lookup after input changes and clears its candidates', async () => {
  let finish!: (value: typeof document) => void
  jest.mocked(lookupPublishedMeanings).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve
      })
  )
  render(<PublishedMeaningAddWord {...props} />)
  fireEvent.click(screen.getByRole('button', { name: FIND }))
  fireEvent.change(screen.getByLabelText(INPUT), { target: { value: 'lopen' } })
  await act(async () => finish(document))
  expect(DictionaryFollowingTransferPanel).toHaveBeenLastCalledWith(
    expect.objectContaining({ document: undefined }),
    undefined
  )
  expect(() => jest.mocked(lookupPublishedMeanings).mock.calls[0][3]()).toThrow(
    'Word input changed'
  )
})
it('fences a pending lookup when its view unmounts', async () => {
  let finish!: (value: typeof document) => void
  jest.mocked(lookupPublishedMeanings).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve
      })
  )
  const view = render(<PublishedMeaningAddWord {...props} />)
  fireEvent.click(screen.getByRole('button', { name: FIND }))
  view.unmount()
  await act(async () => finish(document))
  expect(() => jest.mocked(lookupPublishedMeanings).mock.calls[0][3]()).toThrow(
    'Word input changed'
  )
})
it('routes read-only adoption to shared lookup with owner remount and no legacy hooks', async () => {
  const view = render(
    await AddWordPage({
      params: Promise.resolve({ collectionId: TRANSFER_OTHER }),
    })
  )
  expect(screen.getByText('Shared vocabulary')).toBeInTheDocument()
  expect(screen.getByText(RETAINED)).toBeInTheDocument()
  expect(analyzeWordWithAi).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText(INPUT), {
    target: { value: 'changed' },
  })
  jest.mocked(requireAuthContext).mockResolvedValue({
    userId: TRANSFER_OTHER,
    accessLevel: 'read_only',
  } as never)
  view.rerender(
    await AddWordPage({
      params: Promise.resolve({ collectionId: TRANSFER_OTHER }),
    })
  )
  expect(screen.getByLabelText(INPUT)).toHaveValue('')
  expect(lookupPublishedMeanings).not.toHaveBeenCalled()
})
it('uses the requested destination as the first owned target while preserving every collection', () => {
  render(
    <AddWordWorkflow
      collections={[{ id: TRANSFER_OWNER, name: 'Other' }, ...collections]}
      initialCollectionId={TRANSFER_OTHER}
      userId={TRANSFER_OWNER}
      followingEnabled
    />
  )
  expect(DictionaryFollowingTransferPanel).toHaveBeenLastCalledWith(
    expect.objectContaining({
      collections: [...collections, { id: TRANSFER_OWNER, name: 'Other' }],
    }),
    undefined
  )
  expect(analyzeWordWithAi).not.toHaveBeenCalled()
})
it('keeps the legacy access restriction when following is OFF', async () => {
  jest.mocked(isDictionaryFollowingEnabled).mockReturnValue(false)
  render(
    await AddWordPage({
      params: Promise.resolve({ collectionId: TRANSFER_OTHER }),
    })
  )
  expect(
    screen.getByText('Full access is required to analyze and save new words.')
  ).toBeInTheDocument()
  expect(DictionaryFollowingTransferPanel).not.toHaveBeenCalled()
})

it('opens retained shared sessions on the global add route for a read-only owner even with no local target collection', async () => {
  jest.mocked(listOwnedCollectionOptions).mockResolvedValue([])
  render(await GlobalAddWordPage())
  expect(screen.getByText('Shared vocabulary')).toBeInTheDocument()
  expect(screen.getByText(RETAINED)).toBeInTheDocument()
  expect(DictionaryFollowingTransferPanel).toHaveBeenLastCalledWith(
    expect.objectContaining({ collections: [], ownerId: TRANSFER_OWNER }),
    undefined
  )
  expect(analyzeWordWithAi).not.toHaveBeenCalled()
})
it('honors a stored owned target on the global route without overriding an explicitly requested collection', () => {
  jest.mocked(useWebSettings).mockReturnValue({
    settings: { lastSelectedCollectionId: TRANSFER_OTHER },
  } as never)
  const rows = [{ id: TRANSFER_OWNER, name: 'Other' }, ...collections]
  const view = render(
    <AddWordWorkflow
      collections={rows}
      initialCollectionId={TRANSFER_OWNER}
      useStoredCollectionPreference
      userId={TRANSFER_OWNER}
      followingEnabled
    />
  )
  expect(DictionaryFollowingTransferPanel).toHaveBeenLastCalledWith(
    expect.objectContaining({ collections: [...collections, rows[0]] }),
    undefined
  )
  view.rerender(
    <AddWordWorkflow
      collections={rows}
      initialCollectionId={TRANSFER_OWNER}
      userId={TRANSFER_OWNER}
      followingEnabled
    />
  )
  expect(DictionaryFollowingTransferPanel).toHaveBeenLastCalledWith(
    expect.objectContaining({ collections: rows }),
    undefined
  )
})

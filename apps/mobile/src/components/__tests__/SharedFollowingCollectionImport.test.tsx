import { useState } from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { Text as MockText } from 'react-native'
import ImportSelectionScreen from '@/app/import/[token]'
import { useImportSelection } from '@/hooks/useImportSelection'
import { SharedFollowingCollectionImport } from '../SharedFollowingCollectionImport'
import { DictionaryFollowingTransferPanel } from '../DictionaryFollowingTransferPanel'
import { readSharedFollowingCollection } from '@/services/sharedFollowingImport'
import { isDictionaryFollowingImportsEnabled } from '@/constants/dictionaryContent'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { OWNER_A, OWNER_B } from '@/db/__tests__/dictionaryFollowing.fixture'
import { transferSession } from '@/db/__tests__/dictionaryFollowingTransfer.fixture'
jest.mock('expo-router', () => ({
  Color: { android: { dynamic: {} }, ios: {} },
  useLocalSearchParams: () => ({
    token: '81818181-8181-4181-8181-818181818181',
  }),
  Stack: { Screen: () => null },
  router: { back: jest.fn() },
}))
jest.mock('@/components/DictionaryFollowingTransferPanel', () => ({
  DictionaryFollowingTransferPanel: jest.fn(() => (
    <MockText>Retained shared panel</MockText>
  )),
}))
jest.mock('@/services/sharedFollowingImport', () => ({
  readSharedFollowingCollection: jest.fn(),
}))
jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryFollowingImportsEnabled: jest.fn(),
}))
jest.mock('@/stores/useApplicationStore', () => ({
  useApplicationStore: jest.fn(),
}))
jest.mock('@/hooks/useImportSelection', () => ({
  useImportSelection: jest.fn(() => ({ loading: true })),
}))
jest.mock('@/components/SharedCollectionErrorScreen', () => ({
  SharedCollectionErrorScreen: ({ error }: { error: string }) => (
    <MockText>{error}</MockText>
  ),
}))
jest.mock('@/components/SharedCollectionLoadingScreen', () => ({
  SharedCollectionLoadingScreen: () => <MockText>Legacy loading</MockText>,
}))
jest.mock('@/components/ImportHeaderButton', () => ({
  ImportHeaderButton: () => null,
}))
jest.mock('@/components/ImportScreenContent', () => ({
  ImportScreenContent: () => null,
}))
const RETAINED_PANEL = 'Retained shared panel'
const LOAD_SHARE = 'Load shared collection'
const REVOKED_SHARE = 'Revoked share'
const token = '81818181-8181-4181-8181-818181818181'
const collections = [{ collection_id: OWNER_B, name: 'Owned' }]
const original = {
  schema_version: 2 as const,
  collection: { collection_id: OWNER_B, name: 'Source' },
  words: [{ ...transferSession().document.entries[0], word_id: OWNER_A }],
}
beforeEach(() => {
  jest.clearAllMocks()
  jest
    .mocked(DictionaryFollowingTransferPanel)
    .mockImplementation(() => <MockText>Retained shared panel</MockText>)
  jest.mocked(isDictionaryFollowingImportsEnabled).mockReturnValue(true)
  jest.mocked(useApplicationStore).mockImplementation(selector =>
    selector({
      currentUserId: OWNER_A,
      collections: collections.map(row => ({ ...row, user_id: OWNER_A })),
    } as never)
  )
  jest.mocked(readSharedFollowingCollection).mockResolvedValue(original)
})
it('opens retained sessions without a remote read or legacy preview and loads only on request', async () => {
  const view = render(<ImportSelectionScreen />)
  expect(view.getByText(RETAINED_PANEL)).toBeTruthy()
  expect(useImportSelection).not.toHaveBeenCalled()
  expect(readSharedFollowingCollection).not.toHaveBeenCalled()
  fireEvent.press(view.getByLabelText(LOAD_SHARE))
  await waitFor(() =>
    expect(DictionaryFollowingTransferPanel).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ownerId: OWNER_A,
        sharedSource: { shareToken: token, original },
        collections,
      }),
      undefined
    )
  )
  expect(readSharedFollowingCollection).toHaveBeenCalledWith(
    OWNER_A,
    token,
    expect.any(Function)
  )
})
it('shows a failed read while retaining local sessions and permits a later explicit retry', async () => {
  jest
    .mocked(readSharedFollowingCollection)
    .mockRejectedValueOnce(new Error(REVOKED_SHARE))
  const view = render(
    <SharedFollowingCollectionImport
      ownerId={OWNER_A}
      shareToken={token}
      collections={collections}
      onClose={() => {}}
    />
  )
  fireEvent.press(view.getByLabelText(LOAD_SHARE))
  await waitFor(() => expect(view.getByText(REVOKED_SHARE)).toBeTruthy())
  expect(view.getByText(RETAINED_PANEL)).toBeTruthy()
  fireEvent.press(view.getByLabelText(LOAD_SHARE))
  await waitFor(() => expect(view.queryByText(REVOKED_SHARE)).toBeNull())
  expect(readSharedFollowingCollection).toHaveBeenCalledTimes(2)
})
it('rejects late preview completion after unmount', async () => {
  let guard: (() => void) | undefined
  let resolve: ((value: typeof original) => void) | undefined
  jest
    .mocked(readSharedFollowingCollection)
    .mockImplementation((_owner, _token, assert) => {
      guard = assert
      return new Promise(done => {
        resolve = done
      })
    })
  const view = render(<ImportSelectionScreen />)
  fireEvent.press(view.getByLabelText(LOAD_SHARE))
  view.unmount()
  expect(guard).toBeDefined()
  expect(() => guard?.()).toThrow('view changed')
  resolve?.(original)
})
it('fails closed when signed out and keeps the legacy route with opt-in off', () => {
  jest
    .mocked(useApplicationStore)
    .mockImplementation(selector =>
      selector({ currentUserId: null, collections } as never)
    )
  const view = render(<ImportSelectionScreen />)
  expect(view.getByText('Sign in to verify a shared collection.')).toBeTruthy()
  expect(useImportSelection).not.toHaveBeenCalled()
  jest.mocked(isDictionaryFollowingImportsEnabled).mockReturnValue(false)
  view.rerender(<ImportSelectionScreen />)
  expect(view.getByText('Legacy loading')).toBeTruthy()
})

it('remounts retained state on owner change and excludes foreign destination collections', () => {
  jest
    .mocked(DictionaryFollowingTransferPanel)
    .mockImplementation(({ ownerId }) => {
      const [capturedOwner] = useState(ownerId)
      return <MockText>{capturedOwner}</MockText>
    })
  const view = render(<ImportSelectionScreen />)
  expect(view.getByText(OWNER_A)).toBeTruthy()
  jest.mocked(useApplicationStore).mockImplementation(selector =>
    selector({
      currentUserId: OWNER_B,
      collections: [{ ...collections[0], user_id: OWNER_A }],
    } as never)
  )
  view.rerender(<ImportSelectionScreen />)
  expect(view.getByText(OWNER_B)).toBeTruthy()
  expect(view.queryByText(OWNER_A)).toBeNull()
  expect(
    jest.mocked(DictionaryFollowingTransferPanel).mock.calls.at(-1)?.[0]
      .collections
  ).toEqual([])
})

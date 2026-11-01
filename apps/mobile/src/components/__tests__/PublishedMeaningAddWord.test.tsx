import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { Text as MockText } from 'react-native'
import { PublishedMeaningAddWord } from '../PublishedMeaningAddWord'
import { AddWordScreen } from '../AddWordScreen'
import { LegacyAddWordScreen } from '../AddWordScreen/AddWordScreen'
import { DictionaryFollowingTransferPanel } from '../DictionaryFollowingTransferPanel'
import { lookupPublishedMeanings } from '@/services/dictionaryMeaningLookup'
import { isDictionaryFollowingEnabled } from '@/constants/dictionaryContent'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { OWNER_A, OWNER_B } from '@/db/__tests__/dictionaryFollowing.fixture'
import { transferSession } from '@/db/__tests__/dictionaryFollowingTransfer.fixture'

jest.mock('../DictionaryCreationPanel', () => ({
  DictionaryCreationPanel: jest.fn(() => null),
}))
jest.mock('expo-router', () => ({
  Color: { android: { dynamic: {} }, ios: {} },
  useRouter: () => ({ back: jest.fn() }),
}))
jest.mock('@/components/AddWordScreen/AddWordScreen', () => ({
  LegacyAddWordScreen: jest.fn(() => <MockText>Legacy add word</MockText>),
}))
jest.mock('@/components/DictionaryFollowingTransferPanel', () => ({
  DictionaryFollowingTransferPanel: jest.fn(() => (
    <MockText>Retained meaning panel</MockText>
  )),
}))
jest.mock('@/services/dictionaryMeaningLookup', () => ({
  lookupPublishedMeanings: jest.fn(),
}))
jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryFollowingEnabled: jest.fn(),
}))
jest.mock('@/stores/useSettingsStore', () => ({ useSettingsStore: jest.fn() }))
jest.mock('@/stores/useApplicationStore', () => ({
  useApplicationStore: jest.fn(),
}))
jest.mock('@/hooks/useNormalizedColorScheme', () => ({
  useNormalizedColorScheme: jest.fn(),
}))
const FIND = 'Find published meanings'
const INPUT = 'Dutch word or expression'
const RETAINED = 'Retained meaning panel'
const document = transferSession().document
const collections = [{ collection_id: OWNER_B, name: 'Owned' }]
const props = { ownerId: OWNER_A, collections, onClose: jest.fn() }
beforeEach(() => {
  jest.clearAllMocks()
  jest
    .mocked(useSettingsStore)
    .mockImplementation(selector =>
      selector({ lastSelectedCollectionId: null } as never)
    )
  jest.mocked(lookupPublishedMeanings).mockResolvedValue(document)
  jest.mocked(isDictionaryFollowingEnabled).mockReturnValue(true)
  jest.mocked(useNormalizedColorScheme).mockReturnValue('light')
  jest.mocked(useApplicationStore).mockImplementation(selector =>
    selector({
      currentUserId: OWNER_A,
      collections: collections.map(row => ({ ...row, user_id: OWNER_A })),
    } as never)
  )
})
it.each(['light', 'dark'] as const)(
  'requires explicit lookup in %s theme, passing full results to retained adoption without automatic analysis',
  async theme => {
    jest.mocked(useNormalizedColorScheme).mockReturnValue(theme)
    const view = render(
      <PublishedMeaningAddWord {...props} initialWord="huis" />
    )
    expect(view.getByText(RETAINED)).toBeTruthy()
    expect(lookupPublishedMeanings).not.toHaveBeenCalled()
    fireEvent.press(view.getByLabelText(FIND))
    await waitFor(() =>
      expect(DictionaryFollowingTransferPanel).toHaveBeenLastCalledWith(
        expect.objectContaining({ document, ownerId: OWNER_A, collections }),
        undefined
      )
    )
    expect(lookupPublishedMeanings).toHaveBeenCalledWith(
      OWNER_A,
      'huis',
      expect.any(Function)
    )
  }
)
it('retains local sessions on unresolved input or network failure and permits explicit retry', async () => {
  jest
    .mocked(lookupPublishedMeanings)
    .mockResolvedValueOnce({ ...document, entries: [] })
    .mockRejectedValueOnce(new Error('Offline'))
  const view = render(<PublishedMeaningAddWord {...props} initialWord="huis" />)
  fireEvent.press(view.getByLabelText(FIND))
  await waitFor(() =>
    expect(view.getByText(/No published meaning matches/)).toBeTruthy()
  )
  fireEvent.press(view.getByLabelText(FIND))
  await waitFor(() => expect(view.getByText('Offline')).toBeTruthy())
  expect(view.getByText(RETAINED)).toBeTruthy()
  fireEvent.press(view.getByLabelText(FIND))
  await waitFor(() =>
    expect(DictionaryFollowingTransferPanel).toHaveBeenLastCalledWith(
      expect.objectContaining({ document }),
      undefined
    )
  )
})
it('invalidates a pending result when input changes, clearing old candidates before another explicit lookup', async () => {
  let finish!: (value: typeof document) => void
  jest.mocked(lookupPublishedMeanings).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve
      })
  )
  const view = render(<PublishedMeaningAddWord {...props} initialWord="huis" />)
  fireEvent.press(view.getByLabelText(FIND))
  fireEvent.changeText(view.getByLabelText(INPUT), 'lopen')
  await act(async () => finish(document))
  expect(DictionaryFollowingTransferPanel).toHaveBeenLastCalledWith(
    expect.objectContaining({ document: undefined }),
    undefined
  )
  expect(() => jest.mocked(lookupPublishedMeanings).mock.calls[0][2]()).toThrow(
    'Word input changed'
  )
})
it('fences an unmounted pending lookup', async () => {
  let finish!: (value: typeof document) => void
  jest.mocked(lookupPublishedMeanings).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve
      })
  )
  const view = render(<PublishedMeaningAddWord {...props} initialWord="huis" />)
  fireEvent.press(view.getByLabelText(FIND))
  view.unmount()
  await act(async () => finish(document))
  expect(() => jest.mocked(lookupPublishedMeanings).mock.calls[0][2]()).toThrow(
    'Word input changed'
  )
})
it.each([false, true])(
  'keeps the familiar input, analysis and collection screen when following is %s',
  following => {
    jest.mocked(isDictionaryFollowingEnabled).mockReturnValue(following)
    const view = render(
      <AddWordScreen
        preselectedCollectionId={OWNER_B}
        initialWord="huis"
        batchItemId="queued"
      />
    )
    expect(view.getByText('Legacy add word')).toBeTruthy()
    expect(LegacyAddWordScreen).toHaveBeenLastCalledWith(
      expect.objectContaining({
        preselectedCollectionId: OWNER_B,
        initialWord: 'huis',
        batchItemId: 'queued',
      }),
      undefined
    )
    expect(view.queryByLabelText(FIND)).toBeNull()
    expect(lookupPublishedMeanings).not.toHaveBeenCalled()
  }
)

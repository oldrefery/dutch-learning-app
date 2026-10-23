import { render } from '@testing-library/react-native'
import { Text as MockText } from 'react-native'
import { StarterPackScreenContent } from '@/app/starter-pack'
import { useStarterPackImport } from '@/hooks/useStarterPackImport'
import { DictionaryFollowingTransferPanel } from '@/components/DictionaryFollowingTransferPanel'
import { isDictionaryFollowingImportsEnabled } from '@/constants/dictionaryContent'
import { loadOfficialDutchA1Pack } from '@/services/starterPackService'
import { useApplicationStore } from '@/stores/useApplicationStore'
jest.mock('expo-router', () => ({
  Color: { android: { dynamic: {} }, ios: {} },
  Stack: { Screen: () => null },
}))
jest.mock('@/hooks/useStarterPackImport', () => ({
  NEW_STARTER_COLLECTION_ID: '__new_starter_collection__',
  useStarterPackImport: jest.fn(),
}))
jest.mock('@/components/DictionaryFollowingTransferPanel', () => ({
  DictionaryFollowingTransferPanel: jest.fn(() => (
    <MockText>Shared pack panel</MockText>
  )),
}))
jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryFollowingImportsEnabled: jest.fn(),
}))
jest.mock('@/stores/useApplicationStore', () => ({
  useApplicationStore: jest.fn(),
}))
jest.mock('@/components/ImportScreenContent', () => ({
  ImportScreenContent: () => <MockText>Legacy starter preview</MockText>,
}))
jest.mock('@/components/SharedCollectionErrorScreen', () => ({
  SharedCollectionErrorScreen: ({ error }: { error: string }) => (
    <MockText>{error}</MockText>
  ),
}))
jest.mock('@/components/StarterPackReviewBanner', () => ({
  StarterPackReviewBanner: () => null,
}))
jest.mock('@/components/StarterPackImportBar', () => ({
  StarterPackImportBar: () => null,
}))
jest.mock('@/components/ImportHeaderButton', () => ({
  ImportHeaderButton: () => null,
}))
const owner = '11111111-1111-4111-8111-111111111111'
const manifest = loadOfficialDutchA1Pack()
const target = {
  collection_id: '22222222-2222-4222-8222-222222222222',
  name: 'Owned',
}
beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(isDictionaryFollowingImportsEnabled).mockReturnValue(true)
  jest.mocked(useApplicationStore).mockReturnValue(owner as never)
  jest.mocked(useStarterPackImport).mockReturnValue({
    loading: false,
    manifest,
    previewData: { collection: { name: manifest.title }, words: [] },
    collections: [
      { collection_id: '__new_starter_collection__', name: 'Create' },
      target,
    ],
    handleBackToCollections: jest.fn(),
    handleGoBack: jest.fn(),
  } as never)
})
it('routes the complete original to following import and requires an existing target', () => {
  const view = render(<StarterPackScreenContent />)
  expect(view.getByText('Shared pack panel')).toBeTruthy()
  expect(
    jest.mocked(DictionaryFollowingTransferPanel).mock.calls[0][0]
  ).toMatchObject({
    ownerId: owner,
    officialManifest: manifest,
    collections: [target],
  })
  expect(view.queryByText('Legacy starter preview')).toBeNull()
})
it('fails closed for a signed-out following pack', () => {
  jest.mocked(useApplicationStore).mockReturnValue(null as never)
  const view = render(<StarterPackScreenContent />)
  expect(
    view.getByText('Sign in to prepare an official shared pack import.')
  ).toBeTruthy()
  expect(DictionaryFollowingTransferPanel).not.toHaveBeenCalled()
})
it('preserves the legacy preview when the gate is off', () => {
  jest.mocked(isDictionaryFollowingImportsEnabled).mockReturnValue(false)
  const view = render(<StarterPackScreenContent />)
  expect(view.getByText('Legacy starter preview')).toBeTruthy()
  expect(DictionaryFollowingTransferPanel).not.toHaveBeenCalled()
})

import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import * as ReactNative from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { router } from 'expo-router'
import DictionaryDocumentImportScreen from '@/app/dictionary-import'
import { DictionaryExportButton } from '../DictionaryExportButton'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { collectionRepository } from '@/db/collectionRepository'
import { wordRepository } from '@/db/wordRepository'
import { isDictionaryContentEnabled } from '@/constants/dictionaryContent'
import {
  importOfflineDictionaryCollection,
  exportOfflineDictionaryCollection,
} from '@/services/dictionaryTransferService'
import { ToastService } from '@/components/AppToast'
import { wordToDictionaryContent } from '@/db/dictionaryContentMapping'
import {
  createMockWord,
  createMockCollection,
} from '@/__tests__/helpers/factories'
import { Colors } from '@/constants/Colors'

let mockOwner: string | null
jest.mock('@/stores/useApplicationStore', () => ({
  useApplicationStore: Object.assign(
    (select: (state: { currentUserId: string | null }) => unknown) =>
      select({ currentUserId: mockOwner }),
    { getState: jest.fn() }
  ),
}))
jest.mock('@/db/collectionRepository', () => ({
  collectionRepository: { getCollectionsByUserId: jest.fn() },
}))
jest.mock('@/db/wordRepository', () => ({
  wordRepository: { getWordsByUserId: jest.fn() },
}))
jest.mock('@/services/dictionaryTransferService', () => ({
  ...jest.requireActual('@/services/dictionaryTransferService'),
  importOfflineDictionaryCollection: jest.fn(),
  exportOfflineDictionaryCollection: jest.fn(),
}))
jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryContentEnabled: jest.fn(() => true),
}))
jest.mock('@/components/AppToast', () => ({
  ToastService: { show: jest.fn() },
}))
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }))
jest.mock('expo-router', () => ({
  Color: { android: { dynamic: {} }, ios: {} },
  router: { replace: jest.fn() },
  Stack: {
    Screen: ({ options }: { options: { headerRight?: () => unknown } }) =>
      options.headerRight?.() ?? null,
  },
}))

const EXPORT_NAME = 'Full export'
const JSON_INPUT = 'Collection JSON'
const PREVIEW_BUTTON = 'Preview document'
const IMPORT_BUTTON = 'Import selected words'
const OTHER_OWNER = 'other-owner'
const EXPORT_BUTTON = 'Copy collection JSON export'
const OWNER = '10000000-0000-4000-8000-000000000001'
const TARGET = '20000000-0000-4000-8000-000000000001'
const collection = createMockCollection({
  collection_id: TARGET,
  user_id: OWNER,
  name: 'Owned target',
})
const word = createMockWord({
  dutch_lemma: 'huis',
  word_id: '30000000-0000-4000-8000-000000000001',
  user_id: OWNER,
  collection_id: TARGET,
})
const content = wordToDictionaryContent(word)
const document = {
  schema_version: 1 as const,
  collection: { name: EXPORT_NAME },
  entries: [{ content }, { content: { ...content, dutch_lemma: 'fiets' } }],
}
const fetchWords = jest.fn()

const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => {
    resolve = done
  })
  return { promise, resolve }
}

describe('dictionary document transfer UI', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockOwner = OWNER
    jest.mocked(isDictionaryContentEnabled).mockReturnValue(true)
    jest
      .mocked(useApplicationStore.getState)
      .mockImplementation(
        () => ({ currentUserId: mockOwner, fetchWords }) as never
      )
    jest.mocked(collectionRepository.getCollectionsByUserId).mockResolvedValue([
      {
        ...collection,
        sync_status: 'synced',
        last_sync_attempt_at: null,
        synced_at: null,
      },
    ])
    jest.mocked(wordRepository.getWordsByUserId).mockResolvedValue([])
    jest
      .mocked(importOfflineDictionaryCollection)
      .mockResolvedValue({ importedCount: 2, skippedCount: 0 })
    jest.mocked(exportOfflineDictionaryCollection).mockResolvedValue(document)
    jest.mocked(Clipboard.setStringAsync).mockResolvedValue(true)
    fetchWords.mockResolvedValue(undefined)
  })
  afterEach(() => jest.restoreAllMocks())

  const preview = async () => {
    const view = render(<DictionaryDocumentImportScreen />)
    fireEvent.changeText(
      view.getByLabelText(JSON_INPUT),
      JSON.stringify(document)
    )
    fireEvent.press(view.getByLabelText(PREVIEW_BUTTON))
    await waitFor(() => expect(view.getByText(EXPORT_NAME)).toBeOnTheScreen())
    return view
  }

  it.each(['light', 'dark'] as const)(
    'previews and imports selected full content in the %s theme',
    async theme => {
      jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue(theme)
      const view = render(<DictionaryDocumentImportScreen />)
      expect(view.getByLabelText(JSON_INPUT)).toHaveStyle({
        color: Colors[theme].text,
        borderColor: Colors[theme].border,
      })
      fireEvent.changeText(
        view.getByLabelText(JSON_INPUT),
        JSON.stringify(document)
      )
      fireEvent.press(view.getByLabelText(PREVIEW_BUTTON))
      await waitFor(() =>
        expect(view.getByTestId('import-word-1')).toBeOnTheScreen()
      )
      fireEvent.press(view.getByTestId('import-word-1'))
      jest
        .mocked(importOfflineDictionaryCollection)
        .mockResolvedValueOnce({ importedCount: 1, skippedCount: 0 })
      fireEvent.press(view.getByLabelText(IMPORT_BUTTON))
      await waitFor(() =>
        expect(
          view.getByText('1 word saved. 0 duplicates skipped.')
        ).toBeOnTheScreen()
      )
      expect(importOfflineDictionaryCollection).toHaveBeenCalledWith(
        JSON.stringify(document),
        TARGET,
        ['0'],
        OWNER
      )
      expect(fetchWords).toHaveBeenCalledTimes(1)
      fireEvent.press(view.getByText('Open collection'))
      expect(router.replace).toHaveBeenCalledWith(`/collection/${TARGET}`)
    }
  )

  it('prevents a second submission and locks the target until persistence completes', async () => {
    const result = deferred<{ importedCount: number; skippedCount: number }>()
    jest
      .mocked(importOfflineDictionaryCollection)
      .mockReturnValueOnce(result.promise)
    const view = await preview()
    fireEvent.press(view.getByLabelText(IMPORT_BUTTON))
    fireEvent.press(view.getByLabelText(IMPORT_BUTTON))
    expect(importOfflineDictionaryCollection).toHaveBeenCalledTimes(1)
    await act(async () => result.resolve({ importedCount: 2, skippedCount: 0 }))
    expect(view.queryByLabelText(IMPORT_BUTTON)).toBeNull()
  })

  it('keeps success visible after a cache reload fails, without offering another import', async () => {
    fetchWords.mockRejectedValueOnce(new Error('synthetic cache failure'))
    const view = await preview()
    fireEvent.press(view.getByLabelText(IMPORT_BUTTON))
    await waitFor(() =>
      expect(
        view.getByText(
          'Words were saved. Reopen the collection to refresh the list.'
        )
      ).toBeOnTheScreen()
    )
    expect(view.queryByLabelText(IMPORT_BUTTON)).toBeNull()
    expect(importOfflineDictionaryCollection).toHaveBeenCalledTimes(1)
  })

  it('marks existing cards as duplicates and leaves them out of the submitted selection', async () => {
    jest.mocked(wordRepository.getWordsByUserId).mockResolvedValueOnce([
      {
        ...word,
        sync_status: 'pending',
        deleted_at: null,
        last_sync_attempt_at: null,
        synced_at: null,
      },
    ])
    const view = await preview()
    expect(view.queryByTestId('import-word-0')).toBeNull()
    fireEvent.press(view.getByLabelText(IMPORT_BUTTON))
    await waitFor(() =>
      expect(importOfflineDictionaryCollection).toHaveBeenCalledWith(
        JSON.stringify(document),
        TARGET,
        ['1'],
        OWNER
      )
    )
  })

  it('virtualizes a large document while retaining every selectable entry', async () => {
    const large = {
      ...document,
      entries: Array.from({ length: 1_000 }, (_, index) => ({
        content: { ...content, dutch_lemma: `word ${index}` },
      })),
    }
    const view = render(<DictionaryDocumentImportScreen />)
    fireEvent.changeText(view.getByLabelText(JSON_INPUT), JSON.stringify(large))
    fireEvent.press(view.getByLabelText(PREVIEW_BUTTON))
    await waitFor(() =>
      expect(view.getByTestId('import-word-0')).toBeOnTheScreen()
    )
    expect(view.queryByTestId('import-word-999')).toBeNull()
    fireEvent.press(view.getByLabelText(IMPORT_BUTTON))
    await waitFor(() =>
      expect(importOfflineDictionaryCollection).toHaveBeenCalledWith(
        JSON.stringify(large),
        TARGET,
        Array.from({ length: 1_000 }, (_, index) => String(index)),
        OWNER
      )
    )
  })

  it('does not expose the previous owner document after an account change', async () => {
    const view = await preview()
    mockOwner = OTHER_OWNER
    view.rerender(<DictionaryDocumentImportScreen />)
    expect(view.queryByText(EXPORT_NAME)).toBeNull()
    expect(view.getByLabelText(JSON_INPUT)).toHaveProp('value', '')
    expect(importOfflineDictionaryCollection).not.toHaveBeenCalled()
  })

  it('ignores an old-owner preview request that completes after switching accounts', async () => {
    const pending =
      deferred<
        Awaited<ReturnType<typeof collectionRepository.getCollectionsByUserId>>
      >()
    jest
      .mocked(collectionRepository.getCollectionsByUserId)
      .mockReturnValueOnce(pending.promise)
    const view = render(<DictionaryDocumentImportScreen />)
    fireEvent.changeText(
      view.getByLabelText(JSON_INPUT),
      JSON.stringify(document)
    )
    fireEvent.press(view.getByLabelText(PREVIEW_BUTTON))
    mockOwner = OTHER_OWNER
    view.rerender(<DictionaryDocumentImportScreen />)
    await act(async () =>
      pending.resolve([
        {
          ...collection,
          sync_status: 'synced',
          last_sync_attempt_at: null,
          synced_at: null,
        },
      ])
    )
    expect(view.queryByText(EXPORT_NAME)).toBeNull()
    expect(view.getByLabelText(JSON_INPUT)).toHaveProp('value', '')
  })

  it('shows validation and missing-target errors without attempting an import', async () => {
    const view = render(<DictionaryDocumentImportScreen />)
    fireEvent.changeText(view.getByLabelText(JSON_INPUT), '{')
    fireEvent.press(view.getByLabelText(PREVIEW_BUTTON))
    await waitFor(() =>
      expect(
        view.getByText('Invalid dictionary collection document.')
      ).toBeOnTheScreen()
    )
    jest
      .mocked(collectionRepository.getCollectionsByUserId)
      .mockResolvedValueOnce([])
    fireEvent.changeText(
      view.getByLabelText(JSON_INPUT),
      JSON.stringify(document)
    )
    fireEvent.press(view.getByLabelText(PREVIEW_BUTTON))
    await waitFor(() =>
      expect(
        view.getByText(
          'An existing collection is required. Create one before importing.'
        )
      ).toBeOnTheScreen()
    )
    expect(importOfflineDictionaryCollection).not.toHaveBeenCalled()
  })

  it('copies only the validated self-contained export without sharing or server writes', async () => {
    const view = render(<DictionaryExportButton collectionId={TARGET} />)
    fireEvent.press(view.getByLabelText(EXPORT_BUTTON))
    await waitFor(() =>
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
        JSON.stringify(document)
      )
    )
    expect(ToastService.show).toHaveBeenCalledWith(
      'Full collection JSON copied.',
      'success'
    )
    expect(importOfflineDictionaryCollection).not.toHaveBeenCalled()
  })

  it('does not copy old-owner content if the account changes while export is loading', async () => {
    const pending = deferred<typeof document>()
    jest
      .mocked(exportOfflineDictionaryCollection)
      .mockReturnValueOnce(pending.promise)
    const view = render(<DictionaryExportButton collectionId={TARGET} />)
    fireEvent.press(view.getByLabelText(EXPORT_BUTTON))
    mockOwner = OTHER_OWNER
    await act(async () => pending.resolve(document))
    expect(Clipboard.setStringAsync).not.toHaveBeenCalled()
    expect(ToastService.show).not.toHaveBeenCalled()
  })

  it('reports clipboard failure and blocks dormant transfer entrypoints', async () => {
    jest.mocked(Clipboard.setStringAsync).mockResolvedValueOnce(false)
    const button = render(<DictionaryExportButton collectionId={TARGET} />)
    fireEvent.press(button.getByLabelText(EXPORT_BUTTON))
    await waitFor(() =>
      expect(ToastService.show).toHaveBeenCalledWith(
        'Could not copy the document.',
        'error'
      )
    )
    jest.mocked(isDictionaryContentEnabled).mockReturnValue(false)
    button.rerender(<DictionaryExportButton collectionId={TARGET} />)
    expect(button.queryByLabelText(EXPORT_BUTTON)).toBeNull()
    const screen = render(<DictionaryDocumentImportScreen />)
    expect(screen.queryByLabelText(JSON_INPUT)).toBeNull()
    expect(importOfflineDictionaryCollection).not.toHaveBeenCalled()
  })
})

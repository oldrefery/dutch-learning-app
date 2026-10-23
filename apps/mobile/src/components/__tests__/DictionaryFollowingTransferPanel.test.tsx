import { prepareSharedFollowingImport } from '@/services/sharedFollowingImport'
import { createHash } from 'node:crypto'
import bundledPack from '@woordenaar/content'
import { validateOfficialContentManifest } from '@woordenaar/content/manifest'
import { prepareOfficialFollowingPack } from '@woordenaar/content/dictionary'
import { prepareOfficialFollowingImport } from '@/services/officialFollowingImport'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import * as Crypto from 'expo-crypto'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import {
  decideFollowingTransferRows,
  sharedCollectionFollowingSource,
  prepareFollowingImportRows,
  saveFollowingImportRows,
  parseFollowingTransferSession,
  parseDictionaryCollectionExportV2,
  type FollowingTransferSession,
  type FollowingImportOperation,
} from '@woordenaar/domain'
import {
  loadFollowingImport,
  loadFollowingExistingCard,
} from '@/services/dictionaryFollowingImportHydration'
import { DictionaryFollowingTransferPanel } from '../DictionaryFollowingTransferPanel'
import DictionaryDocumentImportScreen from '@/app/dictionary-import'
import { dictionaryFollowingTransferService as service } from '@/services/dictionaryFollowingTransferService'
import { dictionaryFollowingImportService as imports } from '@/services/dictionaryFollowingImportService'
import { importOfflineDictionaryCollection } from '@/services/dictionaryTransferService'
import { collectionRepository } from '@/db/collectionRepository'
import { wordRepository } from '@/db/wordRepository'
import { isDictionaryFollowingImportsEnabled } from '@/constants/dictionaryContent'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { supabase } from '@/lib/supabase'
import {
  transferSession,
  transferRevision,
  TRANSFER_ID,
} from '@/db/__tests__/dictionaryFollowingTransfer.fixture'
import {
  OWNER_A,
  OWNER_B,
  WORD_A,
  WORD_A2,
} from '@/db/__tests__/dictionaryFollowing.fixture'
import {
  COLLECTION_ID,
  IMPORT_ID,
  importReceipt,
  importState,
  importOperation,
  RECOVERY_ID,
  CANCEL_ID,
  recoveryReceipt,
  cancellationReceipt,
} from '@/db/__tests__/dictionaryFollowingImport.fixture'

jest.mock('@/services/sharedFollowingImport', () => ({
  prepareSharedFollowingImport: jest.fn(),
}))
jest.mock('@/services/officialFollowingImport', () => ({
  prepareOfficialFollowingImport: jest.fn(),
}))
jest.mock('@/services/dictionaryFollowingImportHydration', () => ({
  loadFollowingImport: jest.fn().mockResolvedValue(undefined),
  loadFollowingExistingCard: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }))
jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn() }))
jest.mock('expo-router', () => ({
  Color: { android: { dynamic: {} }, ios: {} },
  router: { replace: jest.fn() },
  Stack: { Screen: () => null },
}))
jest.mock('@/hooks/useNormalizedColorScheme', () => ({
  useNormalizedColorScheme: jest.fn(() => 'light'),
}))
jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryContentEnabled: () => true,
  isDictionaryFollowingImportsEnabled: jest.fn(() => true),
}))
jest.mock('@/services/dictionaryFollowingTransferService', () => ({
  dictionaryFollowingTransferService: {
    list: jest.fn(),
    prepare: jest.fn(),
    resolve: jest.fn(),
    queueEntry: jest.fn(),
    deliverEntry: jest.fn(),
  },
}))
jest.mock('@/services/dictionaryFollowingImportService', () => ({
  dictionaryFollowingImportService: {
    list: jest.fn(),
    readState: jest.fn(),
    prepare: jest.fn(),
    deliver: jest.fn(),
  },
}))
jest.mock('@/services/dictionaryTransferService', () => ({
  ...jest.requireActual('@/services/dictionaryTransferService'),
  importOfflineDictionaryCollection: jest.fn(),
}))
jest.mock('@/db/collectionRepository', () => ({
  collectionRepository: { getCollectionsByUserId: jest.fn() },
}))
jest.mock('@/db/wordRepository', () => ({
  wordRepository: { getWordsByUserId: jest.fn() },
}))
jest.mock('@/lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: jest.fn() } },
}))
jest.mock('@/stores/useApplicationStore', () => ({
  useApplicationStore: Object.assign(
    (select: (state: { currentUserId: string }) => unknown) =>
      select({ currentUserId: '11111111-1111-4111-8111-111111111111' }),
    { getState: jest.fn(), subscribe: jest.fn() }
  ),
}))
const FIRST = 'Select huis (1)'
const OPEN_SAVED = 'Open saved Protected original (1)'
const SAVE = 'Save selected document'
const VERIFY = 'Verify selected references'
const IMPORT = 'Import shared meaning (1)'
const CHECK = 'Check saved import status (1)'
const RECOVER = 'Recover saved import (1)'
const CANCEL = 'Cancel further import (1)'
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => {
    resolve = done
  })
  return { promise, resolve }
}
const target = [{ collection_id: COLLECTION_ID, name: 'Owned target' }]
describe.each(['light', 'dark'] as const)(
  '%s transfer2 selection and retained document UI',
  theme => {
    let sessions: FollowingTransferSession[]
    let operations: FollowingImportOperation[]
    let auth: (
      event: AuthChangeEvent,
      session: Session | null
    ) => void | Promise<void>
    beforeEach(() => {
      jest.clearAllMocks()
      sessions = []
      operations = []
      jest.mocked(useNormalizedColorScheme).mockReturnValue(theme)
      jest.mocked(isDictionaryFollowingImportsEnabled).mockReturnValue(true)
      jest.mocked(Crypto.randomUUID).mockReturnValue(TRANSFER_ID)
      jest
        .mocked(useApplicationStore.getState)
        .mockReturnValue({ currentUserId: OWNER_A } as never)
      jest.mocked(useApplicationStore.subscribe).mockReturnValue(() => {})
      jest.mocked(supabase.auth.onAuthStateChange).mockImplementation(fn => {
        auth = fn
        return { data: { subscription: { unsubscribe: jest.fn() } } } as never
      })
      jest.mocked(service.list).mockImplementation(async () => sessions)
      jest.mocked(imports.list).mockImplementation(async () => operations)
      jest.mocked(service.prepare).mockImplementation(async row => {
        sessions = [row]
        return row
      })
      jest.mocked(service.resolve).mockImplementation(async () => {
        sessions = decideFollowingTransferRows(
          sessions,
          sessions[0],
          [transferRevision],
          jest.fn().mockReturnValueOnce(IMPORT_ID).mockReturnValueOnce(WORD_A)
        )
        return sessions[0]
      })
      jest.mocked(service.queueEntry).mockImplementation(async () => {
        operations = [importOperation()]
        return operations[0]
      })
      jest.mocked(service.deliverEntry).mockImplementation(async () => {
        operations = [
          {
            ...importOperation(),
            result: importReceipt(),
          } as FollowingImportOperation,
        ]
        return operations[0]
      })
      jest.mocked(imports.prepare).mockImplementation(async row => {
        operations = prepareFollowingImportRows(operations, row)
        return operations.at(-1)!
      })
      jest.mocked(imports.deliver).mockImplementation(async row => {
        const receipt =
          row.kind === 'recover'
            ? { ...recoveryReceipt(), target_collection_id: COLLECTION_ID }
            : cancellationReceipt()
        operations = saveFollowingImportRows(operations, row, receipt)
        return operations.at(-1)!
      })
      jest.mocked(imports.readState).mockResolvedValue({
        ...importState(true),
        protocol_version: 2,
        state: 'active',
      })
      jest
        .mocked(collectionRepository.getCollectionsByUserId)
        .mockResolvedValue(target as never)
      jest.mocked(wordRepository.getWordsByUserId).mockResolvedValue([])
    })
    const show = () =>
      render(
        <DictionaryFollowingTransferPanel
          ownerId={OWNER_A}
          document={transferSession().document}
          collections={target}
          onClose={() => {}}
        />
      )
    const saved = async (view: ReturnType<typeof render>) => {
      await waitFor(() =>
        expect(
          view.getByLabelText(SAVE).props.accessibilityState.disabled
        ).toBe(false)
      )
      fireEvent.press(view.getByLabelText(SAVE))
      await waitFor(() => expect(view.getByLabelText(VERIFY)).toBeTruthy())
    }
    it('saves all shared originals with token and source IDs after explicit selection', async () => {
      const original = {
        schema_version: 2 as const,
        collection: {
          collection_id: OWNER_B,
          name: transferSession().document.collection.name,
        },
        words: transferSession().document.entries.map((entry, index) => ({
          ...entry,
          word_id: [WORD_A, IMPORT_ID, OWNER_A, OWNER_B][index],
        })),
      }
      const source = sharedCollectionFollowingSource(OWNER_B, original)
      jest.mocked(prepareSharedFollowingImport).mockResolvedValue(source)
      const view = render(
        <DictionaryFollowingTransferPanel
          ownerId={OWNER_A}
          sharedSource={{ shareToken: OWNER_B, original }}
          collections={target}
          onClose={() => {}}
        />
      )
      const first = `Select ${original.words[0].content.dutch_lemma} (1)`
      await waitFor(() =>
        expect(
          view.getByLabelText(first).props.accessibilityState.disabled
        ).toBe(false)
      )
      expect(prepareSharedFollowingImport).not.toHaveBeenCalled()
      fireEvent.press(view.getByLabelText(first))
      fireEvent.press(view.getByLabelText(SAVE))
      await waitFor(() => expect(service.prepare).toHaveBeenCalledTimes(1))
      const draft = jest.mocked(service.prepare).mock.calls[0][0]
      expect(draft.shared_collection).toEqual(source.shared_collection)
      expect(draft.document.entries).toHaveLength(4)
      expect(service.queueEntry).not.toHaveBeenCalled()
      fireEvent.press(view.getByLabelText(VERIFY))
      await waitFor(() => expect(service.resolve).toHaveBeenCalledTimes(1))
      expect(sessions[0].plan?.intents[0].intent.source).toMatchObject({
        kind: 'shared-collection',
        share_token: OWNER_B,
        word_id: WORD_A,
      })
      expect(service.deliverEntry).not.toHaveBeenCalled()
    })
    it('saves the official original and stable IDs only after an explicit selection', async () => {
      const validation = validateOfficialContentManifest(bundledPack)
      if (!validation.success) throw new Error('Invalid official fixture')
      const manifest = validation.data
      const source = await prepareOfficialFollowingPack(
        manifest,
        null,
        async value => createHash('sha256').update(value).digest('hex')
      )
      jest.mocked(prepareOfficialFollowingImport).mockResolvedValue({
        ...source,
        document: parseDictionaryCollectionExportV2(source.document),
      })
      const view = render(
        <DictionaryFollowingTransferPanel
          ownerId={OWNER_A}
          officialManifest={manifest}
          collections={target}
          onClose={() => {}}
        />
      )
      const first = `Select ${manifest.entries[0].dutch_lemma} (1)`
      await waitFor(() =>
        expect(view.getByText('Official shared pack import')).toBeTruthy()
      )
      await waitFor(() =>
        expect(
          view.getByLabelText(first).props.accessibilityState.disabled
        ).toBe(false)
      )
      expect(prepareOfficialFollowingImport).not.toHaveBeenCalled()
      expect(service.prepare).not.toHaveBeenCalled()
      fireEvent.press(view.getByLabelText(first))
      fireEvent.press(view.getByLabelText(SAVE))
      await waitFor(() => expect(service.prepare).toHaveBeenCalledTimes(1))
      const draft = jest.mocked(service.prepare).mock.calls[0][0]
      expect(draft.document).toEqual(source.document)
      expect(draft.official_pack).toEqual(source.official_pack)
      expect(draft.selected_indexes).toEqual([0])
      expect(service.queueEntry).not.toHaveBeenCalled()
      expect(service.deliverEntry).not.toHaveBeenCalled()
    })

    it('saves originals before explicit verification and imports only exact selected meanings', async () => {
      const view = show()
      await waitFor(() => expect(service.list).toHaveBeenCalled())
      expect(service.resolve).not.toHaveBeenCalled()
      expect(service.deliverEntry).not.toHaveBeenCalled()
      await waitFor(() =>
        expect(
          view.getByLabelText(FIRST).props.accessibilityState.disabled
        ).toBe(false)
      )
      fireEvent.press(view.getByLabelText(FIRST))
      fireEvent.press(view.getByLabelText('Select huis (2)'))
      await saved(view)
      expect(service.prepare).toHaveBeenCalledWith(
        expect.objectContaining({
          document: transferSession().document,
          selected_indexes: [0, 1],
        })
      )
      fireEvent.press(view.getByLabelText(VERIFY))
      await waitFor(() => expect(view.getByLabelText(IMPORT)).toBeTruthy())
      expect(view.queryByLabelText('Import shared meaning (2)')).toBeNull()
      fireEvent.press(view.getByLabelText(IMPORT))
      fireEvent.press(view.getByLabelText(IMPORT))
      await waitFor(() =>
        expect(view.getByText(/Server confirmed the import/)).toBeTruthy()
      )
      expect(loadFollowingImport).not.toHaveBeenCalled()
      fireEvent.press(view.getByLabelText('Load saved import (1)'))
      await waitFor(() =>
        expect(view.getByText('Imported card loaded.')).toBeTruthy()
      )
      expect(loadFollowingImport).toHaveBeenCalledWith(
        operations[0],
        expect.any(Function)
      )
      expect(service.deliverEntry).toHaveBeenCalledTimes(1)
      expect(importOfflineDictionaryCollection).not.toHaveBeenCalled()
    })
    it('restores saved receipt and permits an explicit state check when creation flags withdraw', async () => {
      sessions = decideFollowingTransferRows(
        [parseFollowingTransferSession(transferSession())],
        transferSession(),
        [transferRevision],
        jest.fn().mockReturnValueOnce(IMPORT_ID).mockReturnValueOnce(WORD_A)
      )
      operations = [
        {
          ...importOperation(),
          result: importReceipt(),
        } as FollowingImportOperation,
      ]
      jest.mocked(isDictionaryFollowingImportsEnabled).mockReturnValue(false)
      const view = show()
      await waitFor(() => expect(view.getByLabelText(OPEN_SAVED)).toBeTruthy())
      fireEvent.press(view.getByLabelText(OPEN_SAVED))
      expect(
        view.getByText(/Local dictionary loading is still required/)
      ).toBeTruthy()
      expect(view.queryByLabelText(IMPORT)).toBeNull()
      expect(imports.readState).not.toHaveBeenCalled()
      fireEvent.press(view.getByLabelText(CHECK))
      await waitFor(() =>
        expect(view.getByText(/Current server state: active/)).toBeTruthy()
      )
      expect(service.resolve).not.toHaveBeenCalled()
      expect(service.deliverEntry).not.toHaveBeenCalled()
    })
    it('offers explicit recovery with creation off and retains a lost reply for the same-ID retry', async () => {
      sessions = decideFollowingTransferRows(
        [parseFollowingTransferSession(transferSession())],
        transferSession(),
        [transferRevision],
        jest.fn().mockReturnValueOnce(IMPORT_ID).mockReturnValueOnce(WORD_A)
      )
      operations = [importOperation()]
      jest.mocked(isDictionaryFollowingImportsEnabled).mockReturnValue(false)
      jest.mocked(Crypto.randomUUID).mockReturnValue(RECOVERY_ID)
      jest.mocked(imports.deliver).mockRejectedValueOnce(new Error('Offline'))
      const view = show()
      await waitFor(() => expect(view.getByLabelText(OPEN_SAVED)).toBeTruthy())
      fireEvent.press(view.getByLabelText(OPEN_SAVED))
      expect(view.queryByLabelText(RECOVER)).toBeNull()
      fireEvent.press(view.getByLabelText(CHECK))
      await waitFor(() => expect(view.getByLabelText(RECOVER)).toBeTruthy())
      expect(
        view.getByLabelText(RECOVER).props.accessibilityState.disabled
      ).toBe(true)
      fireEvent.press(view.getByLabelText('Recover into Owned target (1)'))
      fireEvent.press(view.getByLabelText(RECOVER))
      await waitFor(() =>
        expect(view.getByLabelText('Retry saved recovery (1)')).toBeTruthy()
      )
      const pending = operations.at(-1)!
      expect(pending.result).toBeNull()
      expect(view.queryByLabelText(IMPORT)).toBeNull()
      fireEvent.press(view.getByLabelText('Retry saved recovery (1)'))
      await waitFor(() =>
        expect(view.getByText(/Server confirmed recovery/)).toBeTruthy()
      )
      expect(jest.mocked(imports.deliver).mock.calls[1][0]).toEqual(pending)
      expect(imports.prepare).toHaveBeenCalledTimes(1)
      expect(loadFollowingImport).not.toHaveBeenCalled()
      fireEvent.press(view.getByLabelText(CHECK))
      await waitFor(() => expect(view.getByLabelText(CANCEL)).toBeTruthy())
      jest.mocked(Crypto.randomUUID).mockReturnValue(CANCEL_ID)
      fireEvent.press(view.getByLabelText(CANCEL))
      await waitFor(() =>
        expect(
          view.getByText(/Further import and recovery are cancelled/)
        ).toBeTruthy()
      )
      expect(view.queryByLabelText(RECOVER)).toBeNull()
      expect(service.deliverEntry).not.toHaveBeenCalled()
    })
    it('does not offer recovery for an unavailable personal row but permits an explicit cancellation fence', async () => {
      sessions = decideFollowingTransferRows(
        [parseFollowingTransferSession(transferSession())],
        transferSession(),
        [transferRevision],
        jest.fn().mockReturnValueOnce(IMPORT_ID).mockReturnValueOnce(WORD_A)
      )
      operations = [importOperation()]
      jest.mocked(imports.readState).mockResolvedValueOnce({
        ...importState(true),
        state: 'unavailable',
        collection_id: null,
      } as never)
      const view = show()
      await waitFor(() => expect(view.getByLabelText(OPEN_SAVED)).toBeTruthy())
      fireEvent.press(view.getByLabelText(OPEN_SAVED))
      fireEvent.press(view.getByLabelText(CHECK))
      await waitFor(() =>
        expect(view.getByText(/Current server state: unavailable/)).toBeTruthy()
      )
      expect(view.queryByLabelText(RECOVER)).toBeNull()
      expect(
        view.getByLabelText(CANCEL).props.accessibilityState.disabled
      ).toBe(false)
      expect(imports.prepare).not.toHaveBeenCalled()
    })
    it('loads a saved existing-card conflict only on explicit action and keeps its receipt after offline retry', async () => {
      sessions = decideFollowingTransferRows(
        [parseFollowingTransferSession(transferSession())],
        transferSession(),
        [transferRevision],
        jest.fn().mockReturnValueOnce(IMPORT_ID).mockReturnValueOnce(WORD_A)
      )
      operations = saveFollowingImportRows(
        [importOperation()],
        importOperation(),
        {
          ...importReceipt(),
          outcome: 'identity-conflict',
          existing_word_id: WORD_A2,
          reference: null,
          applied_reference: null,
          applied_head_sequence: null,
        }
      )
      const before = operations[0]
      jest.mocked(isDictionaryFollowingImportsEnabled).mockReturnValue(false)
      jest
        .mocked(loadFollowingExistingCard)
        .mockRejectedValueOnce(new Error('Offline'))
      const view = show()
      await waitFor(() => expect(view.getByLabelText(OPEN_SAVED)).toBeTruthy())
      fireEvent.press(view.getByLabelText(OPEN_SAVED))
      expect(loadFollowingExistingCard).not.toHaveBeenCalled()
      expect(
        view.getByLabelText('Load saved import (1)').props.accessibilityState
          .disabled
      ).toBe(true)
      expect(view.queryByLabelText(IMPORT)).toBeNull()
      fireEvent.press(view.getByLabelText('Load existing card (1)'))
      await waitFor(() =>
        expect(view.getByText(/Could not finish this action/)).toBeTruthy()
      )
      expect(operations[0]).toEqual(before)
      fireEvent.press(view.getByLabelText('Load existing card (1)'))
      await waitFor(() =>
        expect(
          view.getByText('Existing card loaded. Learning was kept.')
        ).toBeTruthy()
      )
      expect(loadFollowingExistingCard).toHaveBeenCalledWith(
        before,
        expect.any(Function)
      )
      expect(loadFollowingImport).not.toHaveBeenCalled()
      expect(service.deliverEntry).not.toHaveBeenCalled()
    })
    it('stops the dispatch chain after unmount and hides originals after Auth ABA', async () => {
      const view = show()
      await waitFor(() =>
        expect(
          view.getByLabelText(FIRST).props.accessibilityState.disabled
        ).toBe(false)
      )
      fireEvent.press(view.getByLabelText(FIRST))
      await saved(view)
      fireEvent.press(view.getByLabelText(VERIFY))
      await waitFor(() => expect(view.getByLabelText(IMPORT)).toBeTruthy())
      const pending = deferred<FollowingImportOperation>()
      jest.mocked(service.queueEntry).mockReturnValueOnce(pending.promise)
      fireEvent.press(view.getByLabelText(IMPORT))
      view.unmount()
      await act(async () => pending.resolve(importOperation()))
      expect(service.deliverEntry).not.toHaveBeenCalled()
      const restored = show()
      await waitFor(() =>
        expect(restored.getByLabelText(OPEN_SAVED)).toBeTruthy()
      )
      fireEvent.press(restored.getByLabelText(OPEN_SAVED))
      await act(async () => {
        await auth('SIGNED_IN', { user: { id: OWNER_B } } as Session)
        await auth('SIGNED_IN', { user: { id: OWNER_A } } as Session)
      })
      expect(restored.getByText(/session changed/)).toBeTruthy()
      expect(restored.queryByText('Protected original')).toBeNull()
    })
    it('routes schema2 through shared selection without the legacy duplicate/private-copy path', async () => {
      const view = render(<DictionaryDocumentImportScreen />)
      fireEvent.changeText(
        view.getByLabelText('Collection JSON'),
        JSON.stringify(transferSession().document)
      )
      fireEvent.press(view.getByLabelText('Preview document'))
      await waitFor(() =>
        expect(view.getByText('Shared collection import')).toBeTruthy()
      )
      expect(wordRepository.getWordsByUserId).not.toHaveBeenCalled()
      expect(importOfflineDictionaryCollection).not.toHaveBeenCalled()
      expect(service.deliverEntry).not.toHaveBeenCalled()
    })
  }
)

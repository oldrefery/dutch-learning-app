import { prepareSharedFollowingImport } from './shared-following-import'
import { createHash } from 'node:crypto'
import bundledPack from '@woordenaar/content'
import { validateOfficialContentManifest } from '@woordenaar/content/manifest'
import { prepareOfficialFollowingPack } from '@woordenaar/content/dictionary'
import { prepareOfficialFollowingImport } from '@/features/starter-pack/official-following-import'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
import { createClient } from '@/lib/supabase/client'
import {
  loadWebFollowingImport,
  loadWebFollowingExistingCard,
} from './following-import-hydration'
import { DictionaryFollowingTransferPanel } from './DictionaryFollowingTransferPanel'
import { DictionaryDocumentImport } from './DictionaryDocumentImport'
import { createWebFollowingTransferService } from './following-transfer-client'
import { createWebFollowingImportService } from './following-import-client'
import { requestDictionaryTransfer } from './dictionary-transfer-contract'
import {
  TRANSFER_OWNER,
  TRANSFER_OTHER,
  TRANSFER_ID,
  TRANSFER_WORD,
  TRANSFER_OPERATION,
  transferSession,
  transferRevision,
  transferReceipt,
} from './__fixtures__/following-transfer'

jest.mock('./shared-following-import', () => ({
  prepareSharedFollowingImport: jest.fn(),
}))
jest.mock('@/features/starter-pack/official-following-import', () => ({
  prepareOfficialFollowingImport: jest.fn(),
}))
jest.mock('./following-import-hydration', () => ({
  loadWebFollowingImport: jest.fn().mockResolvedValue(undefined),
  loadWebFollowingExistingCard: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('next/navigation', () => {
  const router = { refresh: jest.fn() }
  return { useRouter: () => router }
})
jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
jest.mock('./following-transfer-client', () => ({
  createWebFollowingTransferService: jest.fn(),
}))
jest.mock('./following-import-client', () => ({
  createWebFollowingImportService: jest.fn(),
}))
jest.mock('./dictionary-transfer-contract', () => ({
  ...jest.requireActual('./dictionary-transfer-contract'),
  requestDictionaryTransfer: jest.fn(),
}))
const SAVE = 'Save selected document'
const VERIFY = 'Verify selected references'
const IMPORT = 'Import shared meaning (1)'
const CHECK = 'Check saved import status (1)'
const RECOVERY = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const CANCELLATION = 'ffffffff-ffff-4fff-8fff-ffffffffffff'
const target = [{ id: TRANSFER_OTHER, name: 'Owned target' }]
const originalUUID = Object.getOwnPropertyDescriptor(crypto, 'randomUUID')
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => {
    resolve = done
  })
  return { promise, resolve }
}
describe('web explicit shared document selection and retained status UI', () => {
  let sessions: FollowingTransferSession[]
  let operations: FollowingImportOperation[]
  let listeners: ((
    event: string,
    session: { user: { id: string } } | null
  ) => void)[]
  const prepare = jest.fn(async (row: FollowingTransferSession) => {
    sessions = [row]
    return row
  })
  const resolve = jest.fn(async () => {
    sessions = decideFollowingTransferRows(
      sessions,
      sessions[0],
      [transferRevision],
      jest
        .fn()
        .mockReturnValueOnce(TRANSFER_OPERATION)
        .mockReturnValueOnce(TRANSFER_WORD)
    )
    return sessions[0]
  })
  const queue = jest.fn(async (): Promise<FollowingImportOperation> => {
    const row: FollowingImportOperation = {
      user_id: TRANSFER_OWNER,
      kind: 'import',
      request: sessions[0].plan!.intents[0].intent,
      result: null,
    }
    operations = [row]
    return row
  })
  const deliver = jest.fn(async () => {
    operations = [
      {
        ...operations[0],
        result: {
          ...transferReceipt(),
          protocol_version: 2,
          outcome: 'inserted',
        },
      } as FollowingImportOperation,
    ]
    return operations[0]
  })
  const readState = jest.fn(async () => ({
    protocol_version: 2,
    original_operation_id: TRANSFER_OPERATION,
    word_id: TRANSFER_WORD,
    recovery_version: 0,
    inserted_once: true,
    state: 'active',
    collection_id: TRANSFER_OTHER,
  }))
  const prepareOperation = jest.fn(async (row: FollowingImportOperation) => {
    operations = prepareFollowingImportRows(operations, row)
    return operations.at(-1)!
  })
  const deliverOperation = jest.fn(async (row: FollowingImportOperation) => {
    const identity = {
      protocol_version: 2,
      operation_id: row.request.operation_id,
      original_operation_id: TRANSFER_OPERATION,
      word_id: TRANSFER_WORD,
      recovery_version: 1,
      idempotent: false,
    }
    const result =
      row.kind === 'recover'
        ? {
            ...identity,
            outcome: 'applied',
            existing_word_id: null,
            target_collection_id: TRANSFER_OTHER,
          }
        : { ...identity, outcome: 'cancelled' }
    operations = saveFollowingImportRows(operations, row, result)
    return operations.at(-1)!
  })
  const show = () =>
    render(
      <DictionaryFollowingTransferPanel
        ownerId={TRANSFER_OWNER}
        document={transferSession().document}
        collections={target}
        followingEnabled
        onClose={() => {}}
      />
    )
  const selectAndSave = async () => {
    await waitFor(() =>
      expect(
        screen.getByRole('checkbox', { name: 'Select huis (1)' })
      ).toBeEnabled()
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select huis (1)' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select huis (2)' }))
    fireEvent.click(screen.getByRole('button', { name: SAVE }))
    await screen.findByRole('button', { name: VERIFY })
  }
  beforeEach(() => {
    jest.clearAllMocks()
    sessions = []
    operations = []
    listeners = []
    process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED = 'true'
    Object.defineProperty(crypto, 'randomUUID', {
      configurable: true,
      value: jest.fn(() => TRANSFER_ID),
    })
    jest.mocked(createClient).mockReturnValue({
      auth: {
        onAuthStateChange: (callback: (typeof listeners)[number]) => {
          listeners.push(callback)
          callback('INITIAL_SESSION', { user: { id: TRANSFER_OWNER } })
          return { data: { subscription: { unsubscribe: jest.fn() } } }
        },
      },
    } as never)
    jest.mocked(createWebFollowingTransferService).mockReturnValue({
      list: async () => sessions,
      prepare,
      resolve,
      queueEntry: queue,
      deliverEntry: deliver,
    } as never)
    jest.mocked(createWebFollowingImportService).mockReturnValue({
      list: async () => operations,
      readState,
      prepare: prepareOperation,
      deliver: deliverOperation,
    } as never)
    prepare.mockImplementation(async row => {
      sessions = [row]
      return row
    })
    resolve.mockImplementation(async () => {
      sessions = decideFollowingTransferRows(
        sessions,
        sessions[0],
        [transferRevision],
        jest
          .fn()
          .mockReturnValueOnce(TRANSFER_OPERATION)
          .mockReturnValueOnce(TRANSFER_WORD)
      )
      return sessions[0]
    })
    queue.mockImplementation(async () => {
      const row: FollowingImportOperation = {
        user_id: TRANSFER_OWNER,
        kind: 'import',
        request: sessions[0].plan!.intents[0].intent,
        result: null,
      }
      operations = [row]
      return row
    })
    deliver.mockImplementation(async () => {
      operations = [
        {
          ...operations[0],
          result: {
            ...transferReceipt(),
            protocol_version: 2,
            outcome: 'inserted',
          },
        } as FollowingImportOperation,
      ]
      return operations[0]
    })
  })
  afterEach(() => {
    if (originalUUID) Object.defineProperty(crypto, 'randomUUID', originalUUID)
    delete process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED
  })
  it('saves shared token and source IDs only after explicit selection, then uses the existing verified import flow', async () => {
    const original = {
      schema_version: 2 as const,
      collection: {
        collection_id: TRANSFER_OTHER,
        name: transferSession().document.collection.name,
      },
      words: transferSession().document.entries.map((entry, index) => ({
        ...entry,
        word_id: [
          TRANSFER_WORD,
          TRANSFER_OPERATION,
          TRANSFER_OWNER,
          TRANSFER_OTHER,
        ][index],
      })),
    }
    const source = sharedCollectionFollowingSource(TRANSFER_OTHER, original)
    jest.mocked(prepareSharedFollowingImport).mockResolvedValue(source)
    render(
      <DictionaryFollowingTransferPanel
        ownerId={TRANSFER_OWNER}
        sharedSource={{ shareToken: TRANSFER_OTHER, original }}
        collections={target}
        followingEnabled
        onClose={() => {}}
      />
    )
    const first = `Select ${original.words[0].content.dutch_lemma} (1)`
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: first })).toBeEnabled()
    )
    expect(prepareSharedFollowingImport).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('checkbox', { name: first }))
    fireEvent.click(screen.getByRole('button', { name: SAVE }))
    await waitFor(() => expect(prepare).toHaveBeenCalledTimes(1))
    expect(sessions[0].shared_collection).toEqual(source.shared_collection)
    expect(sessions[0].document.entries).toHaveLength(4)
    expect(queue).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: VERIFY }))
    await waitFor(() => expect(resolve).toHaveBeenCalledTimes(1))
    expect(sessions[0].plan?.intents[0].intent.source).toMatchObject({
      kind: 'shared-collection',
      share_token: TRANSFER_OTHER,
      word_id: TRANSFER_WORD,
    })
    expect(deliver).not.toHaveBeenCalled()
  })
  it('saves official provenance only after selecting a stable pack entry', async () => {
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
    render(
      <DictionaryFollowingTransferPanel
        ownerId={TRANSFER_OWNER}
        officialManifest={manifest}
        collections={target}
        followingEnabled
        onClose={() => {}}
      />
    )
    const first = `Select ${manifest.entries[0].dutch_lemma} (1)`
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: first })).toBeEnabled()
    )
    expect(prepareOfficialFollowingImport).not.toHaveBeenCalled()
    expect(prepare).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('checkbox', { name: first }))
    fireEvent.click(screen.getByRole('button', { name: SAVE }))
    await waitFor(() => expect(prepare).toHaveBeenCalledTimes(1))
    expect(sessions[0].official_pack).toEqual(source.official_pack)
    expect(sessions[0].document).toEqual(source.document)
    expect(sessions[0].selected_indexes).toEqual([0])
    expect(queue).not.toHaveBeenCalled()
    expect(deliver).not.toHaveBeenCalled()
  })

  it('mounts without network actions, retains all content and only offers verified selected imports', async () => {
    show()
    await selectAndSave()
    expect(prepare).toHaveBeenCalledWith(
      expect.objectContaining({
        document: transferSession().document,
        selected_indexes: [0, 1],
      })
    )
    expect(resolve).not.toHaveBeenCalled()
    expect(deliver).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: VERIFY }))
    await screen.findByRole('button', { name: IMPORT })
    expect(
      screen.queryByRole('button', { name: 'Import shared meaning (2)' })
    ).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'View saved original document' })
    )
    expect(
      JSON.parse(
        (
          screen.getByLabelText(
            'Saved original document'
          ) as HTMLTextAreaElement
        ).value
      )
    ).toEqual(transferSession().document)
    fireEvent.click(screen.getByRole('button', { name: IMPORT }))
    fireEvent.click(screen.getByRole('button', { name: IMPORT }))
    await screen.findByText(/Server confirmed the import/)
    expect(loadWebFollowingImport).not.toHaveBeenCalled()
    fireEvent.click(
      screen.getByRole('button', { name: 'Load saved import (1)' })
    )
    await screen.findByText('Imported card loaded. Page refresh requested.')
    expect(loadWebFollowingImport).toHaveBeenCalledWith(
      operations[0],
      true,
      expect.any(Function),
      expect.any(Function)
    )
    expect(deliver).toHaveBeenCalledTimes(1)
    expect(requestDictionaryTransfer).not.toHaveBeenCalled()
  })
  it('restores saved requests without automatic re-dispatch and permits same-ID state checks with gates off', async () => {
    sessions = decideFollowingTransferRows(
      [parseFollowingTransferSession(transferSession())],
      transferSession(),
      [transferRevision],
      jest
        .fn()
        .mockReturnValueOnce(TRANSFER_OPERATION)
        .mockReturnValueOnce(TRANSFER_WORD)
    )
    operations = [
      {
        user_id: TRANSFER_OWNER,
        kind: 'import',
        request: sessions[0].plan!.intents[0].intent,
        result: {
          ...transferReceipt(),
          protocol_version: 2,
          outcome: 'inserted',
        },
      },
    ]
    delete process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED
    show()
    await screen.findByRole('option', { name: 'Protected original (1)' })
    fireEvent.change(screen.getByLabelText('Saved documents'), {
      target: { value: TRANSFER_ID },
    })
    expect(
      screen.getByText(/Local dictionary loading is still required/)
    ).toBeInTheDocument()
    expect(deliver).not.toHaveBeenCalled()
    expect(readState).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: CHECK }))
    await screen.findByText(/Current server state: active/)
    expect(readState).toHaveBeenCalledWith(operations[0], expect.any(Function))
    expect(resolve).not.toHaveBeenCalled()
  })
  it('stops after unmount during reservation and latches A-to-B-to-A without exposing old originals', async () => {
    const view = show()
    await selectAndSave()
    fireEvent.click(screen.getByRole('button', { name: VERIFY }))
    await screen.findByRole('button', { name: IMPORT })
    const pending = deferred<FollowingImportOperation>()
    queue.mockReturnValueOnce(pending.promise)
    fireEvent.click(screen.getByRole('button', { name: IMPORT }))
    view.unmount()
    await act(async () =>
      pending.resolve({
        user_id: TRANSFER_OWNER,
        kind: 'import',
        request: sessions[0].plan!.intents[0].intent,
        result: null,
      })
    )
    expect(deliver).not.toHaveBeenCalled()
    show()
    await screen.findByRole('option', { name: 'Protected original (1)' })
    fireEvent.change(screen.getByLabelText('Saved documents'), {
      target: { value: TRANSFER_ID },
    })
    act(() => {
      listeners.forEach(fn => fn('SIGNED_IN', { user: { id: TRANSFER_OTHER } }))
      listeners.forEach(fn => fn('SIGNED_IN', { user: { id: TRANSFER_OWNER } }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent('session changed')
    expect(
      screen.queryByRole('heading', { name: 'Protected original' })
    ).not.toBeInTheDocument()
  })
  it('stops a reserved dispatch when the server creation flag withdraws', async () => {
    const view = show()
    await selectAndSave()
    fireEvent.click(screen.getByRole('button', { name: VERIFY }))
    await screen.findByRole('button', { name: IMPORT })
    const pending = deferred<FollowingImportOperation>()
    queue.mockReturnValueOnce(pending.promise)
    fireEvent.click(screen.getByRole('button', { name: IMPORT }))
    view.rerender(
      <DictionaryFollowingTransferPanel
        ownerId={TRANSFER_OWNER}
        document={transferSession().document}
        collections={target}
        followingEnabled={false}
        onClose={() => {}}
      />
    )
    const row: FollowingImportOperation = {
      user_id: TRANSFER_OWNER,
      kind: 'import',
      request: sessions[0].plan!.intents[0].intent,
      result: null,
    }
    operations = [row]
    await act(async () => pending.resolve(row))
    expect(deliver).not.toHaveBeenCalled()
    expect(operations).toEqual([row])
    await screen.findByRole('option', { name: 'Protected original (1)' })
    fireEvent.change(screen.getByLabelText('Saved documents'), {
      target: { value: TRANSFER_ID },
    })
    expect(
      screen.getByText(/server result is not confirmed/)
    ).toBeInTheDocument()
  })
  it('requires explicit placement selection and retries a lost recovery with the saved ID while creation is off', async () => {
    sessions = decideFollowingTransferRows(
      [parseFollowingTransferSession(transferSession())],
      transferSession(),
      [transferRevision],
      jest
        .fn()
        .mockReturnValueOnce(TRANSFER_OPERATION)
        .mockReturnValueOnce(TRANSFER_WORD)
    )
    operations = [
      {
        user_id: TRANSFER_OWNER,
        kind: 'import',
        request: sessions[0].plan!.intents[0].intent,
        result: null,
      },
    ]
    process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED = 'false'
    jest.mocked(crypto.randomUUID).mockReturnValue(RECOVERY)
    deliverOperation.mockRejectedValueOnce(new Error('Lost response'))
    show()
    await screen.findByRole('option', { name: 'Protected original (1)' })
    fireEvent.change(screen.getByLabelText('Saved documents'), {
      target: { value: TRANSFER_ID },
    })
    expect(
      screen.queryByRole('button', { name: 'Recover saved import (1)' })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: CHECK }))
    const recover = await screen.findByRole('button', {
      name: 'Recover saved import (1)',
    })
    expect(recover).toBeDisabled()
    fireEvent.change(
      screen.getByLabelText(/Choose a collection for recovery/),
      { target: { value: TRANSFER_OTHER } }
    )
    fireEvent.click(recover)
    const retry = await screen.findByRole('button', {
      name: 'Retry saved recovery (1)',
    })
    const pending = operations.at(-1)!
    expect(pending.result).toBeNull()
    expect(
      screen.queryByRole('button', { name: IMPORT })
    ).not.toBeInTheDocument()
    fireEvent.click(retry)
    await screen.findByText(/Server confirmed recovery/)
    expect(deliverOperation.mock.calls[1][0]).toEqual(pending)
    expect(prepareOperation).toHaveBeenCalledTimes(1)
    expect(loadWebFollowingImport).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: CHECK }))
    const cancel = await screen.findByRole('button', {
      name: 'Cancel further import (1)',
    })
    jest.mocked(crypto.randomUUID).mockReturnValue(CANCELLATION)
    fireEvent.click(cancel)
    await screen.findByText(/Further import and recovery are cancelled/)
    expect(
      screen.queryByRole('button', { name: 'Recover saved import (1)' })
    ).not.toBeInTheDocument()
    expect(deliver).not.toHaveBeenCalled()
  })
  it('offers a deliberate existing-card load for retained identity conflicts with creation off', async () => {
    sessions = decideFollowingTransferRows(
      [parseFollowingTransferSession(transferSession())],
      transferSession(),
      [transferRevision],
      jest
        .fn()
        .mockReturnValueOnce(TRANSFER_OPERATION)
        .mockReturnValueOnce(TRANSFER_WORD)
    )
    const pending: FollowingImportOperation = {
      user_id: TRANSFER_OWNER,
      kind: 'import',
      request: sessions[0].plan!.intents[0].intent,
      result: null,
    }
    operations = saveFollowingImportRows([pending], pending, {
      ...transferReceipt(),
      outcome: 'identity-conflict',
      existing_word_id: RECOVERY,
      reference: null,
      applied_reference: null,
      applied_head_sequence: null,
    })
    const before = operations[0]
    process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED = 'false'
    jest
      .mocked(loadWebFollowingExistingCard)
      .mockRejectedValueOnce(new Error('Offline'))
    show()
    await screen.findByRole('option', { name: 'Protected original (1)' })
    fireEvent.change(screen.getByLabelText('Saved documents'), {
      target: { value: TRANSFER_ID },
    })
    expect(loadWebFollowingExistingCard).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Load saved import (1)' })
    ).toBeDisabled()
    fireEvent.click(
      screen.getByRole('button', { name: 'Load existing card (1)' })
    )
    await screen.findByRole('alert')
    expect(operations[0]).toEqual(before)
    fireEvent.click(
      screen.getByRole('button', { name: 'Load existing card (1)' })
    )
    await screen.findByText(
      'Existing card verified. Page refresh requested. Learning was kept.'
    )
    expect(loadWebFollowingExistingCard).toHaveBeenCalledWith(
      before,
      true,
      expect.any(Function),
      expect.any(Function)
    )
    expect(loadWebFollowingImport).not.toHaveBeenCalled()
    expect(deliver).not.toHaveBeenCalled()
  })
  it('routes schema2 to shared selection and leaves v1 requests unchanged', async () => {
    render(
      <DictionaryDocumentImport
        ownerId={TRANSFER_OWNER}
        collections={target}
        existingWords={[]}
        followingEnabled
      />
    )
    fireEvent.change(screen.getByLabelText('JSON document'), {
      target: { value: JSON.stringify(transferSession().document) },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Preview words' }))
    await screen.findByRole('heading', { name: 'Shared collection import' })
    expect(requestDictionaryTransfer).not.toHaveBeenCalled()
    expect(deliver).not.toHaveBeenCalled()
  })
  it('shows errors with the saved document retained and offers an explicit verification retry', async () => {
    show()
    await selectAndSave()
    resolve.mockRejectedValueOnce(new Error('Offline'))
    fireEvent.click(screen.getByRole('button', { name: VERIFY }))
    await screen.findByRole('alert')
    expect(sessions[0].plan).toBeNull()
    expect(screen.getByRole('button', { name: VERIFY })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: VERIFY }))
    await screen.findByRole('button', { name: IMPORT })
    expect(deliver).not.toHaveBeenCalled()
  })
})

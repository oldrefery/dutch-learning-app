import { waitFor } from '@testing-library/react-native'
import {
  createDictionaryFollowingTransferAction,
  decideFollowingTransferRows,
  prepareFollowingTransferRows,
  prepareFollowingImportRows,
  saveFollowingImportRows,
  followingTransferEntryMessage,
  type FollowingTransferSession,
  type FollowingImportOperation,
  type DictionaryImportRecoveryStateV2,
} from '@woordenaar/domain'
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
  IMPORT_ID,
  importReceipt,
  importState,
  cancellationOperation,
  recoveryReceipt,
  cancellationReceipt,
  RECOVERY_ID,
  CANCEL_ID,
  TARGET_ID,
} from '@/db/__tests__/dictionaryFollowingImport.fixture'

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => {
    resolve = done
  })
  return { promise, resolve }
}
describe('following transfer UI lifetime and explicit dispatch boundaries', () => {
  let sessions: FollowingTransferSession[]
  let operations: FollowingImportOperation[]
  let invalidate: () => void
  let enabled: boolean
  const createPorts = () => ({
    load: jest.fn(
      async (_value: FollowingImportOperation, assertCurrent: () => void) => {
        assertCurrent()
      }
    ),
    loadExisting: jest.fn(
      async (_value: FollowingImportOperation, assertCurrent: () => void) => {
        assertCurrent()
      }
    ),
    userId: OWNER_A,
    enabled: () => enabled,
    createId: jest.fn(() => TRANSFER_ID),
    targetCollections: () => [TARGET_ID],
    prepareOperation: jest.fn(
      async (row: FollowingImportOperation, assertCurrent: () => void) => {
        assertCurrent()
        operations = prepareFollowingImportRows(operations, row)
        return operations.at(-1)!
      }
    ),
    deliverOperation: jest.fn(
      async (row: FollowingImportOperation, assertCurrent: () => void) => {
        assertCurrent()
        operations = saveFollowingImportRows(
          operations,
          row,
          row.kind === 'recover' ? recoveryReceipt() : cancellationReceipt()
        )
        return operations.at(-1)!
      }
    ),
    list: jest.fn(async () => sessions),
    listOperations: jest.fn(async () => operations),
    prepare: jest.fn(async (row: FollowingTransferSession) => {
      sessions = prepareFollowingTransferRows(sessions, row)
      return sessions.find(item => item.session_id === row.session_id)!
    }),
    resolve: jest.fn(async (id: string) => {
      const row = sessions.find(row => row.session_id === id)!
      sessions = decideFollowingTransferRows(
        sessions,
        row,
        [transferRevision],
        jest.fn().mockReturnValueOnce(IMPORT_ID).mockReturnValueOnce(WORD_A)
      )
      return sessions[0]
    }),
    queueEntry: jest.fn(async (id: string, index: number) => {
      const intent = sessions
        .find(row => row.session_id === id)!
        .plan!.intents.find(row => row.index === index)!.intent
      const row: FollowingImportOperation = {
        user_id: OWNER_A,
        kind: 'import',
        request: intent,
        result: null,
      }
      operations = prepareFollowingImportRows(operations, row)
      return operations.find(
        item => item.request.operation_id === intent.operation_id
      )!
    }),
    deliverEntry: jest.fn(async () => {
      operations = saveFollowingImportRows(
        operations,
        operations[0],
        importReceipt()
      )
      return operations[0]
    }),
    readState: jest.fn(async (): Promise<DictionaryImportRecoveryStateV2> => ({
      ...importState(true),
      protocol_version: 2,
      state: 'active',
    })),
  })
  const mount = async (ports = createPorts()) => {
    const action = createDictionaryFollowingTransferAction(ports)
    const stop = action.start(fn => {
      invalidate = fn
      return () => {}
    })
    await waitFor(() => expect(action.getSnapshot().busy).toBe(false))
    return { action, ports, stop }
  }
  const prepare = async (
    action: ReturnType<typeof createDictionaryFollowingTransferAction>
  ) => {
    const {
      user_id: _owner,
      session_id: _session,
      plan: _plan,
      ...input
    } = transferSession()
    await action.prepare(input)
    await action.resolve()
  }
  beforeEach(() => {
    sessions = []
    operations = []
    enabled = true
  })
  it.each(['unmount', 'owner', 'gate', 'content', 'target'] as const)(
    'does not reserve an official source after %s changes during preparation',
    async failure => {
      const targets = [TARGET_ID]
      const ports = { ...createPorts(), targetCollections: () => targets }
      const input = { ...transferSession(), collection_id: TARGET_ID }
      const pending =
        deferred<Pick<FollowingTransferSession, 'document' | 'official_pack'>>()
      const prepareSource = jest.fn(async (guard: () => void) => {
        const result = await pending.promise
        guard()
        return result
      })
      const action = createDictionaryFollowingTransferAction({
        ...ports,
        prepareSource,
      })
      const stop = action.start(fn => {
        invalidate = fn
        return () => {}
      })
      await waitFor(() => expect(action.getSnapshot().loaded).toBe(true))
      expect(prepareSource).not.toHaveBeenCalled()
      const running = action.prepare(input)
      if (failure === 'unmount') stop()
      if (failure === 'owner') invalidate()
      if (failure === 'gate') enabled = false
      if (failure === 'target') targets.length = 0
      const document =
        failure === 'content'
          ? {
              ...input.document,
              entries: input.document.entries.map(entry => ({
                ...entry,
                content: { ...entry.content, dutch_original: 'Changed' },
              })),
            }
          : input.document
      pending.resolve({
        document,
        official_pack: {
          pack_id: 'official-pack',
          version: '1.0.0',
          manifest_sha256: 'a'.repeat(64),
          entry_ids: ['a', 'b', 'c', 'd'],
        },
      })
      await running
      expect(ports.prepare).not.toHaveBeenCalled()
      expect(ports.queueEntry).not.toHaveBeenCalled()
      expect(ports.deliverEntry).not.toHaveBeenCalled()
      stop()
    }
  )

  it('mount/reload read local metadata without dependency checks, queuing or dispatch', async () => {
    const { action, ports } = await mount()
    await action.reload()
    expect(ports.list).toHaveBeenCalledTimes(2)
    expect(ports.resolve).not.toHaveBeenCalled()
    expect(ports.queueEntry).not.toHaveBeenCalled()
    expect(ports.deliverEntry).not.toHaveBeenCalled()
    expect(ports.readState).not.toHaveBeenCalled()
  })
  it('saves the full original before explicit verification and reservation/delivery', async () => {
    const { action, ports } = await mount()
    await prepare(action)
    expect(sessions[0].document).toEqual(transferSession().document)
    expect(operations).toEqual([])
    await action.deliver(0)
    expect(ports.queueEntry.mock.invocationCallOrder[0]).toBeLessThan(
      ports.deliverEntry.mock.invocationCallOrder[0]
    )
    expect(operations[0].result).toEqual(importReceipt())
    expect(followingTransferEntryMessage(sessions[0], 0, operations)).toContain(
      'Local dictionary loading is still required'
    )
  })
  it('loads explicitly after restart, retains failed receipts, and fences late UI completion', async () => {
    const { action, ports, stop } = await mount()
    await prepare(action)
    await action.deliver(0)
    const original = operations[0]
    ports.load.mockRejectedValueOnce(new Error('Offline'))
    await action.load(0)
    expect(action.getSnapshot().loadedImports[IMPORT_ID]).toBe(false)
    expect(operations[0]).toEqual(original)
    stop()
    const resumed = await mount(ports)
    resumed.action.select(TRANSFER_ID)
    expect(ports.load).toHaveBeenCalledTimes(1)
    await resumed.action.load(0)
    expect(resumed.action.getSnapshot().loadedImports[IMPORT_ID]).toBe(true)
    ports.load.mockImplementationOnce(async (_value, assertCurrent) => {
      invalidate()
      assertCurrent()
    })
    await resumed.action.load(0)
    expect(resumed.action.getSnapshot().loadedImports).toEqual({})
    expect(resumed.action.getSnapshot().blocked).toBe(true)
    expect(ports.deliverEntry).toHaveBeenCalledTimes(1)
  })
  it('deduplicates rapid import clicks and never sends review/unselected entries', async () => {
    const { action, ports } = await mount()
    await prepare(action)
    await Promise.all([action.deliver(0), action.deliver(0), action.deliver(0)])
    expect(ports.deliverEntry).toHaveBeenCalledTimes(1)
    await action.deliver(1)
    await action.deliver(2)
    await action.deliver(3)
    expect(ports.deliverEntry).toHaveBeenCalledTimes(1)
    expect(sessions[0].document.entries).toHaveLength(4)
  })
  it('recovers durable metadata after a lost reply without automatic dispatch on recreation', async () => {
    const { action, ports, stop } = await mount()
    await prepare(action)
    ports.deliverEntry.mockRejectedValueOnce(new Error('Lost reply'))
    await action.deliver(0)
    const original = operations[0].request
    stop()
    const recreated = await mount(ports)
    recreated.action.select(TRANSFER_ID)
    expect(ports.deliverEntry).toHaveBeenCalledTimes(1)
    expect(recreated.action.getSnapshot().operations[0].result).toBeNull()
    await recreated.action.deliver(0)
    expect(operations[0].request).toEqual(original)
    expect(ports.queueEntry).toHaveBeenCalledTimes(1)
  })
  it('leaves a saved draft when verification fails and requires explicit retry', async () => {
    const { action, ports } = await mount()
    ports.resolve.mockRejectedValueOnce(new Error('Offline'))
    await prepare(action)
    expect(sessions[0].plan).toBeNull()
    expect(action.getSnapshot().error).toContain('retained')
    expect(ports.deliverEntry).not.toHaveBeenCalled()
    await action.resolve()
    expect(sessions[0].plan?.intents).toHaveLength(1)
  })
  it('blocks dispatch after owner invalidation between local reservation and remote call', async () => {
    const { action, ports } = await mount()
    await prepare(action)
    const original = ports.queueEntry.getMockImplementation()!
    ports.queueEntry.mockImplementationOnce(async (id, index) => {
      const value = await original(id, index)
      invalidate()
      return value
    })
    await action.deliver(0)
    expect(ports.deliverEntry).not.toHaveBeenCalled()
    expect(operations).toHaveLength(1)
    expect(action.getSnapshot().blocked).toBe(true)
    expect(action.getSnapshot().sessions).toEqual([])
  })
  it('does not dispatch an old action after effect stop/start during reservation', async () => {
    const { action, ports, stop } = await mount()
    await prepare(action)
    const pending = deferred<FollowingImportOperation>()
    ports.queueEntry.mockReturnValueOnce(pending.promise)
    const running = action.deliver(0)
    stop()
    const stopAgain = action.start(fn => {
      invalidate = fn
      return () => {}
    })
    await waitFor(() => expect(action.getSnapshot().busy).toBe(false))
    pending.resolve({
      user_id: OWNER_A,
      kind: 'import',
      request: sessions[0].plan!.intents[0].intent,
      result: null,
    })
    await running
    expect(ports.deliverEntry).not.toHaveBeenCalled()
    expect(action.getSnapshot().loaded).toBe(true)
    stopAgain()
  })
  it('retains saved requests if flags withdraw between queue and delivery', async () => {
    const { action, ports } = await mount()
    await prepare(action)
    const original = ports.queueEntry.getMockImplementation()!
    ports.queueEntry.mockImplementationOnce(async (id, index) => {
      const value = await original(id, index)
      enabled = false
      return value
    })
    await action.deliver(0)
    expect(ports.deliverEntry).not.toHaveBeenCalled()
    expect(operations).toHaveLength(1)
    await action.check(0)
    expect(ports.readState).toHaveBeenCalledTimes(1)
  })
  it('checks only a saved same-ID state and fences cancelled/deleted or recovery-held requests', async () => {
    const { action, ports } = await mount()
    await prepare(action)
    await action.queue(0)
    ports.readState.mockResolvedValueOnce({
      ...importState(true),
      protocol_version: 2,
      state: 'unavailable',
      collection_id: null,
    })
    await action.check(0)
    await action.deliver(0)
    expect(ports.deliverEntry).not.toHaveBeenCalled()
    operations = prepareFollowingImportRows(operations, cancellationOperation())
    await action.reload()
    await action.deliver(0)
    expect(ports.deliverEntry).not.toHaveBeenCalled()
  })
  it('rejects mismatched owners and saved targets while allowing explicit metadata reload after failure', async () => {
    const ports = createPorts()
    ports.list.mockResolvedValueOnce([
      { ...transferSession(), user_id: OWNER_B },
    ])
    const { action } = await mount(ports)
    expect(action.getSnapshot().error).toContain('retained')
    expect(action.getSnapshot().sessions).toEqual([])
    await action.reload()
    expect(action.getSnapshot().error).toBeNull()
    const original = ports.prepare.getMockImplementation()!
    ports.prepare.mockImplementationOnce(async row => ({
      ...(await original(row)),
      collection_id: OWNER_B,
    }))
    await prepare(action)
    expect(action.getSnapshot().selectedSessionId).toBeNull()
    expect(ports.resolve).not.toHaveBeenCalled()
  })
  const checked = async () => {
    const mounted = await mount()
    await prepare(mounted.action)
    await mounted.action.queue(0)
    await mounted.action.check(0)
    mounted.ports.createId.mockReturnValue(RECOVERY_ID)
    return mounted
  }
  it('requires a checked state and an explicit owned destination; preserves placement/version and learning authority', async () => {
    const { action, ports } = await mount()
    await prepare(action)
    await action.queue(0)
    await action.recover(0, TARGET_ID)
    expect(ports.prepareOperation).not.toHaveBeenCalled()
    await action.check(0)
    await action.recover(0, OWNER_B)
    expect(ports.prepareOperation).not.toHaveBeenCalled()
    ports.createId.mockReturnValue(RECOVERY_ID)
    enabled = false
    await Promise.all([
      action.recover(0, TARGET_ID),
      action.recover(0, TARGET_ID),
    ])
    expect(ports.prepareOperation).toHaveBeenCalledTimes(1)
    expect(operations.at(-1)).toEqual(
      expect.objectContaining({
        kind: 'recover',
        request: expect.objectContaining({
          operation_id: RECOVERY_ID,
          original_intent: operations[0].request,
          expected_recovery_version: 0,
          expected_collection_id: importState(true).collection_id,
          target_collection_id: TARGET_ID,
        }),
      })
    )
    expect(ports.deliverEntry).not.toHaveBeenCalled()
    expect(ports.load).not.toHaveBeenCalled()
    expect(action.getSnapshot().remoteStates).toEqual({})
    expect(followingTransferEntryMessage(sessions[0], 0, operations)).toContain(
      'Server confirmed recovery'
    )
  })
  it('retains a lost recovery response and retries the identical request after restart without a new nonce', async () => {
    const { action, ports, stop } = await checked()
    ports.deliverOperation.mockRejectedValueOnce(new Error('Offline'))
    await action.recover(0, TARGET_ID)
    const pending = operations.at(-1)!
    expect(pending.result).toBeNull()
    await action.recover(0, TARGET_ID)
    await action.cancel(0)
    await action.deliver(0)
    expect(ports.prepareOperation).toHaveBeenCalledTimes(1)
    expect(ports.deliverEntry).not.toHaveBeenCalled()
    stop()
    const resumed = await mount(ports)
    resumed.action.select(TRANSFER_ID)
    expect(ports.deliverOperation).toHaveBeenCalledTimes(1)
    await resumed.action.retryOperation(0)
    expect(ports.deliverOperation.mock.calls[1][0]).toEqual(pending)
    expect(ports.createId).toHaveBeenCalledTimes(2) // document and one recovery
    expect(operations).toHaveLength(2)
  })
  it('retries pending cancellation with creation off and permanently fences original delivery', async () => {
    const { action, ports } = await checked()
    ports.createId.mockReturnValue(CANCEL_ID)
    enabled = false
    ports.deliverOperation.mockRejectedValueOnce(new Error('Lost reply'))
    await action.cancel(0)
    const pending = operations.at(-1)!
    await action.retryOperation(0)
    expect(ports.deliverOperation.mock.calls[1][0]).toEqual(pending)
    await action.check(0)
    await action.recover(0, TARGET_ID)
    await action.cancel(0)
    await action.deliver(0)
    expect(ports.prepareOperation).toHaveBeenCalledTimes(1)
    expect(operations.at(-1)?.result?.outcome).toBe('cancelled')
    expect(followingTransferEntryMessage(sessions[0], 0, operations)).toContain(
      'Existing cards'
    )
    expect(ports.deliverEntry).not.toHaveBeenCalled()
  })
  it.each(['state-conflict', 'placement-conflict'] as const)(
    'shows %s and requires another status check before a new destination attempt',
    async outcome => {
      const { action, ports } = await checked()
      ports.deliverOperation.mockImplementationOnce(async (row, guard) => {
        guard()
        const state = {
          ...importState(true),
          protocol_version: 2,
          recovery_version: outcome === 'state-conflict' ? 1 : 0,
          collection_id: TARGET_ID,
        }
        const {
          recovery_version: _version,
          idempotent: _idempotent,
          existing_word_id: _existing,
          ...identity
        } = recoveryReceipt()
        operations = saveFollowingImportRows(operations, row, {
          ...identity,
          outcome,
          state,
        })
        return operations.at(-1)!
      })
      await action.recover(0, TARGET_ID)
      expect(operations.at(-1)?.result?.outcome).toBe(outcome)
      expect(
        followingTransferEntryMessage(sessions[0], 0, operations)
      ).toContain('Check status')
      await action.recover(0, TARGET_ID)
      expect(ports.prepareOperation).toHaveBeenCalledTimes(1)
      expect(ports.load).not.toHaveBeenCalled()
      await action.check(0)
      ports.createId.mockReturnValue(CANCEL_ID)
      ports.deliverOperation.mockRejectedValueOnce(new Error('Offline'))
      await action.recover(0, TARGET_ID)
      expect(operations).toHaveLength(3)
    }
  )
  it('never recovers unavailable/deleted or cancelled rows and keeps uncreated recovery gated', async () => {
    const { action, ports } = await checked()
    for (const remote of [
      { ...importState(true), state: 'unavailable', collection_id: null },
      {
        ...importState(true),
        state: 'cancelled',
        recovery_version: 1,
        collection_id: null,
      },
      importState(false),
    ]) {
      enabled = false
      ports.readState.mockResolvedValueOnce(
        remote as DictionaryImportRecoveryStateV2
      )
      await action.check(0)
      await action.recover(0, TARGET_ID)
    }
    expect(ports.prepareOperation).not.toHaveBeenCalled()
    expect(operations).toHaveLength(1)
  })
  it('discards a prior placement snapshot when a new explicit state check fails offline', async () => {
    const { action, ports } = await checked()
    ports.readState.mockRejectedValueOnce(new Error('Offline'))
    await action.check(0)
    expect(action.getSnapshot().remoteStates).toEqual({})
    await action.recover(0, TARGET_ID)
    expect(ports.prepareOperation).not.toHaveBeenCalled()
    expect(operations).toHaveLength(1)
  })
  it.each(['unmount', 'owner ABA'] as const)(
    'retains recovery reservation without dispatch after %s',
    async reason => {
      const { action, ports, stop } = await checked()
      const reserve = ports.prepareOperation.getMockImplementation()!
      ports.prepareOperation.mockImplementationOnce(async (row, guard) => {
        const saved = await reserve(row, guard)
        if (reason === 'unmount') stop()
        else invalidate()
        return saved
      })
      await action.recover(0, TARGET_ID)
      expect(operations.at(-1)?.result).toBeNull()
      expect(ports.deliverOperation).not.toHaveBeenCalled()
      expect(action.getSnapshot().loadedImports[IMPORT_ID]).not.toBe(true)
    }
  )
  it('only loads an existing conflict card explicitly, preserves receipts after offline restart and fences owner changes', async () => {
    const { action, ports, stop } = await checked()
    operations = saveFollowingImportRows(operations, operations[0], {
      ...importReceipt(),
      outcome: 'identity-conflict',
      existing_word_id: WORD_A2,
      reference: null,
      applied_reference: null,
      applied_head_sequence: null,
    })
    await action.reload()
    const original = operations[0]
    expect(ports.loadExisting).not.toHaveBeenCalled()
    ports.loadExisting.mockRejectedValueOnce(new Error('Offline'))
    await action.loadExisting(0)
    expect(action.getSnapshot().loadedImports[IMPORT_ID]).toBe(false)
    expect(operations[0]).toEqual(original)
    stop()
    const resumed = await mount(ports)
    resumed.action.select(TRANSFER_ID)
    await resumed.action.loadExisting(0)
    expect(resumed.action.getSnapshot().loadedImports[IMPORT_ID]).toBe(true)
    expect(ports.load).not.toHaveBeenCalled()
    expect(ports.deliverEntry).not.toHaveBeenCalled()
    ports.loadExisting.mockImplementationOnce(async (_value, guard) => {
      invalidate()
      guard()
    })
    await resumed.action.loadExisting(0)
    expect(resumed.action.getSnapshot().blocked).toBe(true)
    expect(resumed.action.getSnapshot().loadedImports).toEqual({})
  })
})

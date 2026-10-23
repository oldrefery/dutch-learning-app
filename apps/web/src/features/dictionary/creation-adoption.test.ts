import { createBrowserDictionaryCreationJournal } from './creation-journal'
import { createBrowserFollowingImportJournal } from '@/features/sharing/following-import-journal'
import type {
  DictionaryCreationJournal,
  FollowingImportJournal,
} from '@woordenaar/domain'
let journal: DictionaryCreationJournal, imports: FollowingImportJournal
let data: Map<string, string>, tails: Map<string, Promise<unknown>>
const withLock = async <T>(name: string, action: () => Promise<T>) => {
  const before = tails.get(name) ?? Promise.resolve()
  const next = before.catch(() => {}).then(action)
  tails.set(name, next)
  return next
}
const restartJournals = () => {
  const storage = {
    getItem: (name: string) => data.get(name) ?? null,
    setItem: (name: string, value: string) => {
      data.set(name, value)
    },
  }
  journal = createBrowserDictionaryCreationJournal({ storage, withLock })
  imports = createBrowserFollowingImportJournal({ storage, withLock })
}
const initializeJournals = () => {
  data = new Map()
  tails = new Map()
  restartJournals()
}
const closeJournals = () => {}
import {
  createDictionaryCreationAdoptionService,
  type DictionaryCreationJournalRow,
  type DictionaryAnalysisAuth,
  type DictionaryImportRecoveryStateV2,
  type FollowingImportRemote,
  type DictionaryImportReceiptV2,
} from '@woordenaar/domain'
import {
  CREATION_OWNER as OWNER,
  CREATION_OTHER as OTHER,
  creationUuid as id,
  creationJournalFixture as initial,
  creationPreparedFixture as prepared,
  creationPublishedFixture as published,
  creationOwnerFixture,
} from '../../../../../packages/domain/src/dictionary-creation-journal.fixture'

const APPLY = 'apply_dictionary_import_intent_v2'
const CHECK = 'read_dictionary_import_recovery_v2'
const CAPABILITY = 'dictionary_content_capability_v2'
const LOST = 'Lost reply'
const target = { operation_id: id(7), word_id: id(8), collection_id: id(9) }
const receipt = (conflict = false): DictionaryImportReceiptV2 => {
  const base = {
    protocol_version: 2 as const,
    operation_id: id(7),
    word_id: id(8),
    idempotent: false,
  }
  return conflict
    ? {
        ...base,
        outcome: 'identity-conflict',
        existing_word_id: id(10),
        reference: null,
        applied_reference: null,
        applied_head_sequence: null,
      }
    : {
        ...base,
        outcome: 'inserted',
        existing_word_id: null,
        reference: { entry_id: id(5), revision_id: id(6) },
        applied_reference: { entry_id: id(5), revision_id: id(6) },
        applied_head_sequence: '9007199254740995',
      }
}

describe('creation adoption bridges durable personal-import journals', () => {
  const owner = creationOwnerFixture()
  let row: DictionaryCreationJournalRow
  let enabled: boolean, serverEnabled: boolean, mounted: boolean
  let current: string | null, controller: AbortController
  let listeners: Set<Parameters<DictionaryAnalysisAuth['onAuthStateChange']>[0]>
  let state: DictionaryImportRecoveryStateV2
  let result: DictionaryImportReceiptV2 | null
  let service: ReturnType<typeof createDictionaryCreationAdoptionService>
  let signals: AbortSignal[]
  const load = jest.fn<
    Promise<void>,
    Parameters<
      Parameters<typeof createDictionaryCreationAdoptionService>[0]['load']
    >
  >()
  const rpc = jest.fn<
    ReturnType<FollowingImportRemote['rpc']>,
    Parameters<FollowingImportRemote['rpc']>
  >()
  const emit = (next: string | null) => {
    current = next
    listeners.forEach(listener =>
      listener(
        next ? 'SIGNED_IN' : 'SIGNED_OUT',
        next ? { user: { id: next } } : null
      )
    )
  }
  const auth: DictionaryAnalysisAuth = {
    onAuthStateChange: listener => {
      listeners.add(listener)
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              listeners.delete(listener)
            },
          },
        },
      }
    },
    getUser: async () => ({
      data: { user: current ? { id: current } : null },
      error: null,
    }),
  }
  const makeService = () =>
    createDictionaryCreationAdoptionService({
      userId: OWNER,
      enabled: () => enabled,
      signal: controller.signal,
      assertCurrent: () => {
        if (!mounted) throw new Error('Context changed')
      },
      connect: () => ({
        auth,
        journal,
        imports,
        remote: signal => {
          signals.push(signal)
          return { rpc }
        },
      }),
      load,
    })
  const read = () =>
    journal.read(OWNER, initial().session.request.resolution_id, owner)
  const original = async () => {
    const fresh = await journal.prepare(initial(), owner)
    const resolved = await journal.save(fresh, prepared(fresh), owner)
    const submitted = (await journal.claim(resolved, owner)).row
    return journal.save(submitted, published(submitted), owner)
  }
  const prepare = () => service.prepare(row, target)
  const deliver = async () => service.submit(await prepare())
  const defaultRpc: FollowingImportRemote['rpc'] = async (name, args) => {
    if (name === CAPABILITY)
      return {
        data: {
          dictionary_content_protocol: 2,
          read_protocol_versions: [1, 2],
          command_protocol_versions: [1, 2],
          following_enabled: serverEnabled,
          shared_analysis_enabled: false,
        },
        error: null,
      }
    if (name === CHECK) return { data: { ...state }, error: null }
    if (name !== APPLY) throw new Error('Unexpected RPC')
    expect(args).toEqual({ p_intent: (await read())!.adoption!.request })
    expect((await read())!.adoption!.submitted).toBe(true)
    expect(await imports.list(OWNER)).toHaveLength(1)
    if (!result) {
      result = receipt()
      state = {
        ...state,
        inserted_once: true,
        state: 'active',
        collection_id: id(9),
      }
    }
    return { data: result, error: null }
  }
  beforeEach(async () => {
    initializeJournals()
    enabled = serverEnabled = mounted = true
    current = OWNER
    controller = new AbortController()
    listeners = new Set()
    signals = []
    result = null
    state = {
      protocol_version: 2,
      original_operation_id: id(7),
      word_id: id(8),
      recovery_version: 0,
      inserted_once: false,
      state: 'uncreated',
      collection_id: null,
    }
    load.mockReset().mockResolvedValue(undefined)
    rpc.mockReset().mockImplementation(defaultRpc)
    service = makeService()
    row = await original()
  })
  afterEach(() => {
    expect(listeners.size).toBe(0)
    closeJournals()
  })
  const restart = () => {
    restartJournals()
    service = makeService()
  }
  const applyCount = () =>
    rpc.mock.calls.filter(([name]) => name === APPLY).length
  it('constructs without I/O; publication alone does not import or load', () => {
    expect(rpc).not.toHaveBeenCalled()
    expect(load).not.toHaveBeenCalled()
    expect(row.adoption).toBeNull()
  })
  it('persists the exact distinct nonce and target in both journals before delivery', async () => {
    const reserved = await prepare()
    expect(reserved.adoption!.request).toEqual({
      protocol_version: 2,
      ...target,
      source: {
        kind: 'published-reference',
        reference: { entry_id: id(5), revision_id: id(6) },
        content_sha256: 'b'.repeat(64),
      },
    })
    expect(applyCount()).toBe(0)
    const added = await service.submit(reserved)
    restart()
    expect(await read()).toEqual(added)
    expect(added.adoption!.response).toEqual(receipt())
    expect(added.session).toEqual(row.session)
    expect(load).not.toHaveBeenCalled()
  })
  it('rejects nonpublication, nonce reuse and changed destination without delivery', async () => {
    const unready = await journal.prepare(initial(2), owner)
    await expect(service.prepare(unready, target)).rejects.toThrow('published')
    await expect(
      service.prepare(row, {
        ...target,
        operation_id: row.session.command!.operation_id,
      })
    ).rejects.toThrow()
    const saved = await prepare()
    await expect(
      service.prepare(saved, { ...target, collection_id: id(99) })
    ).rejects.toThrow('immutable')
    expect(applyCount()).toBe(0)
  })
  it('repairs a crash between journal writes using the original saved IDs', async () => {
    const spy = jest
      .spyOn(imports, 'prepare')
      .mockRejectedValueOnce(new Error('Storage failed'))
    await expect(prepare()).rejects.toThrow('Storage failed')
    spy.mockRestore()
    expect((await read())!.adoption!.request).toMatchObject(target)
    expect(await imports.list(OWNER)).toEqual([])
    restart()
    const added = await service.submit((await read())!)
    expect(added.adoption!.response?.outcome).toBe('inserted')
    expect(applyCount()).toBe(1)
  })
  it('allows only one fresh delivery claim across two service instances', async () => {
    const reserved = await prepare()
    const outcomes = await Promise.allSettled([
      service.submit(reserved),
      makeService().submit(reserved),
    ])
    expect(outcomes.some(value => value.status === 'fulfilled')).toBe(true)
    expect(applyCount()).toBe(1)
    expect((await read())!.adoption!.submitted).toBe(true)
  })
  it('never automatically resends a submitted import after a lost response and restart', async () => {
    rpc.mockImplementation(async (name, args) => {
      const value = await defaultRpc(name, args)
      if (name === APPLY) throw new Error(LOST)
      return value
    })
    const reserved = await prepare()
    await expect(service.submit(reserved)).rejects.toThrow(LOST)
    restart()
    await service.submit((await read())!)
    const checked = await service.check((await read())!)
    expect(checked.state.inserted_once).toBe(true)
    expect(checked.row.adoption!.response).toBeNull()
    expect(applyCount()).toBe(1)
    expect(load).not.toHaveBeenCalled()
  })
  it('explicitly recovers the original receipt with new-work flags off after confirmed insertion', async () => {
    rpc.mockImplementation(async (name, args) => {
      const value = await defaultRpc(name, args)
      if (name === APPLY) throw new Error(LOST)
      return value
    })
    await expect(deliver()).rejects.toThrow(LOST)
    rpc.mockImplementation(defaultRpc)
    enabled = serverEnabled = false
    restart()
    const saved = await service.confirm((await read())!)
    expect(saved.adoption!.response).toEqual(receipt())
    expect(applyCount()).toBe(2)
    expect(rpc.mock.calls.at(-1)?.[0]).toBe(APPLY)
    expect(load).not.toHaveBeenCalled()
  })
  it('does not deliver an unconfirmed insertion when new-work flags are off', async () => {
    rpc.mockImplementation(async (name, args) =>
      name === APPLY
        ? { data: null, error: new Error('Offline') }
        : defaultRpc(name, args)
    )
    await expect(deliver()).rejects.toThrow('Offline')
    enabled = false
    const saved = (await read())!
    expect((await service.check(saved)).state.state).toBe('uncreated')
    await expect(service.confirm(saved)).rejects.toThrow('unavailable')
    expect(applyCount()).toBe(1)
  })
  it('bridges a receipt already saved in the import journal without any second apply', async () => {
    const reserved = await prepare()
    const claim = (await journal.claimAdoption(reserved, owner)).row
    const operation = (await imports.list(OWNER))[0]
    await imports.save(operation, receipt(), owner.assert)
    restart()
    expect((await service.confirm(claim)).adoption!.response).toEqual(receipt())
    expect(applyCount()).toBe(0)
  })
  it('requires a real receipt and independently retries loading without redelivery', async () => {
    const reserved = await prepare()
    await expect(service.load(reserved)).rejects.toThrow('Confirm')
    const added = await service.submit(reserved)
    load.mockRejectedValueOnce(new Error('Cache offline'))
    await expect(service.load(added)).rejects.toThrow('Cache offline')
    expect((await read())!.adoption!.response).toEqual(receipt())
    restart()
    expect(await service.load((await read())!)).toEqual(added)
    expect(applyCount()).toBe(1)
    expect(load).toHaveBeenCalledTimes(2)
    expect((await read())!).not.toHaveProperty('hydrated')
  })
  it('separates conflict existing-card loading from newly imported completion', async () => {
    result = receipt(true)
    const added = await deliver()
    await service.load(added, 'existing')
    expect(load.mock.calls[0][2]).toBe('existing')
    expect(added.adoption!.response?.outcome).toBe('identity-conflict')
    expect(applyCount()).toBe(1)
  })
  it.each(['cancelled', 'moved', 'version'] as const)(
    'fences %s placement before receipt recovery',
    async mode => {
      rpc.mockImplementation(async (name, args) => {
        const value = await defaultRpc(name, args)
        if (name === APPLY) throw new Error(LOST)
        return value
      })
      await expect(deliver()).rejects.toThrow(LOST)
      rpc.mockImplementation(defaultRpc)
      if (mode === 'cancelled')
        state = { ...state, state: 'cancelled', recovery_version: 1 }
      if (mode === 'moved') state.collection_id = id(99)
      if (mode === 'version') state.recovery_version = 1
      await expect(service.confirm((await read())!)).rejects.toThrow(
        'placement changed'
      )
      expect(applyCount()).toBe(1)
    }
  )
  it('fences registered recovery metadata before load or original replay', async () => {
    const added = await deliver()
    await imports.prepare(
      {
        user_id: OWNER,
        kind: 'cancel',
        result: null,
        request: {
          protocol_version: 2,
          operation_id: id(20),
          original_intent: added.adoption!.request,
        },
      },
      owner.assert
    )
    await expect(service.load(added)).rejects.toThrow('recovery changed')
    await expect(service.confirm(added)).rejects.toThrow('recovery changed')
    expect(load).not.toHaveBeenCalled()
    expect(applyCount()).toBe(1)
  })
  it.each(['auth', 'mounted'] as const)(
    'aborts %s lifetime at apply and retains submitted intent for explicit recovery',
    async mode => {
      rpc.mockImplementation(async (name, args) => {
        const value = await defaultRpc(name, args)
        if (name === APPLY) {
          const signal = signals.at(-1)!
          expect(signal.aborted).toBe(false)
          if (mode === 'auth') {
            emit(OTHER)
            emit(OWNER)
          } else controller.abort()
          expect(signal.aborted).toBe(true)
        }
        return value
      })
      await expect(deliver()).rejects.toThrow(
        mode === 'auth' ? 'Authentication changed' : 'context changed'
      )
      controller = new AbortController()
      rpc.mockImplementation(defaultRpc)
      restart()
      expect((await read())!.adoption!.submitted).toBe(true)
      expect((await read())!.adoption!.response).toBeNull()
      expect(
        (await service.confirm((await read())!)).adoption!.response
      ).toEqual(receipt())
    }
  )
  it('rejects a foreign owner before reading or calling RPC', async () => {
    emit(OTHER)
    await expect(prepare()).rejects.toThrow('Authentication changed')
    expect(rpc).not.toHaveBeenCalled()
    expect((await read())!.adoption).toBeNull()
  })
  it('rechecks placement after successful cache reads before reporting completion', async () => {
    const added = await deliver()
    load.mockImplementation(async () => {
      state.collection_id = id(99)
    })
    await expect(service.load(added)).rejects.toThrow('placement changed')
    expect((await read())!.adoption!.response).toEqual(receipt())
    expect(applyCount()).toBe(1)
  })
  it('rejects stale owner after loading and never reports late completion', async () => {
    const added = await deliver()
    load.mockImplementation(async (_row, assert) => {
      emit(OTHER)
      emit(OWNER)
      assert()
    })
    await expect(service.load(added)).rejects.toThrow('Authentication changed')
    expect((await read())!.adoption!.response).toEqual(receipt())
  })
})

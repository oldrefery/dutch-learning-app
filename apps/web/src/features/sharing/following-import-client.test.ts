import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import {
  parseDictionaryImportIntentV2,
  type FollowingImportOperation,
} from '@woordenaar/domain'
import { createClient } from '@/lib/supabase/client'
import { createWebFollowingImportService } from './following-import-client'
import { createBrowserFollowingImportJournal } from './following-import-journal'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
const OWNER = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const WORD = '33333333-3333-4333-8333-333333333333'
const OPERATION = '44444444-4444-4444-8444-444444444444'
const REFERENCE = {
  entry_id: '55555555-5555-4555-8555-555555555555',
  revision_id: '66666666-6666-4666-8666-666666666666',
}
const ROOT = parseDictionaryImportIntentV2({
  protocol_version: 2,
  operation_id: OPERATION,
  word_id: WORD,
  collection_id: OTHER,
  source: {
    kind: 'published-reference',
    reference: REFERENCE,
    content_sha256: 'a'.repeat(64),
  },
})
const operation = (): FollowingImportOperation => ({
  user_id: OWNER,
  kind: 'import',
  request: ROOT,
  result: null,
})
const capability = {
  dictionary_content_protocol: 2,
  read_protocol_versions: [1, 2],
  command_protocol_versions: [1, 2],
  following_enabled: true,
  shared_analysis_enabled: false,
}
const receipt = {
  protocol_version: 2,
  operation_id: OPERATION,
  word_id: WORD,
  outcome: 'inserted',
  idempotent: false,
  existing_word_id: null,
  reference: REFERENCE,
  applied_reference: REFERENCE,
  applied_head_sequence: '9007199254740993',
}
const state = {
  protocol_version: 2,
  original_operation_id: OPERATION,
  word_id: WORD,
  recovery_version: 0,
  inserted_once: true,
  state: 'active',
  collection_id: OTHER,
}
const rpc = jest.fn()
const getUser = jest.fn()
const getSession = jest.fn()
const unsubscribe = jest.fn()
let callback: (event: AuthChangeEvent, session: Session | null) => void
const onAuthStateChange = jest.fn(fn => {
  callback = fn
  return { data: { subscription: { unsubscribe } } }
})
const locks = {
  request: jest.fn(
    async (_name: string, _options: unknown, action: () => Promise<unknown>) =>
      action()
  ),
}

describe('web authenticated following import service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: locks,
    })
    process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED = 'true'
    jest.mocked(createClient).mockReturnValue({
      rpc,
      auth: { getUser, getSession, onAuthStateChange },
    } as never)
    getSession.mockResolvedValue({
      data: { session: { user: { id: OWNER } } },
      error: null,
    })
    getUser.mockResolvedValue({ data: { user: { id: OWNER } }, error: null })
    rpc.mockImplementation(async (name: string) => ({
      data:
        name === 'dictionary_content_capability_v2'
          ? capability
          : name === 'read_dictionary_import_recovery_v2'
            ? state
            : receipt,
      error: null,
    }))
  })
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED
    Reflect.deleteProperty(navigator, 'locks')
  })
  it('queues locally from a cached session when server getUser is offline', async () => {
    getUser.mockRejectedValue(new Error('Offline'))
    const service = createWebFollowingImportService(OWNER, true)
    const queued = await service.queue(operation())
    expect(await service.list()).toEqual([queued])
    expect(rpc).not.toHaveBeenCalled()
    expect(getUser).not.toHaveBeenCalled()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
  it('is inert until explicit prepare and resumes a saved import through a new service instance', async () => {
    const first = createWebFollowingImportService(OWNER, true)
    expect(createClient).not.toHaveBeenCalled()
    const saved = await first.prepare(operation())
    const second = createWebFollowingImportService(OWNER, true)
    expect(await second.list()).toEqual([saved])
    expect((await second.deliver(saved)).result).toEqual(receipt)
    expect(rpc).toHaveBeenCalledWith('apply_dictionary_import_intent_v2', {
      p_intent: ROOT,
    })
    expect(unsubscribe).toHaveBeenCalledTimes(2)
  })
  it('reads state after flags withdraw and never chooses private-copy imports', async () => {
    const first = createWebFollowingImportService(OWNER, true)
    const saved = await first.prepare(operation())
    delete process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED
    const service = createWebFollowingImportService(OWNER, false)
    expect(await service.readState(saved)).toEqual(state)
    await expect(service.deliver(saved)).rejects.toThrow('unavailable')
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'dictionary_content_capability_v2',
      'read_dictionary_import_recovery_v2',
    ])
  })
  it('latches account ABA during response delivery and leaves the exact root pending', async () => {
    const service = createWebFollowingImportService(OWNER, true)
    const saved = await service.prepare(operation())
    rpc.mockImplementation(async (name: string) => {
      if (name === 'dictionary_content_capability_v2')
        return { data: capability, error: null }
      callback('SIGNED_IN', { user: { id: OTHER } } as Session)
      callback('SIGNED_IN', { user: { id: OWNER } } as Session)
      return { data: receipt, error: null }
    })
    await expect(service.deliver(saved)).rejects.toThrow(
      'Authentication changed'
    )
    expect(await service.list()).toEqual([saved])
  })
  it('fails closed without Web Locks and does not alter existing storage', async () => {
    localStorage.setItem('legacy-v1', 'preserved')
    Reflect.deleteProperty(navigator, 'locks')
    await expect(
      createWebFollowingImportService(OWNER, true).prepare(operation())
    ).rejects.toThrow('storage is unavailable')
    expect(localStorage.getItem('legacy-v1')).toBe('preserved')
    expect(rpc).not.toHaveBeenCalled()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
  it('isolates two owners and rejects a foreign row before dispatch', async () => {
    const service = createWebFollowingImportService(OWNER, true)
    await expect(
      service.prepare({ ...operation(), user_id: OTHER })
    ).rejects.toThrow('owner mismatch')
    const readOnly = createBrowserFollowingImportJournal({
      storage: localStorage,
      withLock: async (_name, action) => action(),
    })
    expect(await readOnly.list(OTHER)).toEqual([])
    expect(rpc).not.toHaveBeenCalled()
  })
  const recovery = (kind: 'recover' | 'cancel'): FollowingImportOperation =>
    kind === 'cancel'
      ? {
          user_id: OWNER,
          kind,
          result: null,
          request: {
            protocol_version: 2,
            operation_id: REFERENCE.entry_id,
            original_intent: ROOT,
          },
        }
      : {
          user_id: OWNER,
          kind,
          result: null,
          request: {
            protocol_version: 2,
            operation_id: REFERENCE.entry_id,
            original_intent: ROOT,
            expected_recovery_version: 0,
            expected_collection_id: OTHER,
            target_collection_id: OTHER,
          },
        }
  const recoveryResult = (kind: 'recover' | 'cancel') => ({
    protocol_version: 2,
    operation_id: REFERENCE.entry_id,
    original_operation_id: OPERATION,
    word_id: WORD,
    recovery_version: 1,
    idempotent: false,
    ...(kind === 'cancel'
      ? { outcome: 'cancelled' }
      : {
          outcome: 'applied',
          target_collection_id: OTHER,
          existing_word_id: null,
        }),
  })
  it.each(['recover', 'cancel'] as const)(
    'retains %s browser nonce across restart and unknown outcomes with creation off',
    async kind => {
      const first = createWebFollowingImportService(OWNER, true)
      await first.queue(operation())
      process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED = 'false'
      const saved = await first.prepare(recovery(kind))
      rpc.mockImplementation(async (name: string) =>
        name === 'read_dictionary_import_recovery_v2'
          ? { data: state, error: null }
          : { data: null, error: new Error('Lost response') }
      )
      await expect(first.deliver(saved)).rejects.toThrow('Lost response')
      const second = createWebFollowingImportService(OWNER, false)
      expect((await second.list()).at(-1)).toEqual(saved)
      rpc.mockImplementation(async (name: string) => ({
        data:
          name === 'read_dictionary_import_recovery_v2'
            ? state
            : recoveryResult(kind),
        error: null,
      }))
      expect((await second.deliver(saved)).result).toEqual(recoveryResult(kind))
      expect(rpc).toHaveBeenCalledWith(
        kind === 'recover'
          ? 'recover_dictionary_import_v2'
          : 'cancel_dictionary_import_v2',
        { p_request: saved.request }
      )
      expect(
        rpc.mock.calls.some(
          ([name]) =>
            name === 'apply_dictionary_import_intent_v2' ||
            name === 'dictionary_content_capability_v2'
        )
      ).toBe(false)
    }
  )
  it.each(['recover', 'cancel'] as const)(
    'fences %s journal result after the view closes during RPC',
    async kind => {
      const service = createWebFollowingImportService(OWNER, true)
      await service.queue(operation())
      const saved = await service.prepare(recovery(kind))
      let active = true
      const guard = () => {
        if (!active) throw new Error('View closed')
      }
      rpc.mockImplementation(async (name: string) => {
        if (name === 'read_dictionary_import_recovery_v2')
          return { data: state, error: null }
        active = false
        return { data: recoveryResult(kind), error: null }
      })
      await expect(service.deliver(saved, guard)).rejects.toThrow('View closed')
      expect((await service.list()).at(-1)).toEqual(saved)
      await expect(service.readState(saved, guard)).rejects.toThrow(
        'View closed'
      )
    }
  )
})

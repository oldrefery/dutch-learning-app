import type {
  DictionaryAnalysisClientOperation,
  DictionaryAnalysisReceiptV2,
} from '@woordenaar/domain'
import { createClient } from '@/lib/supabase/client'
import { createWebDictionaryAnalysisService } from './analysis-client'
import { followingBatch } from './__fixtures__/following'

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn() }))
const OWNER = '44444444-4444-4444-8444-444444444444'
const FOREIGN = '55555555-5555-4555-8555-555555555555'
const OP = '66666666-6666-4666-8666-666666666666'
const REVISION = '77777777-7777-4777-8777-777777777777'
const CAPABILITY = 'dictionary_content_capability_v2'
const ACTOR = 'dictionary_analysis_actor_v1'
const EFFECTIVE = 'get_dictionary_effective_content_v2'
const RECEIPT = 'get_dictionary_analysis_operation_v2'
const AUTH_CHANGED = 'Authentication changed'
const LOST_REPLY = 'Reply lost'
const FLAG = 'NEXT_PUBLIC_DICTIONARY_SHARED_ANALYSIS_ENABLED'
const oldFlag = process.env[FLAG]
const initial = followingBatch()
const WORD = initial.cards[0].word_id
const HEAD = initial.cards[0].head_sequence
const NEXT_HEAD = '9007199254740995'
const intent = (): DictionaryAnalysisClientOperation => ({
  user_id: OWNER,
  word_id: WORD,
  submitted: false,
  response: null,
  command: {
    protocol_version: 2,
    operation_id: OP,
    entry_id: initial.cards[0].reference.entry_id,
    expected_revision_id: initial.cards[0].reference.revision_id,
    expected_head_sequence: HEAD,
  },
})
const receipt = (): DictionaryAnalysisReceiptV2 => ({
  ...intent().command,
  status: 'published',
  fence: '9007199254740998',
  quota_charged: true,
  result_sha256: 'a'.repeat(64),
  error_code: null,
  published_revision_id: REVISION,
  published_head_sequence: NEXT_HEAD,
})
type AuthSession = { user: { id: string }; access_token: string }
type Listener = (event: string, session: AuthSession | null) => void

// Actual browser journal + SDK binding; synthetic network and Web Locks scheduling.
describe('web SDK captured owner and validated publication snapshot', () => {
  let listeners: Set<Listener>, currentOwner: string | null
  let sequence: string, revision: string, permitted: boolean
  let sdk: ReturnType<typeof makeSdk>
  const emit = (id: string | null) => {
    currentOwner = id
    listeners.forEach(callback =>
      callback(
        id ? 'SIGNED_IN' : 'SIGNED_OUT',
        id ? { user: { id }, access_token: 'synthetic-session' } : null
      )
    )
  }
  const batch = () => {
    const value = followingBatch()
    value.watermark = sequence
    value.cards[0].head_sequence = sequence
    value.cards[0].reference.revision_id = revision
    value.revisions[0].revision_id = revision
    return value
  }
  const defaultRpc = async (name: string) => {
    if (name === CAPABILITY)
      return {
        data: {
          dictionary_content_protocol: 2,
          read_protocol_versions: [1, 2],
          command_protocol_versions: [1, 2],
          following_enabled: true,
          shared_analysis_enabled: true,
        },
        error: null,
      }
    if (name === ACTOR)
      return {
        data: {
          protocol_version: 1,
          actor_id: currentOwner,
          may_analyze: permitted,
        },
        error: null,
      }
    if (name === RECEIPT) return { data: receipt(), error: null }
    if (name === EFFECTIVE) return { data: batch(), error: null }
    throw new Error(`Unexpected RPC: ${name}`)
  }
  function makeSdk() {
    return {
      rpc: jest.fn(defaultRpc),
      auth: {
        getUser: jest.fn(async () => ({
          data: { user: currentOwner ? { id: currentOwner } : null },
          error: null,
        })),
        getSession: jest.fn(async () => ({
          data: {
            session: currentOwner
              ? {
                  user: { id: currentOwner },
                  access_token: 'synthetic-session',
                }
              : null,
          },
          error: null,
        })),
        onAuthStateChange: jest.fn((callback: Listener) => {
          listeners.add(callback)
          return {
            data: {
              subscription: {
                unsubscribe: () => {
                  listeners.delete(callback)
                },
              },
            },
          }
        }),
      },
      functions: {
        invoke: jest.fn(async () => {
          sequence = NEXT_HEAD
          revision = REVISION
          return { data: receipt(), error: null }
        }),
      },
    }
  }
  const service = () => createWebDictionaryAnalysisService(OWNER, true)
  const saved = () =>
    JSON.parse(
      window.localStorage.getItem(`dictionary-analysis-v2:${OWNER}`) ?? '[]'
    ) as DictionaryAnalysisClientOperation[]
  beforeEach(() => {
    jest.clearAllMocks()
    window.localStorage.clear()
    process.env[FLAG] = 'true'
    currentOwner = OWNER
    listeners = new Set()
    sequence = HEAD
    revision = initial.cards[0].reference.revision_id
    permitted = true
    sdk = makeSdk()
    jest
      .mocked(createClient)
      .mockReturnValue(sdk as unknown as ReturnType<typeof createClient>)
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: {
        request: jest.fn(
          async (
            _name: string,
            options: { mode: string },
            action: () => Promise<unknown>
          ) => {
            expect(options.mode).toBe('exclusive')
            return action()
          }
        ),
      },
    })
  })
  afterEach(() => expect(listeners.size).toBe(0))
  afterAll(() => {
    if (oldFlag === undefined) delete process.env[FLAG]
    else process.env[FLAG] = oldFlag
  })
  it('dispatches exact SDK body once and returns a validated shared-only snapshot', async () => {
    const result = await service().submit(intent())
    expect(result.result.response).toEqual(receipt())
    expect(result.hydrated).toEqual(batch())
    expect(result.hydrated?.cards[0].head_sequence).toBe(NEXT_HEAD)
    expect(sdk.functions.invoke).toHaveBeenCalledTimes(1)
    expect(sdk.functions.invoke).toHaveBeenCalledWith('dictionary-analysis', {
      body: intent().command,
      headers: { Authorization: 'Bearer synthetic-session' },
    })
    expect(sdk.rpc.mock.calls.filter(([name]) => name === ACTOR)).toHaveLength(
      2
    )
    expect(saved()[0].response).toEqual(receipt())
    expect(JSON.stringify(saved())).not.toContain('synthetic-session')
    await service().submit(intent())
    expect(sdk.functions.invoke).toHaveBeenCalledTimes(1)
  })
  it.each([undefined, 'false', 'TRUE'])(
    'default OFF %s performs no SDK construction',
    async value => {
      if (value === undefined) delete process.env[FLAG]
      else process.env[FLAG] = value
      expect(await service().isAvailable()).toBe(false)
      expect(createClient).not.toHaveBeenCalled()
    }
  )
  it('requires server following gate as well as public opt-in', async () => {
    expect(await createWebDictionaryAnalysisService(OWNER).isAvailable()).toBe(
      false
    )
    expect(createClient).not.toHaveBeenCalled()
  })
  it('blocks denied or foreign actor before reserving and dispatching', async () => {
    permitted = false
    expect(await service().isAvailable()).toBe(false)
    await expect(service().submit(intent())).rejects.toThrow('permission')
    expect(saved()).toEqual([])
    permitted = true
    sdk.rpc.mockImplementation(async name =>
      name === ACTOR
        ? {
            data: { protocol_version: 1, actor_id: FOREIGN, may_analyze: true },
            error: null,
          }
        : defaultRpc(name)
    )
    await expect(service().submit(intent())).rejects.toThrow('permission')
    expect(sdk.functions.invoke).not.toHaveBeenCalled()
  })
  it('blocks changed exact head before durable intent or endpoint dispatch', async () => {
    sequence = NEXT_HEAD
    await expect(service().submit(intent())).rejects.toThrow('Sync shared')
    expect(saved()).toEqual([])
    expect(sdk.functions.invoke).not.toHaveBeenCalled()
  })
  it('recovers lost reply after reload and flag/permission withdrawal using only reads', async () => {
    sdk.functions.invoke.mockRejectedValue(new Error(LOST_REPLY))
    await expect(service().submit(intent())).rejects.toThrow(LOST_REPLY)
    expect(saved()[0].submitted).toBe(true)
    sequence = NEXT_HEAD
    revision = REVISION
    permitted = false
    process.env[FLAG] = 'false'
    sdk.rpc.mockClear()
    const result = await service().recover(WORD)
    expect(result.result?.response).toEqual(receipt())
    expect(result.hydrated).toEqual(batch())
    expect(sdk.rpc.mock.calls.map(([name]) => name)).toEqual([
      RECEIPT,
      EFFECTIVE,
    ])
    expect(sdk.functions.invoke).toHaveBeenCalledTimes(1)
  })
  it('keeps terminal receipt through stale hydration and retries reads only', async () => {
    sdk.functions.invoke.mockResolvedValue({ data: receipt(), error: null })
    await expect(service().submit(intent())).rejects.toThrow('not hydrated')
    expect(saved()[0].response).toEqual(receipt())
    sequence = NEXT_HEAD
    revision = REVISION
    expect((await service().recover(WORD)).hydrated).toEqual(batch())
    expect(sdk.functions.invoke).toHaveBeenCalledTimes(1)
  })
  it('accepts a later rollback head instead of returning an older publication', async () => {
    await service().submit(intent())
    sequence = '9007199254740996'
    revision = initial.cards[0].reference.revision_id
    expect((await service().recover(WORD)).hydrated).toEqual(batch())
    expect(sdk.functions.invoke).toHaveBeenCalledTimes(1)
  })
  it.each(['actor', 'token', 'reply', 'hydration'])(
    'latches A-to-B-to-A during %s',
    async phase => {
      if (phase === 'token')
        sdk.auth.getSession.mockImplementation(async () => {
          emit(FOREIGN)
          emit(OWNER)
          return {
            data: {
              session: {
                user: { id: OWNER },
                access_token: 'synthetic-session',
              },
            },
            error: null,
          }
        })
      else if (phase === 'reply')
        sdk.functions.invoke.mockImplementation(async () => {
          emit(FOREIGN)
          emit(OWNER)
          return { data: receipt(), error: null }
        })
      else
        sdk.rpc.mockImplementation(async name => {
          if (
            name === (phase === 'actor' ? ACTOR : EFFECTIVE) &&
            (phase !== 'hydration' || sequence === NEXT_HEAD)
          ) {
            emit(FOREIGN)
            emit(OWNER)
          }
          return defaultRpc(name)
        })
      await expect(service().submit(intent())).rejects.toThrow(AUTH_CHANGED)
      if (phase === 'actor' || phase === 'token')
        expect(sdk.functions.invoke).not.toHaveBeenCalled()
      if (phase === 'hydration') {
        expect(sdk.functions.invoke).toHaveBeenCalledTimes(1)
        expect(saved()[0].response).toEqual(receipt())
      }
    }
  )
  it('requires Web Locks before any durable journal or endpoint access', async () => {
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: undefined,
    })
    await expect(service().submit(intent())).rejects.toThrow(
      'storage is unavailable'
    )
    expect(sdk.functions.invoke).not.toHaveBeenCalled()
    expect(saved()).toEqual([])
  })
  it('hydrates no-change against the unchanged shared head', async () => {
    const unchanged = {
      ...receipt(),
      status: 'no-change' as const,
      published_revision_id: revision,
      published_head_sequence: HEAD,
    }
    sdk.functions.invoke.mockResolvedValue({ data: unchanged, error: null })
    const result = await service().submit(intent())
    expect(result.result.response).toEqual(unchanged)
    expect(result.hydrated).toEqual(initial)
    expect(sdk.functions.invoke).toHaveBeenCalledTimes(1)
  })
  const savedPublication = async () => {
    sdk.functions.invoke.mockResolvedValue({ data: receipt(), error: null })
    await expect(service().submit(intent())).rejects.toThrow('not hydrated')
    const operation = saved()[0]
    sequence = NEXT_HEAD
    revision = REVISION
    sdk.rpc.mockClear()
    return operation
  }
  it('loads a saved published snapshot after reload without permission, status reads or redispatch', async () => {
    const operation = await savedPublication()
    const bytes = window.localStorage.getItem(`dictionary-analysis-v2:${OWNER}`)
    permitted = false
    process.env[FLAG] = 'false'
    const result = await service().loadPublished(operation)
    expect(result.result).toEqual(operation)
    expect(result.hydrated).toEqual(batch())
    expect(sdk.rpc.mock.calls.map(([name]) => name)).toEqual([EFFECTIVE])
    expect(window.localStorage.getItem(`dictionary-analysis-v2:${OWNER}`)).toBe(
      bytes
    )
    expect(sdk.functions.invoke).toHaveBeenCalledTimes(1)
  })
  it.each(['offline', 'missing-revision', 'stale-head'] as const)(
    'retains the saved receipt on %s and retries only content reads',
    async kind => {
      const operation = await savedPublication()
      const bytes = window.localStorage.getItem(
        `dictionary-analysis-v2:${OWNER}`
      )
      sdk.rpc.mockImplementation(async name => {
        if (name === EFFECTIVE) {
          if (kind === 'offline') throw new Error('Offline')
          if (kind === 'stale-head') return { data: initial, error: null }
          const incomplete = batch()
          incomplete.revisions = []
          return { data: incomplete, error: null }
        }
        return defaultRpc(name)
      })
      await expect(service().loadPublished(operation)).rejects.toThrow()
      expect(
        window.localStorage.getItem(`dictionary-analysis-v2:${OWNER}`)
      ).toBe(bytes)
      sdk.rpc.mockImplementation(defaultRpc)
      expect((await service().loadPublished(operation)).hydrated).toEqual(
        batch()
      )
      expect(sdk.rpc.mock.calls.every(([name]) => name === EFFECTIVE)).toBe(
        true
      )
      expect(sdk.functions.invoke).toHaveBeenCalledTimes(1)
    }
  )
  it('rejects a replaced browser journal while reading publication without returning a snapshot', async () => {
    const operation = await savedPublication()
    const replacement = {
      ...intent(),
      command: {
        ...intent().command,
        operation_id: '88888888-8888-4888-8888-888888888888',
      },
    }
    sdk.rpc.mockImplementation(async name => {
      if (name === EFFECTIVE)
        window.localStorage.setItem(
          `dictionary-analysis-v2:${OWNER}`,
          JSON.stringify([replacement])
        )
      return defaultRpc(name)
    })
    await expect(service().loadPublished(operation)).rejects.toThrow()
    expect(saved()).toEqual([replacement])
    expect(sdk.functions.invoke).toHaveBeenCalledTimes(1)
  })
  it.each(['unmount', 'owner-roundtrip'] as const)(
    'rejects %s while reading publication',
    async kind => {
      const operation = await savedPublication()
      let active = true
      sdk.rpc.mockImplementation(async name => {
        if (name === EFFECTIVE) {
          if (kind === 'unmount') active = false
          else {
            emit(FOREIGN)
            emit(OWNER)
          }
        }
        return defaultRpc(name)
      })
      const guarded = createWebDictionaryAnalysisService(
        OWNER,
        true,
        () => () => {
          if (!active) throw new Error('View closed')
        }
      )
      await expect(guarded.loadPublished(operation)).rejects.toThrow()
      expect(saved()[0]).toEqual(operation)
      expect(sdk.functions.invoke).toHaveBeenCalledTimes(1)
    }
  )
  it('keeps server following gate and saved publication prerequisites when reloading content', async () => {
    const operation = await savedPublication()
    await expect(
      createWebDictionaryAnalysisService(OWNER, false).loadPublished(operation)
    ).rejects.toThrow('unavailable')
    await expect(
      service().loadPublished({ ...operation, response: null })
    ).rejects.toThrow()
    expect(sdk.rpc).not.toHaveBeenCalled()
    expect(sdk.functions.invoke).toHaveBeenCalledTimes(1)
  })
})

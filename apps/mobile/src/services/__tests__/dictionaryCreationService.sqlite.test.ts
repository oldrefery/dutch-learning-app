import {
  type DictionaryCreationJournal,
  type DictionaryCreationRemote,
} from '@woordenaar/domain'
import {
  CREATION_OWNER as OWNER,
  CREATION_OTHER as OTHER,
  creationUuid as id,
  creationJournalFixture as initial,
  creationPreparedFixture as prepared,
  creationReceiptFixture as receipt,
  creationPublishedFixture as published,
} from '../../../../../packages/domain/src/dictionary-creation-journal.fixture'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { supabase as sdk } from '@/lib/supabase'
import { dictionaryCreationRepository } from '@/db/dictionaryCreationRepository'
import { createTestDatabase } from '@/db/__tests__/sqlite.fixture'
import { createMobileDictionaryCreationService } from '../dictionaryCreationService'
const CAPABILITY = 'dictionary_content_capability_v2'
const ACTOR = 'dictionary_analysis_actor_v1'
const REQUEST = 'request_dictionary_meaning_resolution_v2'
const RESOLUTION = 'get_dictionary_meaning_resolution_v2'
const STATUS = 'get_dictionary_creation_operation_v2'
const TOKEN = 'synthetic-creation-token'
const AUTH_CHANGED = 'Authentication changed'
const CONTEXT_CHANGED = 'context changed'
type Listener = (
  event: string,
  session: { user: { id: string } } | null
) => void
interface AuthFixture {
  getUser: jest.Mock<
    Promise<{ data: { user: { id: string } | null }; error: unknown }>,
    [string?]
  >
  getSession: jest.Mock<ReturnType<DictionaryCreationRemote['getSession']>, []>
  onAuthStateChange: jest.Mock<
    { data: { subscription: { unsubscribe(): void } } },
    [Listener]
  >
}
jest.mock('@/db/initDB')
jest.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: jest.fn(),
    auth: {
      getUser: jest.fn(),
      getSession: jest.fn(),
      onAuthStateChange: jest.fn(),
    },
    functions: { invoke: jest.fn() },
  },
}))
describe('creation SDK/owner transport on file-backed native SQLite', () => {
  let db: DatabaseSync, directory: string, path: string
  let journal: DictionaryCreationJournal
  let service: ReturnType<typeof createMobileDictionaryCreationService>
  const flags = [
    'EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED',
    'EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED',
    'EXPO_PUBLIC_DICTIONARY_SHARED_ANALYSIS_ENABLED',
  ] as const
  const makeService = () =>
    createMobileDictionaryCreationService(
      OWNER,
      assertCurrent,
      contextAbort.signal
    )
  const restart = () => {
    db.close()
    db = createTestDatabase(path, false)
    service = makeService()
  }
  beforeEach(() => {
    before()
    directory = mkdtempSync(join(tmpdir(), 'dictionary-creation-client-'))
    path = join(directory, 'fixture.sqlite')
    db = createTestDatabase(path)
    journal = dictionaryCreationRepository
    service = makeService()
  })
  afterEach(() => {
    db.close()
    rmSync(directory, { recursive: true, force: true })
  })

  const auth = sdk.auth as unknown as AuthFixture
  const rpc = sdk.rpc as unknown as jest.Mock<
    Promise<{ data: unknown; error: unknown }>,
    [string, Record<string, unknown>?]
  >
  const invoke = sdk.functions.invoke as unknown as jest.Mock<
    ReturnType<DictionaryCreationRemote['invoke']>,
    Parameters<DictionaryCreationRemote['invoke']>
  >
  let currentOwner: string | null,
    actorId: string,
    permitted: boolean,
    mounted: boolean
  let contextAbort: AbortController
  let listeners: Set<Listener>
  let resolution: unknown, requestDecision: unknown, status: unknown
  const previousFlags = flags.map(key => process.env[key])
  const enabled = (value = true) => {
    flags.forEach(key => {
      process.env[key] = value ? 'true' : 'false'
    })
  }
  const emit = (ownerId: string | null) => {
    currentOwner = ownerId
    listeners.forEach(listener =>
      listener(
        ownerId ? 'SIGNED_IN' : 'SIGNED_OUT',
        ownerId ? { user: { id: ownerId } } : null
      )
    )
  }
  const assertCurrent = () => {
    if (!mounted) throw new Error('Creation context changed')
  }
  const defaultRpc = async (name: string) => {
    const data =
      name === CAPABILITY
        ? {
            dictionary_content_protocol: 2,
            read_protocol_versions: [1, 2],
            command_protocol_versions: [1, 2],
            following_enabled: true,
            shared_analysis_enabled: true,
          }
        : name === ACTOR
          ? { protocol_version: 1, actor_id: actorId, may_analyze: permitted }
          : name === REQUEST
            ? (resolution = requestDecision)
            : name === RESOLUTION
              ? resolution
              : name === STATUS
                ? status
                : null
    return { data, error: null }
  }
  const before = () => {
    jest.clearAllMocks()
    contextAbort = new AbortController()
    mounted = true
    permitted = true
    currentOwner = OWNER
    actorId = OWNER
    listeners = new Set()
    resolution = null
    requestDecision = prepared(initial()).session.resolution
    status = null
    enabled()
    auth.onAuthStateChange.mockImplementation(listener => {
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
    })
    auth.getUser.mockImplementation(async () => ({
      data: { user: currentOwner ? { id: currentOwner } : null },
      error: null,
    }))
    auth.getSession.mockImplementation(async () => ({
      data: {
        session: currentOwner
          ? { user: { id: currentOwner }, access_token: TOKEN }
          : null,
      },
      error: null,
    }))
    rpc.mockImplementation(defaultRpc)
    invoke.mockImplementation(async () => ({
      data: receipt(prepared(initial())),
      error: null,
    }))
  }
  afterEach(() => {
    expect(listeners.size).toBe(0)
    flags.forEach((key, index) => {
      const value = previousFlags[index]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    })
  })
  const create = async (recovery = false) => {
    const resolved = await service.resolve(initial())
    return service.prepareCommand(
      resolved,
      prepared(initial()).session.command!.operation_id,
      recovery ? id(4) : undefined
    )
  }
  const saved = () => service.readSaved(initial().session.request.resolution_id)
  it('constructs without I/O or intent and unsubscribes each explicit access', async () => {
    expect(auth.getUser).not.toHaveBeenCalled()
    expect(rpc).not.toHaveBeenCalled()
    expect(invoke).not.toHaveBeenCalled()
    expect(await service.list()).toEqual([])
    expect(listeners.size).toBe(0)
  })
  it('persists exact original query/hint before the uncharged request and stores only the bound resolution', async () => {
    rpc.mockImplementation(async (name, args) => {
      if (name === REQUEST) {
        expect(args).toEqual({ p_request: initial().session.request })
        expect((await saved())?.session.request).toEqual(
          initial().session.request
        )
      }
      return defaultRpc(name)
    })
    const row = await service.resolve(initial())
    expect(row.session.resolution).toEqual(requestDecision)
    restart()
    expect(await saved()).toEqual(row)
    expect(invoke).not.toHaveBeenCalled()
  })
  it('retains pending resolution across restart and reads the same nonce without another request', async () => {
    requestDecision = null
    const pending = await service.resolve(initial())
    expect(pending.session.resolution).toBeNull()
    restart()
    resolution = prepared(initial()).session.resolution
    const resolved = await service.recoverResolution(
      pending.session.request.resolution_id
    )
    expect(resolved?.session.resolution).toEqual(resolution)
    expect(rpc.mock.calls.filter(([name]) => name === REQUEST)).toHaveLength(1)
    expect(invoke).not.toHaveBeenCalled()
  })
  it('recovers a lost resolution reply by exact status read with new-work flags off', async () => {
    rpc.mockImplementation(async name => {
      const result = await defaultRpc(name)
      return name === REQUEST
        ? { data: null, error: new Error('Lost reply') }
        : result
    })
    await expect(service.resolve(initial())).rejects.toThrow('same resolution')
    enabled(false)
    restart()
    expect(
      (await service.recoverResolution(initial().session.request.resolution_id))
        ?.session.resolution
    ).toEqual(resolution)
    expect(rpc.mock.calls.filter(([name]) => name === REQUEST)).toHaveLength(1)
  })
  it('commits the submission before invoke and verifies the exact bearer token without storing credentials', async () => {
    const row = await create()
    invoke.mockImplementation(async (name, options) => {
      expect((await saved())?.session.submitted).toBe(true)
      expect(name).toBe('dictionary-creation')
      expect(options).toEqual({
        body: row.session.command,
        headers: { Authorization: `Bearer ${TOKEN}` },
        signal: expect.anything(),
      })
      expect(auth.getUser).toHaveBeenCalledWith(TOKEN)
      return { data: receipt(row), error: null }
    })
    const result = await service.submit(row)
    restart()
    expect(await saved()).toEqual(result)
    expect(JSON.stringify(result)).not.toContain(TOKEN)
    expect(
      result.session.response && 'fence' in result.session.response
        ? result.session.response.fence
        : null
    ).toBe('9007199254740993')
  })
  it('keeps unknown transport outcome submitted and never invokes again after restart or repeated submit', async () => {
    const row = await create()
    invoke.mockImplementation(async () => {
      status = published({
        ...row,
        session: { ...row.session, submitted: true },
      }).session.response
      throw new Error('Lost HTTP reply')
    })
    await expect(service.submit(row)).rejects.toThrow('Lost HTTP reply')
    expect((await saved())?.session.submitted).toBe(true)
    enabled(false)
    permitted = false
    restart()
    const recovered = await service.submit(row)
    expect(recovered.session.response).toEqual(status)
    expect(await service.recover(row.session.request.resolution_id)).toEqual(
      recovered
    )
    expect(invoke).toHaveBeenCalledTimes(1)
  })
  it.each(['error', 'null', 'foreign'] as const)(
    'retains submitted metadata for a %s endpoint reply without blind resend',
    async mode => {
      const row = await create()
      invoke.mockResolvedValue(
        mode === 'error'
          ? { data: null, error: new Error('Lost reply') }
          : {
              data:
                mode === 'null' ? null : receipt(row, { operation_id: id(99) }),
              error: null,
            }
      )
      await expect(service.submit(row)).rejects.toThrow()
      restart()
      const pending = await service.recover(row.session.request.resolution_id)
      expect(pending?.session.submitted).toBe(true)
      expect(pending?.session.response).toBeNull()
      await service.submit(row)
      expect(invoke).toHaveBeenCalledTimes(1)
    }
  )
  it('does not dispatch after permission withdrawal between preflight and durable claim continuation', async () => {
    const row = await create()
    let actorReads = 0
    rpc.mockImplementation(async name => {
      if (name === ACTOR && ++actorReads === 2) permitted = false
      return defaultRpc(name)
    })
    await expect(service.submit(row)).rejects.toThrow('unavailable')
    expect((await saved())?.session.submitted).toBe(true)
    expect(invoke).not.toHaveBeenCalled()
  })
  it('rejects a disabled flag before claim and a flag change after collecting a token', async () => {
    const row = await create()
    enabled(false)
    await expect(service.submit(row)).rejects.toThrow('unavailable')
    expect((await saved())?.session.submitted).toBe(false)
    enabled()
    auth.getSession.mockImplementation(async () => {
      enabled(false)
      return {
        data: { session: { user: { id: OWNER }, access_token: TOKEN } },
        error: null,
      }
    })
    await expect(service.submit(row)).rejects.toThrow('unavailable')
    expect((await saved())?.session.submitted).toBe(true)
    expect(invoke).not.toHaveBeenCalled()
  })
  it.each(['foreign-session', 'rejected-token', 'whitespace-token'] as const)(
    'rejects %s before endpoint dispatch',
    async mode => {
      const row = await create()
      if (mode === 'foreign-session')
        auth.getSession.mockResolvedValue({
          data: { session: { user: { id: OTHER }, access_token: TOKEN } },
          error: null,
        })
      if (mode === 'whitespace-token')
        auth.getSession.mockResolvedValue({
          data: {
            session: { user: { id: OWNER }, access_token: 'invalid token' },
          },
          error: null,
        })
      if (mode === 'rejected-token')
        auth.getUser.mockImplementation(async token => ({
          data: { user: token ? null : { id: OWNER } },
          error: token ? new Error('Revoked') : null,
        }))
      await expect(service.submit(row)).rejects.toThrow('authentication')
      expect((await saved())?.session.submitted).toBe(true)
      expect(invoke).not.toHaveBeenCalled()
    }
  )
  it('latches A-to-B-to-A during a resolution reply and retains the exact request for later status', async () => {
    rpc.mockImplementation(async name => {
      const result = await defaultRpc(name)
      if (name === REQUEST) {
        emit(OTHER)
        emit(OWNER)
      }
      return result
    })
    await expect(service.resolve(initial())).rejects.toThrow(AUTH_CHANGED)
    expect((await saved())?.session.resolution).toBeNull()
    expect(
      (await service.recoverResolution(initial().session.request.resolution_id))
        ?.session.resolution
    ).toEqual(resolution)
    expect(invoke).not.toHaveBeenCalled()
  })
  it('latches A-to-B-to-A during invoke; publication is recovered only by a fresh status action', async () => {
    const row = await create()
    invoke.mockImplementation(async () => {
      status = published({
        ...row,
        session: { ...row.session, submitted: true },
      }).session.response
      emit(OTHER)
      emit(OWNER)
      return { data: status, error: null }
    })
    await expect(service.submit(row)).rejects.toThrow(AUTH_CHANGED)
    expect((await saved())?.session.response).toBeNull()
    const recovered = await service.recover(row.session.request.resolution_id)
    expect(recovered?.session.response).toEqual(status)
    expect(recovered?.adoption).toBeNull()
    expect(invoke).toHaveBeenCalledTimes(1)
  })
  it.each(['auth', 'context'] as const)(
    'aborts SDK invocation on %s cancellation and preserves submitted intent',
    async mode => {
      const row = await create()
      invoke.mockImplementation(async (_name, options) => {
        expect(options.signal.aborted).toBe(false)
        if (mode === 'auth') {
          emit(OTHER)
          emit(OWNER)
        } else contextAbort.abort()
        expect(options.signal.aborted).toBe(true)
        return { data: null, error: new Error('Aborted') }
      })
      await expect(service.submit(row)).rejects.toThrow(
        mode === 'auth' ? AUTH_CHANGED : CONTEXT_CHANGED
      )
      contextAbort = new AbortController()
      restart()
      expect((await saved())?.session.submitted).toBe(true)
      expect(
        (await service.recover(row.session.request.resolution_id))?.session
          .response
      ).toBeNull()
      expect(invoke).toHaveBeenCalledTimes(1)
    }
  )
  it('rejects a mounted context change during token collection while retaining the claim', async () => {
    const row = await create()
    auth.getSession.mockImplementation(async () => {
      mounted = false
      return {
        data: { session: { user: { id: OWNER }, access_token: TOKEN } },
        error: null,
      }
    })
    await expect(service.submit(row)).rejects.toThrow(CONTEXT_CHANGED)
    mounted = true
    expect((await saved())?.session.submitted).toBe(true)
    expect(invoke).not.toHaveBeenCalled()
  })
  it('rejects another owner and incorrect actor capability before requesting meaning or dispatching', async () => {
    emit(OTHER)
    await expect(service.resolve(initial())).rejects.toThrow(AUTH_CHANGED)
    emit(OWNER)
    actorId = OTHER
    expect(await service.isAvailable()).toBe(false)
    await expect(service.resolve(initial())).rejects.toThrow('unavailable')
    expect(rpc.mock.calls.filter(([name]) => name === REQUEST)).toHaveLength(0)
    expect(invoke).not.toHaveBeenCalled()
  })
  it('reads original publication after gate/permission withdrawal and never adopts a personal card', async () => {
    const row = await create()
    invoke.mockResolvedValue({
      data: published({ ...row, session: { ...row.session, submitted: true } })
        .session.response,
      error: null,
    })
    const result = await service.submit(row)
    enabled(false)
    permitted = false
    status = result.session.response
    rpc.mockClear()
    expect(await service.recover(row.session.request.resolution_id)).toEqual(
      result
    )
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([STATUS])
    expect(result.adoption).toBeNull()
    expect(result).not.toHaveProperty('hydrated')
  })
  it('fails closed on missing, foreign or regressed durable receipt without replacing publication', async () => {
    const row = await create()
    invoke.mockResolvedValue({
      data: published({ ...row, session: { ...row.session, submitted: true } })
        .session.response,
      error: null,
    })
    const result = await service.submit(row)
    for (const value of [null, receipt(row), receipt(row, { fence: '2' })]) {
      status = value
      await expect(
        service.recover(row.session.request.resolution_id)
      ).rejects.toThrow()
      expect(await saved()).toEqual(result)
    }
    expect(invoke).toHaveBeenCalledTimes(1)
  })
  it('recovers unknown and late quarantined result without another endpoint call', async () => {
    const row = await create()
    invoke.mockResolvedValue({
      data: receipt(row, {
        status: 'provider-outcome-unknown',
        error_code: 'transport-unknown',
      }),
      error: null,
    })
    const uncertain = await service.submit(row)
    status = receipt(row, {
      status: 'provider-outcome-unknown',
      error_code: 'transport-unknown',
      result_sha256: 'a'.repeat(64),
    })
    enabled(false)
    permitted = false
    restart()
    const late = await service.recover(row.session.request.resolution_id)
    expect(late?.session.response).toEqual(status)
    expect(late?.session.command).toEqual(uncertain.session.command)
    status = receipt(row, {
      status: 'provider-failed',
      error_code: 'failed',
      result_sha256: 'a'.repeat(64),
    })
    await expect(
      service.recover(row.session.request.resolution_id)
    ).rejects.toThrow()
    expect(invoke).toHaveBeenCalledTimes(1)
  })
  it('retains accepted receipt when a mounted lifetime expires during status read', async () => {
    const row = await create()
    const accepted = await service.submit(row)
    rpc.mockImplementation(async name => {
      if (name === STATUS) {
        mounted = false
        return { data: published(accepted).session.response, error: null }
      }
      return defaultRpc(name)
    })
    await expect(
      service.recover(row.session.request.resolution_id)
    ).rejects.toThrow(CONTEXT_CHANGED)
    mounted = true
    expect(await saved()).toEqual(accepted)
    expect(invoke).toHaveBeenCalledTimes(1)
  })
  it('preserves local receipt when status RPC fails and never retries the endpoint', async () => {
    const row = await create()
    const accepted = await service.submit(row)
    rpc.mockImplementation(async name =>
      name === STATUS
        ? { data: null, error: new Error('Offline') }
        : defaultRpc(name)
    )
    await expect(
      service.recover(row.session.request.resolution_id)
    ).rejects.toThrow('status is unavailable')
    expect(await saved()).toEqual(accepted)
    expect(invoke).toHaveBeenCalledTimes(1)
  })
  it('does not treat unavailable capability or revoked permission as permission to resolve', async () => {
    rpc.mockImplementation(async name =>
      name === CAPABILITY
        ? { data: null, error: new Error('Offline') }
        : defaultRpc(name)
    )
    expect(await service.isAvailable()).toBe(false)
    await expect(service.resolve(initial())).rejects.toThrow('unavailable')
    rpc.mockImplementation(defaultRpc)
    permitted = false
    expect(await service.isAvailable()).toBe(false)
    await expect(service.resolve(initial())).rejects.toThrow('unavailable')
    expect(rpc.mock.calls.filter(([name]) => name === REQUEST)).toHaveLength(0)
    expect(invoke).not.toHaveBeenCalled()
  })
  it('submits the exact reviewed recovery variant without an administrative RPC or automatic new nonce', async () => {
    const row = await create(true)
    const result = await service.submit(row)
    expect(invoke.mock.calls[0][1].body).toEqual(row.session.command)
    expect(Object.keys(invoke.mock.calls[0][1].body)).toHaveLength(4)
    expect(result.session.command).toHaveProperty('recovery_id', id(4))
    expect(
      rpc.mock.calls.some(([name]) =>
        /review|recover_dictionary_creation/.test(name)
      )
    ).toBe(false)
  })
  it('rejects an explicitly empty recovery ID rather than silently downgrading to ordinary creation', async () => {
    const row = await service.resolve(initial())
    await expect(service.prepareCommand(row, id(20), '')).rejects.toThrow()
    expect((await saved())?.session.command).toBeNull()
    expect(invoke).not.toHaveBeenCalled()
  })
  it('retains review-required meaning without preparing or submitting a provider command', async () => {
    requestDecision = {
      ...initial().session.request,
      outcome: 'review-required',
      resolved_identity_id: null,
      published: null,
      decision_code: 'meaning-uncertain',
    }
    const row = await service.resolve(initial())
    await expect(service.prepareCommand(row, id(20))).rejects.toThrow(
      'resolved new meaning'
    )
    await expect(service.submit(row)).rejects.toThrow('missing')
    expect(invoke).not.toHaveBeenCalled()
  })
  it('rejects a changed resolution query/hint and stale command identity before dispatch', async () => {
    requestDecision = {
      ...prepared(initial()).session.resolution!,
      meaning_hint: 'A seat.',
    }
    await expect(service.resolve(initial())).rejects.toThrow(
      'original owner request'
    )
    expect((await saved())?.session.resolution).toBeNull()
    requestDecision = prepared(initial()).session.resolution
    resolution = requestDecision
    const resolved = await service.recoverResolution(
      initial().session.request.resolution_id
    )
    const row = await service.prepareCommand(resolved!, id(20))
    await expect(
      service.submit({
        ...row,
        session: {
          ...row.session,
          command: { ...row.session.command!, operation_id: id(21) },
        },
      })
    ).rejects.toThrow('command changed')
    expect(invoke).not.toHaveBeenCalled()
  })
  it('allows only one independent client to invoke for the same prepared nonce', async () => {
    const row = await create()
    const otherService = makeService()
    const result = await Promise.allSettled([
      service.submit(row),
      otherService.submit(row),
    ])
    expect(result.some(value => value.status === 'fulfilled')).toBe(true)
    expect(invoke).toHaveBeenCalledTimes(1)
    expect((await saved())?.session.submitted).toBe(true)
  })

  it('does not invoke if durable claim persistence fails', async () => {
    const row = await create()
    const claim = jest
      .spyOn(journal, 'claim')
      .mockRejectedValueOnce(new Error('Storage failed'))
    await expect(service.submit(row)).rejects.toThrow('Storage failed')
    expect((await saved())?.session.submitted).toBe(false)
    expect(invoke).not.toHaveBeenCalled()
    claim.mockRestore()
  })
  it('leaves personal rows/SRS/content and learning queues untouched through publication recovery', async () => {
    const row = await create()
    const tables = [
      'words',
      'review_events',
      'learning_commands',
      'dictionary_content_commands',
      'dictionary_card_content',
      'dictionary_following_import_journal',
    ]
    const beforeRows = tables.map(name =>
      db.prepare(`SELECT * FROM ${name}`).all()
    )
    const result = await service.submit(row)
    status = published(result).session.response
    await service.recover(row.session.request.resolution_id)
    restart()
    expect(
      tables.map(name => db.prepare(`SELECT * FROM ${name}`).all())
    ).toEqual(beforeRows)
  })
})

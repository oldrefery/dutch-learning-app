import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import type {
  AuthChangeEvent,
  Session,
  PostgrestSingleResponse,
} from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { createTestDatabase } from '@/db/__tests__/sqlite.fixture'
import { dictionaryAnalysisRepository as journal } from '@/db/dictionaryAnalysisRepository'
import { dictionaryFollowingRepository as cache } from '@/db/dictionaryFollowingRepository'
import {
  analysisIntent,
  analysisReceipt,
} from '@/db/__tests__/dictionaryAnalysis.fixture'
import {
  OWNER_A,
  OWNER_B,
  WORD_A,
  WORD_A2,
  REVISION_1,
  REVISION_2,
  AT,
  followingBatch,
} from '@/db/__tests__/dictionaryFollowing.fixture'
import { dictionaryAnalysisService as service } from '../dictionaryAnalysisService'

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
const CAPABILITY = 'dictionary_content_capability_v2'
const ACTOR = 'dictionary_analysis_actor_v1'
const EFFECTIVE = 'get_dictionary_effective_content_v2'
const RECEIPT = 'get_dictionary_analysis_operation_v2'
const AUTH_CHANGED = 'Authentication changed'
const HEAD_1 = '9007199254740993',
  HEAD_2 = '9007199254740994'
const WORDS_SQL = 'SELECT * FROM words ORDER BY word_id'
const COMMANDS_SQL = 'SELECT * FROM dictionary_content_commands'
const DEBT_SQL = 'SELECT * FROM dictionary_following_refresh_queue'
const noop = () => {}
const rpc = supabase.rpc as unknown as jest.Mock<
  Promise<PostgrestSingleResponse<unknown>>,
  [string, { p_word_ids?: string[]; p_operation?: string }?]
>
const response = (data: unknown): PostgrestSingleResponse<unknown> => ({
  data,
  error: null,
  count: null,
  status: 200,
  statusText: 'OK',
})
const flags = [
  'EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED',
  'EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED',
  'EXPO_PUBLIC_DICTIONARY_SHARED_ANALYSIS_ENABLED',
] as const
const previousFlags = flags.map(key => process.env[key])
type Listener = (event: AuthChangeEvent, session: Session | null) => void

describe('mobile SDK/owner and publication cache binding on file-backed SQLite', () => {
  let db: DatabaseSync, directory: string, path: string
  let listeners: Set<Listener>, currentOwner: string | null
  let sequence: string, revision: string, permitted: boolean
  const emit = (id: string | null) => {
    currentOwner = id
    listeners.forEach(callback =>
      callback(
        id ? 'SIGNED_IN' : 'SIGNED_OUT',
        id ? ({ user: { id } } as Session) : null
      )
    )
  }
  const defaultRpc = async (name: string, args?: { p_word_ids?: string[] }) => {
    if (name === CAPABILITY)
      return response({
        dictionary_content_protocol: 2,
        read_protocol_versions: [1, 2],
        command_protocol_versions: [1, 2],
        following_enabled: true,
        shared_analysis_enabled: true,
      })
    if (name === ACTOR)
      return response({
        protocol_version: 1,
        actor_id: currentOwner,
        may_analyze: permitted,
      })
    if (name === RECEIPT) return response(analysisReceipt())
    if (name === EFFECTIVE)
      return response(
        followingBatch(sequence, revision, args?.p_word_ids ?? [])
      )
    throw new Error(`Unexpected RPC: ${name}`)
  }
  beforeEach(async () => {
    jest.clearAllMocks()
    flags.forEach(key => {
      process.env[key] = 'true'
    })
    currentOwner = OWNER_A
    listeners = new Set()
    sequence = HEAD_1
    revision = REVISION_1
    permitted = true
    jest.mocked(supabase.auth.getUser).mockImplementation(
      async () =>
        ({
          data: { user: currentOwner ? { id: currentOwner } : null },
          error: null,
        }) as Awaited<ReturnType<typeof supabase.auth.getUser>>
    )
    jest.mocked(supabase.auth.getSession).mockImplementation(
      async () =>
        ({
          data: {
            session: currentOwner
              ? {
                  user: { id: currentOwner },
                  access_token: 'synthetic-session',
                }
              : null,
          },
          error: null,
        }) as Awaited<ReturnType<typeof supabase.auth.getSession>>
    )
    jest
      .mocked(supabase.auth.onAuthStateChange)
      .mockImplementation(callback => {
        listeners.add(callback)
        return {
          data: {
            subscription: {
              id: 'analysis-owner',
              callback,
              unsubscribe: () => {
                listeners.delete(callback)
              },
            },
          },
        }
      })
    rpc.mockReset().mockImplementation(defaultRpc)
    jest
      .mocked(supabase.functions.invoke)
      .mockReset()
      .mockImplementation(async () => {
        sequence = HEAD_2
        revision = REVISION_2
        return { data: analysisReceipt(), error: null }
      })
    directory = mkdtempSync(join(tmpdir(), 'analysis-sdk-sqlite-'))
    path = join(directory, 'fixture.sqlite')
    db = createTestDatabase(path)
    for (const word of [WORD_A, WORD_A2])
      db.prepare(
        `INSERT INTO words(word_id,user_id,dutch_lemma,translations,next_review_date,created_at,updated_at,interval_days,repetition_count,easiness_factor,sync_status)
    VALUES (?,?,?,'{}','2026-10-11',?,?,7,8,2.35,'synced')`
      ).run(word, OWNER_A, `fixture-${word}`, AT, AT)
    const request = await cache.prepareHydration(OWNER_A, [WORD_A, WORD_A2])
    await cache.commitHydration(
      request,
      [followingBatch(HEAD_1, REVISION_1, [WORD_A, WORD_A2])],
      noop
    )
  })
  afterEach(() => {
    expect(listeners.size).toBe(0)
    db.close()
    rmSync(directory, { recursive: true, force: true })
  })
  afterAll(() => {
    flags.forEach((key, index) => {
      const old = previousFlags[index]
      if (old === undefined) delete process.env[key]
      else process.env[key] = old
    })
  })
  const cached = async () =>
    await cache.getCachedCards(OWNER_A, [WORD_A, WORD_A2])
  const restart = () => {
    db.close()
    db = createTestDatabase(path, false)
  }

  it('binds exact SDK POST once, hydrates complete shared siblings and preserves words/SRS/queues', async () => {
    const words = db.prepare(WORDS_SQL).all()
    const result = await service.submit(analysisIntent())
    expect(result.response).toEqual(analysisReceipt())
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1)
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      'dictionary-analysis',
      {
        body: analysisIntent().command,
        headers: { Authorization: 'Bearer synthetic-session' },
      }
    )
    expect(rpc.mock.calls.filter(([name]) => name === ACTOR)).toHaveLength(2)
    for (const item of (await cached()).values()) {
      expect(item.card.head_sequence).toBe(HEAD_2)
      expect(item.card.reference?.revision_id).toBe(REVISION_2)
    }
    expect(db.prepare(WORDS_SQL).all()).toEqual(words)
    expect(db.prepare('SELECT * FROM learning_commands').all()).toEqual([])
    expect(db.prepare(COMMANDS_SQL).all()).toEqual([])
    expect(await cache.getPendingRefreshWordIds(OWNER_A)).toEqual([])
  })
  it.each([undefined, 'false', 'TRUE'])(
    'default OFF opt-in %s performs no availability/auth/provider request',
    async value => {
      if (value === undefined)
        delete process.env.EXPO_PUBLIC_DICTIONARY_SHARED_ANALYSIS_ENABLED
      else process.env.EXPO_PUBLIC_DICTIONARY_SHARED_ANALYSIS_ENABLED = value
      expect(await service.isAvailable(OWNER_A)).toBe(false)
      expect(rpc).not.toHaveBeenCalled()
      expect(supabase.auth.getUser).not.toHaveBeenCalled()
      expect(supabase.functions.invoke).not.toHaveBeenCalled()
    }
  )
  it('rejects read_only permission before reserving a journal intent', async () => {
    permitted = false
    expect(await service.isAvailable(OWNER_A)).toBe(false)
    await expect(service.submit(analysisIntent())).rejects.toThrow('permission')
    expect(await journal.read(OWNER_A, WORD_A)).toBeNull()
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })
  it('rejects a foreign actor and malformed permission signal before dispatch', async () => {
    for (const actor of [
      { protocol_version: 1, actor_id: OWNER_B, may_analyze: true },
      { protocol_version: 1, actor_id: OWNER_A, may_analyze: 'true' },
      {
        protocol_version: 1,
        actor_id: OWNER_A,
        may_analyze: true,
        role: 'admin',
      },
    ]) {
      rpc.mockImplementation(async (name, args) =>
        name === ACTOR ? response(actor) : defaultRpc(name, args)
      )
      await expect(service.submit(analysisIntent())).rejects.toThrow()
    }
    expect(await journal.read(OWNER_A, WORD_A)).toBeNull()
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })
  it('rechecks permission after durable claim, before dispatch', async () => {
    let reads = 0
    rpc.mockImplementation(async (name, args) => {
      if (name === ACTOR && ++reads === 2) permitted = false
      return defaultRpc(name, args)
    })
    await expect(service.submit(analysisIntent())).rejects.toThrow('permission')
    expect((await journal.read(OWNER_A, WORD_A))?.submitted).toBe(true)
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
  })
  it('keeps unknown reply across restart; recovery never reads permission or redispatches', async () => {
    jest
      .mocked(supabase.functions.invoke)
      .mockRejectedValue(new Error('Reply lost'))
    await expect(service.submit(analysisIntent())).rejects.toThrow('Reply lost')
    restart()
    permitted = false
    process.env.EXPO_PUBLIC_DICTIONARY_SHARED_ANALYSIS_ENABLED = 'false'
    sequence = HEAD_2
    revision = REVISION_2
    rpc.mockClear()
    await service.recover(OWNER_A, WORD_A)
    expect(rpc.mock.calls.some(([name]) => name === ACTOR)).toBe(false)
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1)
    expect((await cached()).get(WORD_A)?.card.head_sequence).toBe(HEAD_2)
  })
  it('persists publication and debt before following-flag withdrawal prevents refresh', async () => {
    jest.mocked(supabase.functions.invoke).mockImplementation(async () => {
      process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED = 'false'
      return { data: analysisReceipt(), error: null }
    })
    await expect(service.submit(analysisIntent())).rejects.toThrow('disabled')
    expect((await journal.read(OWNER_A, WORD_A))?.response).toEqual(
      analysisReceipt()
    )
    expect(await cache.getPendingRefreshWordIds(OWNER_A)).toContain(WORD_A)
    expect((await cached()).get(WORD_A)?.card.head_sequence).toBe(HEAD_1)
    process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED = 'true'
    sequence = HEAD_2
    revision = REVISION_2
    await service.recover(OWNER_A, WORD_A)
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1)
  })
  it('rejects stale publication hydration before cache/debt acknowledgement', async () => {
    jest
      .mocked(supabase.functions.invoke)
      .mockResolvedValue({ data: analysisReceipt(), error: null })
    await expect(service.submit(analysisIntent())).rejects.toThrow(
      'not hydrated'
    )
    expect((await journal.read(OWNER_A, WORD_A))?.response).toEqual(
      analysisReceipt()
    )
    expect((await cached()).get(WORD_A)?.card.head_sequence).toBe(HEAD_1)
    expect(await cache.getPendingRefreshWordIds(OWNER_A)).toContain(WORD_A)
  })
  it('accepts a later rollback head without restoring an older receipt head', async () => {
    await service.submit(analysisIntent())
    sequence = '9007199254740995'
    revision = REVISION_1
    await service.recover(OWNER_A, WORD_A)
    expect((await cached()).get(WORD_A)?.card.reference?.revision_id).toBe(
      REVISION_1
    )
    expect((await cached()).get(WORD_A)?.card.head_sequence).toBe(sequence)
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1)
  })
  it('hydrates no-change against the unchanged head without altering words or SRS', async () => {
    const words = db.prepare(WORDS_SQL).all()
    const unchanged = analysisReceipt('no-change')
    jest
      .mocked(supabase.functions.invoke)
      .mockResolvedValue({ data: unchanged, error: null })
    expect((await service.submit(analysisIntent())).response).toEqual(unchanged)
    expect((await cached()).get(WORD_A)?.card.head_sequence).toBe(HEAD_1)
    expect(db.prepare(WORDS_SQL).all()).toEqual(words)
    expect(await cache.getPendingRefreshWordIds(OWNER_A)).toEqual([])
  })
  it('leaves cache/debt intact on a publication pointing to another entry', async () => {
    rpc.mockImplementation(async (name, args) => {
      if (name === EFFECTIVE) {
        const batch = followingBatch(HEAD_2, REVISION_2, args?.p_word_ids ?? [])
        batch.cards.forEach(card => {
          if (card.reference) card.reference.entry_id = OWNER_B
        })
        batch.revisions.forEach(item => {
          item.entry_id = OWNER_B
        })
        return response(batch)
      }
      return defaultRpc(name, args)
    })
    await expect(service.submit(analysisIntent())).rejects.toThrow(
      'reference is unavailable'
    )
    expect((await cached()).get(WORD_A)?.card.head_sequence).toBe(HEAD_1)
    expect(await cache.getPendingRefreshWordIds(OWNER_A)).toContain(WORD_A)
  })
  it.each(['permission', 'token', 'reply', 'hydration'] as const)(
    'latches A-to-B-to-A during %s and always removes auth listeners',
    async phase => {
      if (phase === 'token')
        jest.mocked(supabase.auth.getSession).mockImplementation(async () => {
          emit(OWNER_B)
          emit(OWNER_A)
          return {
            data: {
              session: {
                user: { id: OWNER_A },
                access_token: 'synthetic-session',
              },
            },
            error: null,
          } as Awaited<ReturnType<typeof supabase.auth.getSession>>
        })
      else if (phase === 'reply')
        jest.mocked(supabase.functions.invoke).mockImplementation(async () => {
          emit(OWNER_B)
          emit(OWNER_A)
          return { data: analysisReceipt(), error: null }
        })
      else
        rpc.mockImplementation(async (name, args) => {
          if (name === (phase === 'permission' ? ACTOR : EFFECTIVE)) {
            emit(OWNER_B)
            emit(OWNER_A)
          }
          return defaultRpc(name, args)
        })
      await expect(service.submit(analysisIntent())).rejects.toThrow(
        AUTH_CHANGED
      )
      expect((await cached()).get(WORD_A)?.card.head_sequence).toBe(HEAD_1)
      if (phase === 'permission' || phase === 'token')
        expect(supabase.functions.invoke).not.toHaveBeenCalled()
      if (phase === 'hydration') {
        expect(supabase.functions.invoke).toHaveBeenCalledTimes(1)
        expect((await journal.read(OWNER_A, WORD_A))?.response).toEqual(
          analysisReceipt()
        )
      }
    }
  )
  it('preserves pending private-content commands and rejects their publication hydration', async () => {
    db.prepare(
      `INSERT INTO dictionary_content_commands(operation_id,user_id,word_id,kind,expected_content_version,payload_json,queued_at)
   VALUES ('pending-private',?,?, 'edit-private',0,'{}',?)`
    ).run(OWNER_A, WORD_A, AT)
    const before = db.prepare(COMMANDS_SQL).all()
    await expect(service.submit(analysisIntent())).rejects.toThrow()
    expect(db.prepare(COMMANDS_SQL).all()).toEqual(before)
    expect((await cached()).get(WORD_A)?.card.head_sequence).toBe(HEAD_1)
  })
  it('rejects unauthenticated and foreign captured owners before accessing journal or endpoint', async () => {
    emit(null)
    await expect(service.recover(OWNER_A, WORD_A)).rejects.toThrow(AUTH_CHANGED)
    emit(OWNER_B)
    await expect(service.submit(analysisIntent())).rejects.toThrow(AUTH_CHANGED)
    expect(supabase.functions.invoke).not.toHaveBeenCalled()
    expect(db.prepare(DEBT_SQL).all()).toHaveLength(2)
  })
  const savedPublication = async () => {
    jest
      .mocked(supabase.functions.invoke)
      .mockResolvedValue({ data: analysisReceipt(), error: null })
    await expect(service.submit(analysisIntent())).rejects.toThrow(
      'not hydrated'
    )
    const operation = (await journal.read(OWNER_A, WORD_A))!
    sequence = HEAD_2
    revision = REVISION_2
    rpc.mockClear()
    return operation
  }
  it('loads a saved publication after restart with analysis permission and flag OFF using reads only', async () => {
    const operation = await savedPublication()
    const words = db.prepare(WORDS_SQL).all()
    restart()
    permitted = false
    process.env.EXPO_PUBLIC_DICTIONARY_SHARED_ANALYSIS_ENABLED = 'false'
    await service.loadPublished(operation)
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      CAPABILITY,
      EFFECTIVE,
      EFFECTIVE,
    ])
    expect(await journal.read(OWNER_A, WORD_A)).toEqual(operation)
    for (const item of (await cached()).values())
      expect(item.card.head_sequence).toBe(HEAD_2)
    expect(db.prepare(WORDS_SQL).all()).toEqual(words)
    expect(db.prepare(COMMANDS_SQL).all()).toEqual([])
    expect(await cache.getPendingRefreshWordIds(OWNER_A)).toEqual([])
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1)
  })
  it.each([
    'offline',
    'missing-revision',
    'following-disabled',
    'local-flag',
  ] as const)(
    'retains receipt, old cache and refresh debt on %s, then retries reads only',
    async kind => {
      const operation = await savedPublication()
      if (kind === 'local-flag')
        process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED = 'false'
      else
        rpc.mockImplementation(async (name, args) => {
          if (name === EFFECTIVE && kind === 'offline')
            throw new Error('Offline')
          if (name === EFFECTIVE && kind === 'missing-revision') {
            const batch = followingBatch(
              sequence,
              revision,
              args?.p_word_ids ?? []
            )
            batch.revisions = []
            return response(batch)
          }
          if (name === CAPABILITY && kind === 'following-disabled')
            return response({
              dictionary_content_protocol: 2,
              read_protocol_versions: [1, 2],
              command_protocol_versions: [1, 2],
              following_enabled: false,
              shared_analysis_enabled: false,
            })
          return defaultRpc(name, args)
        })
      await expect(service.loadPublished(operation)).rejects.toThrow()
      expect(await journal.read(OWNER_A, WORD_A)).toEqual(operation)
      expect((await cached()).get(WORD_A)?.card.head_sequence).toBe(HEAD_1)
      expect(await cache.getPendingRefreshWordIds(OWNER_A)).toContain(WORD_A)
      restart()
      process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED = 'true'
      rpc.mockImplementation(defaultRpc)
      await service.loadPublished(operation)
      expect((await cached()).get(WORD_A2)?.card.head_sequence).toBe(HEAD_2)
      expect(
        rpc.mock.calls.some(([name]) => [RECEIPT, ACTOR].includes(name))
      ).toBe(false)
      expect(supabase.functions.invoke).toHaveBeenCalledTimes(1)
    }
  )
  it('rejects a replaced saved operation before the exclusive cache transaction writes', async () => {
    const operation = await savedPublication()
    const replacement = {
      ...analysisIntent(),
      command: {
        ...analysisIntent().command,
        operation_id: 'dededede-dede-4ede-8ede-dededededede',
      },
    }
    rpc.mockImplementation(async (name, args) => {
      if (name === EFFECTIVE)
        db.prepare(
          'UPDATE dictionary_analysis_client_operations SET operation_id=?,operation_json=? WHERE user_id=? AND word_id=?'
        ).run(
          replacement.command.operation_id,
          JSON.stringify(replacement),
          OWNER_A,
          WORD_A
        )
      return defaultRpc(name, args)
    })
    await expect(service.loadPublished(operation)).rejects.toThrow()
    expect(await journal.read(OWNER_A, WORD_A)).toEqual(replacement)
    expect((await cached()).get(WORD_A)?.card.head_sequence).toBe(HEAD_1)
    expect(await cache.getPendingRefreshWordIds(OWNER_A)).toContain(WORD_A)
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1)
  })
  it.each(['unmount', 'owner-roundtrip'] as const)(
    'rejects %s during the publication read without committing cache',
    async kind => {
      const operation = await savedPublication()
      let active = true
      rpc.mockImplementation(async (name, args) => {
        if (name === EFFECTIVE) {
          if (kind === 'unmount') active = false
          else {
            emit(OWNER_B)
            emit(OWNER_A)
          }
        }
        return defaultRpc(name, args)
      })
      await expect(
        service.loadPublished(operation, () => {
          if (!active) throw new Error('View closed')
        })
      ).rejects.toThrow()
      expect((await cached()).get(WORD_A)?.card.head_sequence).toBe(HEAD_1)
      expect(await journal.read(OWNER_A, WORD_A)).toEqual(operation)
      expect(await cache.getPendingRefreshWordIds(OWNER_A)).toContain(WORD_A)
      expect(supabase.functions.invoke).toHaveBeenCalledTimes(1)
    }
  )
  it('preserves learning edits made during publication hydration and accepts a later rollback head', async () => {
    const operation = await savedPublication()
    sequence = '9007199254740995'
    revision = REVISION_1
    rpc.mockImplementation(async (name, args) => {
      if (name === EFFECTIVE)
        db.prepare('UPDATE words SET repetition_count=99 WHERE word_id=?').run(
          WORD_A2
        )
      return defaultRpc(name, args)
    })
    await service.loadPublished(operation)
    expect((await cached()).get(WORD_A2)?.card.head_sequence).toBe(sequence)
    expect((await cached()).get(WORD_A2)?.card.reference?.revision_id).toBe(
      REVISION_1
    )
    expect(
      db
        .prepare('SELECT repetition_count FROM words WHERE word_id=?')
        .get(WORD_A2)
    ).toEqual({ repetition_count: 99 })
    expect(await journal.read(OWNER_A, WORD_A)).toEqual(operation)
  })
})

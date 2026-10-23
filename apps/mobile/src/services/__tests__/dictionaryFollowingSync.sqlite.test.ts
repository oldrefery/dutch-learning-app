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
import { getDatabase } from '@/db/initDB'
import { createTestDatabase } from '@/db/__tests__/sqlite.fixture'
import { dictionaryFollowingRepository as repository } from '@/db/dictionaryFollowingRepository'
import { dictionaryContentRepository as legacy } from '@/db/dictionaryContentRepository'
import {
  AT,
  OWNER_A,
  OWNER_B,
  WORD_A,
  WORD_A2,
  WORD_B,
  ENTRY,
  REVISION_1,
  REVISION_2,
  followingBatch,
  followingPage,
  followingContent,
} from '@/db/__tests__/dictionaryFollowing.fixture'
import { dictionaryFollowingSync as sync } from '../dictionaryFollowingSync'

jest.mock('@/db/initDB')
jest.mock('@/lib/supabase')

type RpcArgs = { p_word_ids?: string[]; p_after?: string; p_limit?: number }
type AuthListener = (event: AuthChangeEvent, session: Session | null) => void
const CAPABILITY_RPC = 'dictionary_content_capability_v2'
const EFFECTIVE_RPC = 'get_dictionary_effective_content_v2'
const CHANGES_RPC = 'get_dictionary_content_changes_v2'
const CARDS_SQL =
  'SELECT * FROM dictionary_effective_card_cache ORDER BY word_id'
const WORDS_SQL = 'SELECT * FROM words ORDER BY word_id'
const COMMANDS_SQL = 'SELECT * FROM dictionary_content_commands'
const AUTH_CHANGED = 'Authentication changed'
const NETWORK_ERROR = 'network-error'
const DEBT_SQL = 'SELECT * FROM dictionary_following_refresh_queue'
const LEGACY_SQL = 'SELECT * FROM dictionary_card_content'
const capability = {
  dictionary_content_protocol: 2,
  read_protocol_versions: [1, 2],
  command_protocol_versions: [1],
  following_enabled: true,
  shared_analysis_enabled: false,
}
const response = (data: unknown): PostgrestSingleResponse<unknown> => ({
  data,
  error: null,
  count: null,
  status: 200,
  statusText: 'OK',
})
const failure = (code = NETWORK_ERROR): PostgrestSingleResponse<unknown> => ({
  data: null,
  error: { code, message: code, details: '', hint: '', name: 'PostgrestError' },
  count: null,
  status: 400,
  statusText: 'Error',
})
const rpc = supabase.rpc as unknown as jest.Mock<
  Promise<PostgrestSingleResponse<unknown>>,
  [string, RpcArgs?]
>
const syntheticId = (index: number) =>
  `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`

describe('dormant protocol2 sync against file-backed SQLite', () => {
  let db: DatabaseSync
  let directory: string
  let path: string
  let currentOwner: string | null
  let listeners: Set<AuthListener>
  let sequence: string
  let revision: string
  const previousContentFlag = process.env.EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED
  const previousFollowingFlag =
    process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED

  const addWord = (id: string, owner = OWNER_A) => {
    db.prepare(
      `INSERT INTO words(word_id, user_id, dutch_lemma, translations,
      next_review_date, created_at, updated_at, interval_days, repetition_count,
      easiness_factor, sync_status) VALUES (?, ?, ?, '{}', '2026-10-11',
      ?, ?, 7, 8, 2.35, 'synced')`
    ).run(id, owner, `fixture-${id}`, AT, AT)
  }
  const emit = (event: AuthChangeEvent, owner: string | null) => {
    currentOwner = owner
    const session = owner === null ? null : ({ user: { id: owner } } as Session)
    listeners.forEach(listener => listener(event, session))
  }
  const defaultRpc = async (name: string, args?: RpcArgs) => {
    if (name === CAPABILITY_RPC) return response(capability)
    if (name === EFFECTIVE_RPC)
      return response(
        followingBatch(sequence, revision, args?.p_word_ids ?? [])
      )
    if (name === CHANGES_RPC)
      return response(followingPage(args?.p_after ?? '0', sequence, revision))
    throw new Error(`Unexpected RPC: ${name}`)
  }
  const restart = () => {
    db.close()
    db = createTestDatabase(path, false)
  }
  const cached = async (ids = [WORD_A]) =>
    repository.getCachedCards(OWNER_A, ids)
  const seed = async (ids = [WORD_A]) => {
    await sync.pull(OWNER_A, ids)
    rpc.mockClear()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED = 'true'
    process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED = 'true'
    currentOwner = OWNER_A
    listeners = new Set()
    sequence = '9'
    revision = REVISION_1
    rpc.mockReset().mockImplementation(defaultRpc)
    Object.assign(supabase.auth, { getUser: jest.fn() })
    jest.mocked(supabase.auth.getUser).mockImplementation(
      async () =>
        ({
          data: { user: currentOwner === null ? null : { id: currentOwner } },
          error: null,
        }) as Awaited<ReturnType<typeof supabase.auth.getUser>>
    )
    jest
      .mocked(supabase.auth.onAuthStateChange)
      .mockImplementation(listener => {
        listeners.add(listener)
        return {
          data: {
            subscription: {
              id: 'following-test-owner',
              callback: listener,
              unsubscribe: () => {
                listeners.delete(listener)
              },
            },
          },
        }
      })
    directory = mkdtempSync(join(tmpdir(), 'dictionary-following-sync-'))
    path = join(directory, 'fixture.sqlite')
    db = createTestDatabase(path)
    addWord(WORD_A)
    addWord(WORD_B, OWNER_B)
  })

  afterEach(() => {
    expect(listeners.size).toBe(0)
    db.close()
    rmSync(directory, { recursive: true, force: true })
  })
  afterAll(() => {
    if (previousContentFlag === undefined)
      delete process.env.EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED
    else
      process.env.EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED = previousContentFlag
    if (previousFollowingFlag === undefined)
      delete process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED
    else
      process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED =
        previousFollowingFlag
  })

  it.each([
    [undefined, undefined],
    ['true', undefined],
    ['false', 'true'],
    ['true', 'TRUE'],
  ])(
    'requires both exact build-time opt-ins (%s, %s)',
    async (content, following) => {
      if (content === undefined)
        delete process.env.EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED
      else process.env.EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED = content
      if (following === undefined)
        delete process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED
      else process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED = following
      expect(await sync.isAvailable(OWNER_A)).toBe(false)
      expect(await sync.pull(OWNER_A, [WORD_A])).toBe(0)
      expect(await sync.pullRequired(OWNER_A)).toBe(0)
      expect(await sync.refreshChanges(OWNER_A)).toBe(0)
      expect(rpc).not.toHaveBeenCalled()
      expect(supabase.auth.getUser).not.toHaveBeenCalled()
      expect(await repository.getMissingCardWordIds(OWNER_A)).toEqual([WORD_A])
      expect(db.prepare(DEBT_SQL).all()).toEqual([])
    }
  )

  it.each([
    response({ ...capability, following_enabled: false }),
    response({ dictionary_content_protocol: 1 }),
    response({ ...capability, read_protocol_versions: [1] }),
    failure('PGRST202'),
    failure('42883'),
  ])(
    'fails closed on disabled, old, invalid or missing capability',
    async result => {
      rpc.mockResolvedValue(result)
      expect(await sync.isAvailable(OWNER_A)).toBe(false)
      await expect(sync.pull(OWNER_A, [WORD_A])).rejects.toThrow('unavailable')
      expect(rpc.mock.calls.every(([name]) => name === CAPABILITY_RPC)).toBe(
        true
      )
      expect(db.prepare(CARDS_SQL).all()).toEqual([])
      expect(await repository.getMissingCardWordIds(OWNER_A)).toEqual([WORD_A])
    }
  )

  it('persists refresh debt before even the capability RPC; failed probe remains retryable after restart', async () => {
    await seed()
    rpc.mockImplementation(async name => {
      expect(name).toBe(CAPABILITY_RPC)
      expect(await repository.getMissingCardWordIds(OWNER_A)).toEqual([WORD_A])
      return failure()
    })
    await expect(sync.pull(OWNER_A, [WORD_A])).rejects.toMatchObject({
      code: NETWORK_ERROR,
    })
    restart()
    expect((await cached()).get(WORD_A)?.card.head_sequence).toBe('9')
    rpc.mockImplementation(defaultRpc)
    expect(await sync.pullRequired(OWNER_A)).toBe(1)
    expect(await repository.getMissingCardWordIds(OWNER_A)).toEqual([])
  })

  it('hydrates a complete batch without changing learning, v1 state or the delivery cursor', async () => {
    const before = db.prepare(WORDS_SQL).all()
    expect(await sync.pullRequired(OWNER_A, [WORD_A, WORD_A])).toBe(1)
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      CAPABILITY_RPC,
      EFFECTIVE_RPC,
    ])
    expect(
      (await cached()).get(WORD_A)?.revision?.content.translations?.en
    ).toEqual(['house'])
    expect(await repository.getChangeCursor(OWNER_A)).toBe('0')
    expect(await repository.getMissingCardWordIds(OWNER_A)).toEqual([])
    expect(db.prepare(WORDS_SQL).all()).toEqual(before)
    expect(db.prepare(LEGACY_SQL).all()).toEqual([])
    expect(await cached([WORD_B])).toEqual(new Map())
  })

  it('acknowledges an exact BIGINT page only with every affected reference and dependency', async () => {
    addWord(WORD_A2)
    await seed([WORD_A, WORD_A2])
    sequence = '9007199254740993'
    revision = REVISION_2
    expect(await sync.refreshChanges(OWNER_A)).toBe(1)
    expect(await repository.getChangeCursor(OWNER_A)).toBe(sequence)
    const cards = await cached([WORD_A, WORD_A2])
    expect([...cards.values()].map(row => row.card.head_sequence)).toEqual([
      sequence,
      sequence,
    ])
    expect(rpc).toHaveBeenCalledWith(CHANGES_RPC, {
      p_after: '0',
      p_limit: 200,
    })
    expect(rpc).toHaveBeenCalledWith(EFFECTIVE_RPC, {
      p_word_ids: [WORD_A, WORD_A2].sort(),
    })
    expect(await repository.getChangeCursor(OWNER_B)).toBe('0')
  })

  it.each([
    'missing-card',
    'missing-revision',
    'numeric-sequence',
    'unrequested-card',
  ])('retains the previous page/cache and debt on %s', async problem => {
    await seed()
    sequence = '10'
    revision = REVISION_2
    const before = db.prepare(CARDS_SQL).all()
    rpc.mockImplementation(async (name, args) => {
      if (name !== EFFECTIVE_RPC) return defaultRpc(name, args)
      const batch: Record<string, unknown> = {
        ...followingBatch(sequence, revision),
      }
      if (problem === 'missing-card') batch.cards = []
      if (problem === 'missing-revision') batch.revisions = []
      if (problem === 'numeric-sequence') batch.watermark = 10
      if (problem === 'unrequested-card')
        batch.cards = followingBatch(sequence, revision, [WORD_B]).cards
      return response(batch)
    })
    await expect(sync.refreshChanges(OWNER_A)).rejects.toThrow()
    expect(db.prepare(CARDS_SQL).all()).toEqual(before)
    expect(await repository.getChangeCursor(OWNER_A)).toBe('0')
    expect(await repository.getMissingCardWordIds(OWNER_A)).toEqual([WORD_A])
  })

  it('recovers known page debt after offline failure and file-backed restart', async () => {
    await seed()
    sequence = '10'
    revision = REVISION_2
    rpc.mockImplementation((name, args) =>
      name === EFFECTIVE_RPC
        ? Promise.resolve(failure())
        : defaultRpc(name, args)
    )
    await expect(sync.refreshChanges(OWNER_A)).rejects.toMatchObject({
      code: NETWORK_ERROR,
    })
    restart()
    expect(await repository.getMissingCardWordIds(OWNER_A)).toEqual([WORD_A])
    expect((await cached()).get(WORD_A)?.revision?.revision_id).toBe(REVISION_1)
    rpc.mockImplementation(defaultRpc)
    expect(await sync.pullRequired(OWNER_A)).toBe(1)
    expect(await repository.getChangeCursor(OWNER_A)).toBe('0')
    expect(await sync.refreshChanges(OWNER_A)).toBe(1)
    expect(await repository.getChangeCursor(OWNER_A)).toBe('10')
    expect(await repository.getMissingCardWordIds(OWNER_A)).toEqual([])
  })

  it('refetches a whole shared entry when a targeted read discovers cached siblings', async () => {
    addWord(WORD_A2)
    await seed([WORD_A, WORD_A2])
    sequence = '10'
    revision = REVISION_2
    expect(await sync.pull(OWNER_A, [WORD_A])).toBe(2)
    const reads = rpc.mock.calls.filter(([name]) => name === EFFECTIVE_RPC)
    expect(reads.map(([, args]) => args?.p_word_ids)).toEqual([
      [WORD_A],
      [WORD_A, WORD_A2],
    ])
    expect(
      [...(await cached([WORD_A, WORD_A2])).values()].every(
        row => row.revision?.revision_id === REVISION_2
      )
    ).toBe(true)
    expect(await repository.getChangeCursor(OWNER_A)).toBe('0')
  })

  it('includes legacy reference siblings without converting or clearing their private originals', async () => {
    addWord(WORD_A2)
    await legacy.saveCardStates([
      {
        word_id: WORD_A2,
        user_id: OWNER_A,
        content_version: 1,
        reference: { entry_id: ENTRY, revision_id: REVISION_1 },
        fallback_content: null,
        overrides: {},
        updated_at: AT,
      },
    ])
    const original = db.prepare(LEGACY_SQL).all()
    expect(await sync.pull(OWNER_A, [WORD_A])).toBe(2)
    expect(db.prepare(LEGACY_SQL).all()).toEqual(original)
    expect((await cached([WORD_A2])).size).toBe(1)
  })

  it('batches 1001 cards; mixed snapshot heads fail atomically and a complete retry succeeds', async () => {
    const ids = Array.from({ length: 1001 }, (_, index) => syntheticId(index))
    ids.forEach(id => addWord(id))
    rpc.mockImplementation((name, args) =>
      name === EFFECTIVE_RPC
        ? Promise.resolve(
            response(
              followingBatch(
                args?.p_word_ids?.length === 1 ? '10' : '9',
                REVISION_1,
                args?.p_word_ids
              )
            )
          )
        : defaultRpc(name, args)
    )
    await expect(sync.pull(OWNER_A, ids)).rejects.toThrow('head changed')
    expect(db.prepare(CARDS_SQL).all()).toEqual([])
    expect(
      rpc.mock.calls
        .filter(([name]) => name === EFFECTIVE_RPC)
        .map(([, args]) => args?.p_word_ids?.length)
    ).toEqual([1000, 1])
    rpc.mockImplementation(defaultRpc)
    expect(await sync.pull(OWNER_A, ids)).toBe(1001)
    expect((await cached(ids)).size).toBe(1001)
  })

  it('fences a late response behind a newer successful request', async () => {
    let finish!: (result: PostgrestSingleResponse<unknown>) => void
    let sent!: () => void
    const dispatched = new Promise<void>(resolve => {
      sent = resolve
    })
    rpc.mockImplementationOnce(defaultRpc).mockImplementationOnce(() => {
      sent()
      return new Promise(resolve => {
        finish = resolve
      })
    })
    const old = sync.pull(OWNER_A, [WORD_A])
    const oldResult = expect(old).rejects.toThrow()
    await dispatched
    sequence = '10'
    revision = REVISION_2
    await sync.pull(OWNER_A, [WORD_A])
    finish(response(followingBatch('9')))
    await oldResult
    expect((await cached()).get(WORD_A)?.revision?.revision_id).toBe(REVISION_2)
    expect(await repository.getMissingCardWordIds(OWNER_A)).toEqual([])
  })

  it('rejects A to B to A even when getUser again reports A; a new run recovers its debt', async () => {
    await seed()
    sequence = '10'
    rpc.mockImplementation(async (name, args) => {
      if (name === EFFECTIVE_RPC) {
        emit('SIGNED_IN', OWNER_B)
        emit('SIGNED_IN', OWNER_A)
      }
      return defaultRpc(name, args)
    })
    await expect(sync.refreshChanges(OWNER_A)).rejects.toThrow(AUTH_CHANGED)
    expect(await repository.getChangeCursor(OWNER_A)).toBe('0')
    expect((await cached()).get(WORD_A)?.card.head_sequence).toBe('9')
    restart()
    rpc.mockImplementation(defaultRpc)
    expect(await sync.pullRequired(OWNER_A)).toBe(1)
  })

  it('rejects sign-out and immediate sign-in of the same owner', async () => {
    rpc.mockImplementation(async (name, args) => {
      if (name === EFFECTIVE_RPC) {
        emit('SIGNED_OUT', null)
        emit('SIGNED_IN', OWNER_A)
      }
      return defaultRpc(name, args)
    })
    await expect(sync.pull(OWNER_A, [WORD_A])).rejects.toThrow(AUTH_CHANGED)
    expect(db.prepare(CARDS_SQL).all()).toEqual([])
    expect(await repository.getMissingCardWordIds(OWNER_A)).toEqual([WORD_A])
  })

  it('allows token refresh and repeated same-owner SIGNED_IN without weakening ownership', async () => {
    rpc.mockImplementation(async (name, args) => {
      emit('TOKEN_REFRESHED', OWNER_A)
      emit('SIGNED_IN', OWNER_A)
      return defaultRpc(name, args)
    })
    expect(await sync.pull(OWNER_A, [WORD_A])).toBe(1)
    expect((await cached()).size).toBe(1)
  })

  it('rejects the wrong initial owner before debt or RPC work', async () => {
    currentOwner = OWNER_B
    await expect(sync.pull(OWNER_A, [WORD_A])).rejects.toThrow(AUTH_CHANGED)
    expect(rpc).not.toHaveBeenCalled()
    expect(db.prepare(DEBT_SQL).all()).toEqual([])
  })

  it('rolls back cache/dependency/cursor on sign-out inside the final transaction', async () => {
    await seed()
    sequence = '10'
    revision = REVISION_2
    const adapter = await getDatabase()
    const run = adapter.runAsync.bind(adapter)
    const spy = jest
      .spyOn(adapter, 'runAsync')
      .mockImplementation(async (sql, ...args) => {
        const result = await run(sql, ...args)
        if (sql.includes('INSERT INTO dictionary_following_cursors'))
          emit('SIGNED_OUT', null)
        return result
      })
    try {
      await expect(sync.refreshChanges(OWNER_A)).rejects.toThrow(AUTH_CHANGED)
      expect(await repository.getChangeCursor(OWNER_A)).toBe('0')
      expect((await cached()).get(WORD_A)?.revision?.revision_id).toBe(
        REVISION_1
      )
      expect(
        db
          .prepare(
            'SELECT * FROM dictionary_revision_cache WHERE revision_id = ?'
          )
          .get(REVISION_2)
      ).toBeUndefined()
      expect(await repository.getMissingCardWordIds(OWNER_A)).toEqual([WORD_A])
    } finally {
      spy.mockRestore()
    }
  })

  it('retains debt when the build flag is disabled during a response', async () => {
    rpc.mockImplementation(async (name, args) => {
      if (name === EFFECTIVE_RPC)
        process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED = 'false'
      return defaultRpc(name, args)
    })
    await expect(sync.pull(OWNER_A, [WORD_A])).rejects.toThrow('disabled')
    expect(db.prepare(CARDS_SQL).all()).toEqual([])
    expect(await repository.getMissingCardWordIds(OWNER_A)).toEqual([WORD_A])
  })

  it('preserves pending v1 commands and learning; v2 does not acknowledge a legacy receipt', async () => {
    await legacy.queueCommand(OWNER_A, {
      protocol_version: 1,
      operation_id: REVISION_2,
      word_id: WORD_A,
      expected_content_version: 0,
      kind: 'create-private',
      content: followingContent,
    })
    const beforeWords = db.prepare(WORDS_SQL).all()
    const beforeCommands = db.prepare(COMMANDS_SQL).all()
    await expect(sync.pull(OWNER_A, [WORD_A])).rejects.toThrow('reconciliation')
    expect(db.prepare(COMMANDS_SQL).all()).toEqual(beforeCommands)
    expect(db.prepare(WORDS_SQL).all()).toEqual(beforeWords)
    expect(db.prepare(CARDS_SQL).all()).toEqual([])
  })

  it('never silently restores a following card to legacy mode', async () => {
    await seed()
    sequence = '10'
    rpc.mockImplementation((name, args) => {
      if (name !== EFFECTIVE_RPC) return defaultRpc(name, args)
      const batch = followingBatch(sequence)
      batch.cards = [
        {
          word_id: WORD_A,
          mode: 'legacy',
          content_version: '9007199254740993',
          reference: null,
          adopted_revision_id: null,
          head_sequence: null,
          legacy_content: {
            ...followingContent,
            examples: [],
            conjugation: null,
            usage_notes: null,
          },
          removed_fields: [],
          cefr: { level: null, status: 'unknown', confidence: null },
        },
      ]
      batch.revisions = []
      return Promise.resolve(response(batch))
    })
    await expect(sync.refreshChanges(OWNER_A)).rejects.toThrow(
      'reviewed reconciliation'
    )
    expect((await cached()).get(WORD_A)?.card.mode).toBe('follow')
    expect(await repository.getChangeCursor(OWNER_A)).toBe('0')
  })

  it('commits only successful pages; retry resumes from the last committed cursor and supports rollback', async () => {
    await seed()
    sequence = '10'
    revision = REVISION_2
    rpc.mockImplementation(async (name, args) => {
      if (name === CHANGES_RPC && args?.p_after === '0')
        return response({
          ...followingPage('0', '10', REVISION_2),
          latest_cursor: '11',
          has_more: true,
        })
      if (name === CHANGES_RPC) {
        sequence = '11'
        revision = REVISION_1
      }
      if (name === EFFECTIVE_RPC && sequence === '11') return failure()
      return defaultRpc(name, args)
    })
    await expect(sync.refreshChanges(OWNER_A)).rejects.toMatchObject({
      code: NETWORK_ERROR,
    })
    expect(await repository.getChangeCursor(OWNER_A)).toBe('10')
    expect((await cached()).get(WORD_A)?.revision?.revision_id).toBe(REVISION_2)
    rpc.mockImplementation(defaultRpc)
    expect(await sync.refreshChanges(OWNER_A)).toBe(1)
    expect(await repository.getChangeCursor(OWNER_A)).toBe('11')
    expect((await cached()).get(WORD_A)?.revision?.revision_id).toBe(REVISION_1)
  })

  it('rejects a page that belongs to another requested cursor', async () => {
    rpc.mockImplementation((name, args) =>
      name === CHANGES_RPC
        ? Promise.resolve(response(followingPage('1', '9')))
        : defaultRpc(name, args)
    )
    await expect(sync.refreshChanges(OWNER_A)).rejects.toThrow('boundary')
    expect(await repository.getChangeCursor(OWNER_A)).toBe('0')
    expect(db.prepare(CARDS_SQL).all()).toEqual([])
  })

  it('bounds an ongoing change stream and retains the last committed empty-reference page for retry', async () => {
    rpc.mockImplementation(async (name, args) => {
      if (name !== CHANGES_RPC) return defaultRpc(name, args)
      const after = args?.p_after ?? '0'
      const next = String(BigInt(after) + BigInt(1))
      return response({
        ...followingPage(after, next),
        has_more: true,
        latest_cursor: String(BigInt(next) + BigInt(1)),
      })
    })
    await expect(sync.refreshChanges(OWNER_A)).rejects.toThrow('limit reached')
    expect(await repository.getChangeCursor(OWNER_A)).toBe('50')
    expect(
      rpc.mock.calls.filter(([name]) => name === CHANGES_RPC)
    ).toHaveLength(50)
    expect(rpc.mock.calls.some(([name]) => name === EFFECTIVE_RPC)).toBe(false)
  })

  it('bounds requests before Auth/RPC/SQLite work', async () => {
    const ids = Array.from({ length: 10001 }, (_, index) => syntheticId(index))
    await expect(sync.pull(OWNER_A, ids)).rejects.toThrow('size')
    expect(rpc).not.toHaveBeenCalled()
    expect(supabase.auth.getUser).not.toHaveBeenCalled()
    expect(db.prepare(DEBT_SQL).all()).toEqual([])
  })

  it('reports enabled capability and avoids requests when no work remains', async () => {
    expect(await sync.isAvailable(OWNER_A)).toBe(true)
    await seed()
    expect(await sync.pull(OWNER_A, [])).toBe(0)
    expect(await sync.pullRequired(OWNER_A)).toBe(0)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('rejects a foreign requested word before network dispatch', async () => {
    await expect(sync.pull(OWNER_A, [WORD_B])).rejects.toThrow()
    expect(rpc).not.toHaveBeenCalled()
    expect(db.prepare(DEBT_SQL).all()).toEqual([])
  })

  it('rolls back preparation if Auth changes while persisting debt', async () => {
    const adapter = await getDatabase()
    const run = adapter.runAsync.bind(adapter)
    const spy = jest
      .spyOn(adapter, 'runAsync')
      .mockImplementation(async (sql, ...args) => {
        const result = await run(sql, ...args)
        if (sql.includes('INSERT INTO dictionary_following_refresh_queue'))
          emit('SIGNED_OUT', null)
        return result
      })
    try {
      await expect(sync.pull(OWNER_A, [WORD_A])).rejects.toThrow(AUTH_CHANGED)
      expect(db.prepare(DEBT_SQL).all()).toEqual([])
      expect(rpc).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })

  it('also checks getUser after a response when no Auth event was delivered', async () => {
    rpc.mockImplementation(async (name, args) => {
      if (name === EFFECTIVE_RPC) currentOwner = OWNER_B
      return defaultRpc(name, args)
    })
    await expect(sync.pull(OWNER_A, [WORD_A])).rejects.toThrow(AUTH_CHANGED)
    expect(db.prepare(CARDS_SQL).all()).toEqual([])
  })

  it('releases its Auth listener on a getUser failure', async () => {
    jest.mocked(supabase.auth.getUser).mockResolvedValueOnce({
      data: { user: null },
      error: new Error('Auth unavailable'),
    } as Awaited<ReturnType<typeof supabase.auth.getUser>>)
    await expect(sync.isAvailable(OWNER_A)).rejects.toThrow('Auth unavailable')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('bounds expanding references without committing a partial group', async () => {
    const siblings = [WORD_A2, syntheticId(2001), syntheticId(2002)]
    const entries = [ENTRY, syntheticId(3001), syntheticId(3002)]
    for (const [index, word_id] of siblings.entries()) {
      addWord(word_id)
      await legacy.saveCardStates([
        {
          word_id,
          user_id: OWNER_A,
          content_version: 1,
          reference: { entry_id: entries[index], revision_id: REVISION_1 },
          fallback_content: null,
          overrides: {},
          updated_at: AT,
        },
      ])
    }
    let pass = 0
    rpc.mockImplementation((name, args) => {
      if (name !== EFFECTIVE_RPC) return defaultRpc(name, args)
      const batch = followingBatch(sequence, revision, args?.p_word_ids)
      const entry = entries[pass++]
      batch.cards.forEach(card => {
        if (card.reference) card.reference.entry_id = entry
      })
      batch.revisions.forEach(row => {
        row.entry_id = entry
      })
      return Promise.resolve(response(batch))
    })
    await expect(sync.pull(OWNER_A, [WORD_A])).rejects.toThrow(
      'changed repeatedly'
    )
    expect(pass).toBe(3)
    expect(db.prepare(CARDS_SQL).all()).toEqual([])
    expect(await repository.getChangeCursor(OWNER_A)).toBe('0')
    expect(await repository.getMissingCardWordIds(OWNER_A)).toHaveLength(4)
  })
})

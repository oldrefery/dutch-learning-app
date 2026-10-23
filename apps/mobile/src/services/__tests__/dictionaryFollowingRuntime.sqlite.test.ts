import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import type {
  DictionaryContentCommand,
  DictionaryEffectiveBatchV2,
} from '@woordenaar/domain'
import { wordRepository } from '@/db/wordRepository'
import { getDictionaryWordMaterializations } from '@/db/dictionaryWordReads'
import { applyDictionaryMaterialization } from '@/db/dictionaryWordMaterialization'
import { projectDictionaryReadWord } from '@/db/dictionaryReadProjection'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { exportOfflineDictionaryCollection } from '../dictionaryTransferService'
import { dictionaryContentSync as facade } from '../dictionaryContentSync'
import { syncStatusService } from '../syncStatusService'
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
jest.mock('@/lib/sentry')
jest.mock('@/stores/useApplicationStore', () => ({
  useApplicationStore: { getState: jest.fn() },
}))
jest.mock('@/utils/network', () => ({
  getLastSyncTimestamp: jest.fn().mockResolvedValue(null),
  isNetworkAvailable: jest.fn().mockResolvedValue(false),
}))

type RpcArgs = {
  p_word_ids?: string[]
  p_after?: string
  p_limit?: number
  p_command?: DictionaryContentCommand
}
type AuthListener = (event: AuthChangeEvent, session: Session | null) => void
const CAPABILITY_RPC = 'dictionary_content_capability_v2'
const EFFECTIVE_RPC = 'get_dictionary_effective_content_v2'
const CHANGES_RPC = 'get_dictionary_content_changes_v2'
const CARDS_SQL =
  'SELECT * FROM dictionary_effective_card_cache ORDER BY word_id'
const WORDS_SQL = 'SELECT * FROM words ORDER BY word_id'
const COMMANDS_SQL = 'SELECT * FROM dictionary_content_commands'
const PRIVATE_PENDING = 'private pending'
const RESOLVE_REQUIRED = 'Sync or resolve'
const AUTH_CHANGED = 'Authentication changed'
const NETWORK_ERROR = 'network-error'
const LEGACY_SQL = 'SELECT * FROM dictionary_card_content'
const OLD_DEBT_SQL = 'SELECT * FROM dictionary_card_refresh_queue'
const command: DictionaryContentCommand = {
  protocol_version: 1,
  operation_id: REVISION_2,
  word_id: WORD_A,
  expected_content_version: 0,
  kind: 'create-private',
  content: followingContent,
}
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

describe('coordinated mobile following runtime in file-backed SQLite', () => {
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

  const receiptRpc = (
    name: string,
    args?: RpcArgs,
    receiptChanges: Record<string, unknown> = {}
  ) =>
    name === 'apply_dictionary_content_command_v1'
      ? Promise.resolve(
          response({
            ...args?.p_command,
            content_version:
              (args?.p_command?.expected_content_version ?? 0) + 1,
            idempotent: true,
            ...receiptChanges,
          })
        )
      : defaultRpc(name, args)
  const pushRpc = (receiptChanges: Record<string, unknown> = {}) =>
    rpc.mockImplementation((name, args) =>
      receiptRpc(name, args, receiptChanges)
    )
  const materialized = async () => {
    const word = await wordRepository.getWordByIdAndUserId(WORD_A, OWNER_A)
    if (!word) throw new Error('Missing fixture word')
    return applyDictionaryMaterialization(
      word,
      (await getDictionaryWordMaterializations(OWNER_A, [WORD_A])).get(WORD_A)
    )
  }
  const legacyBatch = (version = '0'): DictionaryEffectiveBatchV2 => ({
    protocol_version: 2,
    watermark: sequence,
    revisions: [],
    cards: [
      {
        word_id: WORD_A,
        mode: 'legacy',
        content_version: version,
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
    ],
  })
  const returnLegacy = (version = '0') =>
    rpc.mockImplementation((name, args) =>
      name === EFFECTIVE_RPC
        ? Promise.resolve(response(legacyBatch(version)))
        : defaultRpc(name, args)
    )

  it('requires captured owner for v2 capability and never downgrades to v1', async () => {
    await expect(facade.isAvailable()).rejects.toThrow('owner')
    expect(rpc).not.toHaveBeenCalled()
    expect(await facade.isAvailable(OWNER_A)).toBe(true)
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([CAPABILITY_RPC])
  })
  it('hydrates the complete owner vocabulary through the facade without another owner', async () => {
    addWord(WORD_A2)
    expect(await facade.pull(OWNER_A)).toBe(2)
    expect((await cached([WORD_A, WORD_A2, WORD_B])).size).toBe(2)
    expect(rpc.mock.calls.some(([name]) => name.endsWith('_v1'))).toBe(false)
  })
  it('returns requested coverage while refreshing a newly discovered sibling', async () => {
    addWord(WORD_A2)
    await seed([WORD_A2])
    sequence = '10'
    revision = REVISION_2
    expect(await facade.pull(OWNER_A, [WORD_A])).toBe(1)
    expect(
      (await cached([WORD_A, WORD_A2])).get(WORD_A2)?.revision?.revision_id
    ).toBe(REVISION_2)
  })
  it('acknowledges verified v1 receipts only with a complete v2 result, preserving personal rows', async () => {
    await legacy.queueCommand(OWNER_A, command)
    const before = db.prepare(WORDS_SQL).all()
    pushRpc()
    expect(await facade.push(OWNER_A)).toBe(1)
    expect(db.prepare(COMMANDS_SQL).all()).toEqual([])
    expect(db.prepare(WORDS_SQL).all()).toEqual(before)
    expect(db.prepare(LEGACY_SQL).all()).toEqual([])
    expect((await cached()).get(WORD_A)?.card.content_version).toBe(
      '9007199254740992'
    )
  })
  it('retains the same intent after a lost read reply and retries idempotently after restart', async () => {
    await legacy.queueCommand(OWNER_A, command)
    const before = db.prepare(COMMANDS_SQL).all()
    pushRpc()
    const successful = receiptRpc
    rpc.mockImplementation((name, args) =>
      name === EFFECTIVE_RPC
        ? Promise.resolve(failure())
        : successful(name, args)
    )
    await expect(facade.push(OWNER_A)).rejects.toMatchObject({
      code: NETWORK_ERROR,
    })
    expect(db.prepare(COMMANDS_SQL).all()).toEqual(before)
    expect(await repository.getPendingRefreshWordIds(OWNER_A)).toEqual([WORD_A])
    restart()
    pushRpc()
    expect(await facade.push(OWNER_A)).toBe(1)
    expect(db.prepare(COMMANDS_SQL).all()).toEqual([])
    expect(await repository.getPendingRefreshWordIds(OWNER_A)).toEqual([])
  })
  it.each([
    { word_id: WORD_B },
    { operation_id: REVISION_1 },
    { content_version: 2 },
    { idempotent: 'yes' },
    { kind: 'set-overrides' },
    { protocol_version: 2 },
  ])(
    'rejects an invalid legacy receipt before v2 hydration: %j',
    async changes => {
      await legacy.queueCommand(OWNER_A, command)
      const before = db.prepare(COMMANDS_SQL).all()
      pushRpc(changes)
      await expect(facade.push(OWNER_A)).rejects.toThrow('receipt')
      expect(db.prepare(COMMANDS_SQL).all()).toEqual(before)
      expect(db.prepare(CARDS_SQL).all()).toEqual([])
      expect(rpc.mock.calls.some(([name]) => name === EFFECTIVE_RPC)).toBe(
        false
      )
    }
  )
  it.each([
    'payload',
    'conflict',
    'extra-command',
    'missing-card',
    'insufficient-version',
  ] as const)('rolls back acknowledgement for %s', async fault => {
    await legacy.queueCommand(OWNER_A, command)
    let expected: unknown
    rpc.mockImplementation(async (name, args) => {
      if (name !== EFFECTIVE_RPC) return defaultRpc(name, args)
      if (fault === 'payload')
        db.prepare('UPDATE dictionary_content_commands SET payload_json=?').run(
          JSON.stringify({
            ...command,
            content: {
              ...followingContent,
              analysis_notes: 'changed private intent',
            },
          })
        )
      if (fault === 'conflict')
        await legacy.markCommandIssue(
          OWNER_A,
          command.operation_id,
          'conflict',
          'Needs resolution'
        )
      if (fault === 'extra-command')
        await legacy.queueCommand(OWNER_A, {
          ...command,
          operation_id: REVISION_1,
        })
      expected = db.prepare(COMMANDS_SQL).all()
      const batch = followingBatch(sequence, revision, args?.p_word_ids)
      if (fault === 'missing-card') batch.cards = []
      if (fault === 'insufficient-version') batch.cards[0].content_version = '0'
      return response(batch)
    })
    await expect(facade.pull(OWNER_A, [WORD_A], [command])).rejects.toThrow()
    expect(db.prepare(COMMANDS_SQL).all()).toEqual(expected)
    expect(db.prepare(CARDS_SQL).all()).toEqual([])
    expect(await repository.getChangeCursor(OWNER_A)).toBe('0')
    expect(await repository.getPendingRefreshWordIds(OWNER_A)).toEqual([WORD_A])
  })
  it('rolls back a receipt deletion when Auth changes inside the cache transaction', async () => {
    await legacy.queueCommand(OWNER_A, command)
    const before = db.prepare(COMMANDS_SQL).all()
    const adapter = await getDatabase()
    const run = adapter.runAsync.bind(adapter)
    const spy = jest
      .spyOn(adapter, 'runAsync')
      .mockImplementation(async (sql, ...args) => {
        const result = await run(sql, ...args)
        if (sql.startsWith('DELETE FROM dictionary_content_commands'))
          emit('SIGNED_OUT', null)
        return result
      })
    try {
      await expect(facade.pull(OWNER_A, [WORD_A], [command])).rejects.toThrow(
        AUTH_CHANGED
      )
      expect(db.prepare(COMMANDS_SQL).all()).toEqual(before)
      expect(db.prepare(CARDS_SQL).all()).toEqual([])
    } finally {
      spy.mockRestore()
    }
  })
  it('keeps the outer push owner latch across A to B to A', async () => {
    await legacy.queueCommand(OWNER_A, command)
    pushRpc()
    const successful = receiptRpc
    rpc.mockImplementation(async (name, args) => {
      if (name === 'apply_dictionary_content_command_v1') {
        emit('SIGNED_IN', OWNER_B)
        emit('SIGNED_IN', OWNER_A)
      }
      return successful(name, args)
    })
    await expect(facade.push(OWNER_A)).rejects.toThrow(AUTH_CHANGED)
    expect(db.prepare(COMMANDS_SQL).all()).toHaveLength(1)
    expect(db.prepare(CARDS_SQL).all()).toEqual([])
  })
  it('moves old refresh debt before dispatch and retains it as v2 debt on network failure/restart', async () => {
    await seed()
    await legacy.requireCardRefresh(OWNER_A, [WORD_A])
    rpc.mockImplementation(async (name, args) => {
      if (name === EFFECTIVE_RPC) {
        expect(db.prepare(OLD_DEBT_SQL).all()).toEqual([])
        return failure()
      }
      return defaultRpc(name, args)
    })
    await expect(facade.pullRequired(OWNER_A)).rejects.toMatchObject({
      code: NETWORK_ERROR,
    })
    restart()
    expect(await repository.getPendingRefreshWordIds(OWNER_A)).toEqual([WORD_A])
    expect((await syncStatusService.getSnapshot(OWNER_A)).pendingWords).toBe(1)
    rpc.mockImplementation(defaultRpc)
    expect(await facade.pullRequired(OWNER_A)).toBe(1)
    expect((await syncStatusService.getSnapshot(OWNER_A)).pendingWords).toBe(0)
  })
  it('retains a newer old refresh request arriving during network hydration', async () => {
    await seed()
    await legacy.requireCardRefresh(OWNER_A, [WORD_A])
    rpc.mockImplementation(async (name, args) => {
      if (name === EFFECTIVE_RPC)
        await legacy.requireCardRefresh(OWNER_A, [WORD_A])
      return defaultRpc(name, args)
    })
    expect(await facade.pullRequired(OWNER_A)).toBe(1)
    expect(await repository.getPendingRefreshWordIds(OWNER_A)).toEqual([])
    expect(await repository.getLegacyRefreshWordIds(OWNER_A)).toEqual([WORD_A])
    expect((await syncStatusService.getSnapshot(OWNER_A)).pendingWords).toBe(1)
    rpc.mockImplementation(defaultRpc)
    expect(await facade.pullRequired(OWNER_A)).toBe(1)
    expect(db.prepare(OLD_DEBT_SQL).all()).toEqual([])
  })
  it('rolls back the old-to-v2 debt handoff when preparation loses its owner', async () => {
    await seed()
    await legacy.requireCardRefresh(OWNER_A, [WORD_A])
    const adapter = await getDatabase()
    const run = adapter.runAsync.bind(adapter)
    const spy = jest
      .spyOn(adapter, 'runAsync')
      .mockImplementation(async (sql, ...args) => {
        const result = await run(sql, ...args)
        if (sql.startsWith('DELETE FROM dictionary_card_refresh_queue'))
          emit('SIGNED_OUT', null)
        return result
      })
    try {
      await expect(facade.pullRequired(OWNER_A)).rejects.toThrow(AUTH_CHANGED)
      expect(await repository.getLegacyRefreshWordIds(OWNER_A)).toEqual([
        WORD_A,
      ])
      expect(await repository.getPendingRefreshWordIds(OWNER_A)).toEqual([])
      expect(rpc).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })
  it('uses v2 cache status without false debt from a missing legacy card and filters other owners', async () => {
    await seed()
    expect(db.prepare(LEGACY_SQL).all()).toEqual([])
    expect(await syncStatusService.getSnapshot(OWNER_A)).toMatchObject({
      totalLocalWords: 1,
      pendingWords: 0,
      totalPending: 0,
      isOnline: false,
    })
    expect(await syncStatusService.getSnapshot(OWNER_B)).toMatchObject({
      totalLocalWords: 1,
      pendingWords: 1,
    })
    await repository.prepareHydration(OWNER_A, [WORD_A])
    process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED = 'false'
    expect((await syncStatusService.getSnapshot(OWNER_A)).pendingWords).toBe(1)
  })
  it('materializes shared content/exact metadata, preserves learning and returns independent copies', async () => {
    sequence = '9007199254740993'
    rpc.mockImplementation((name, args) => {
      if (name !== EFFECTIVE_RPC) return defaultRpc(name, args)
      const batch = followingBatch(sequence, revision, args?.p_word_ids)
      batch.cards.forEach(card => {
        card.cefr = { level: 'A2', status: 'estimated', confidence: 0.8 }
      })
      return Promise.resolve(response(batch))
    })
    await seed()
    const first = await materialized()
    expect(first).toMatchObject({
      word_id: WORD_A,
      user_id: OWNER_A,
      dutch_lemma: 'huis',
      translations: { en: ['house'] },
      interval_days: 7,
      repetition_count: 8,
      easiness_factor: 2.35,
      next_review_date: '2026-10-11',
      dictionary_content_source: 'following',
      dictionary_content_state: {
        content_version: '9007199254740992',
        head_sequence: sequence,
        watermark: sequence,
        reference: { entry_id: ENTRY, revision_id: REVISION_1 },
      },
      cefr_level: 'A2',
      cefr_status: 'estimated',
      cefr_confidence: 0.8,
    })
    first.translations.en[0] = 'mutated'
    first.dictionary_content_state!.reference!.revision_id = REVISION_2
    const next = await materialized()
    expect(next.translations.en).toEqual(['house'])
    expect(next.dictionary_content_state?.reference?.revision_id).toBe(
      REVISION_1
    )
  })
  it('never overlays unresolved private edits or restores old content when the following flag is withdrawn', async () => {
    await seed()
    await legacy.queueCommand(OWNER_A, {
      ...command,
      content: {
        ...followingContent,
        translations: { en: ['private original'], ru: [] },
      },
    })
    process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED = 'false'
    expect(await materialized()).toMatchObject({
      translations: { en: ['house'] },
      dictionary_content_conflict: true,
      dictionary_content_state: { mode: 'follow' },
    })
    expect(db.prepare(COMMANDS_SQL).all()).toHaveLength(1)
  })
  it.each([true, false])(
    'blocks repository private reanalysis and image writes for following cards (flag=%s)',
    async enabled => {
      await seed()
      process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED = String(enabled)
      const before = db.prepare(WORDS_SQL).all()
      const word = await materialized()
      await expect(
        wordRepository.assertPrivateContentEditable(OWNER_A, WORD_A)
      ).rejects.toThrow('shared')
      await expect(
        wordRepository.updateAnalyzedWord({
          ...word,
          analysis_notes: 'private',
        })
      ).rejects.toThrow('shared')
      await expect(
        wordRepository.updateWordImage(
          WORD_A,
          OWNER_A,
          'https://example.test/private.jpg'
        )
      ).rejects.toThrow('shared')
      expect(db.prepare(WORDS_SQL).all()).toEqual(before)
      expect(db.prepare(COMMANDS_SQL).all()).toEqual([])
    }
  )
  it('rechecks the database before writing when a legacy preflight is followed by shared adoption', async () => {
    returnLegacy()
    await facade.pull(OWNER_A, [WORD_A])
    await wordRepository.assertPrivateContentEditable(OWNER_A, WORD_A)
    const original = await materialized()
    sequence = '10'
    rpc.mockImplementation(defaultRpc)
    await facade.pull(OWNER_A, [WORD_A])
    const before = db.prepare(WORDS_SQL).all()
    await expect(
      wordRepository.updateAnalyzedWord({
        ...original,
        analysis_notes: 'late private result',
      })
    ).rejects.toThrow('shared')
    expect(db.prepare(WORDS_SQL).all()).toEqual(before)
    expect(db.prepare(COMMANDS_SQL).all()).toEqual([])
  })
  it('allows learning updates for following words without creating a private content intent', async () => {
    await seed()
    await wordRepository.updateWordProgress(WORD_A, OWNER_A, {
      interval_days: 30,
      repetition_count: 9,
      next_review_date: '2026-11-10',
    })
    expect(await materialized()).toMatchObject({
      translations: { en: ['house'] },
      interval_days: 30,
      repetition_count: 9,
      next_review_date: '2026-11-10',
    })
    expect(db.prepare(COMMANDS_SQL).all()).toEqual([])
  })
  it('blocks unknown and stale legacy content before private edits; exact hydrated versions are editable', async () => {
    await expect(
      wordRepository.assertPrivateContentEditable(OWNER_A, WORD_A)
    ).rejects.toThrow(RESOLVE_REQUIRED)
    returnLegacy()
    await facade.pull(OWNER_A, [WORD_A])
    await expect(
      wordRepository.assertPrivateContentEditable(OWNER_A, WORD_A)
    ).resolves.toBeUndefined()
    await legacy.saveCardStates([
      {
        word_id: WORD_A,
        user_id: OWNER_A,
        content_version: 1,
        reference: null,
        fallback_content: followingContent,
        overrides: {},
        updated_at: AT,
      },
    ])
    await expect(
      wordRepository.assertPrivateContentEditable(OWNER_A, WORD_A)
    ).rejects.toThrow(RESOLVE_REQUIRED)
  })
  it('retains the legacy private pending projection rather than displaying the stale v2 cache', async () => {
    returnLegacy()
    await facade.pull(OWNER_A, [WORD_A])
    await legacy.saveCardStates([
      {
        word_id: WORD_A,
        user_id: OWNER_A,
        content_version: 0,
        reference: null,
        fallback_content: {
          ...followingContent,
          translations: { en: [PRIVATE_PENDING], ru: [] },
        },
        overrides: {},
        updated_at: AT,
      },
    ])
    await legacy.queueCommand(OWNER_A, {
      ...command,
      content: {
        ...followingContent,
        translations: { en: [PRIVATE_PENDING], ru: [] },
      },
    })
    expect(await materialized()).toMatchObject({
      translations: { en: [PRIVATE_PENDING], ru: [] },
    })
    expect((await materialized()).dictionary_content_state).toBeUndefined()
  })
  it('projects raw legacy JSON safely without altering its cache or restoring removed fields', async () => {
    const batch = legacyBatch()
    batch.cards[0].legacy_content = {
      ...followingContent,
      translations: { en: ['raw', 42], custom: 'preserved' },
      examples: [{ nl: 'Een huis', en: 'A house', custom: 9 }, {}],
      conjugation: { custom: 'preserved' },
      usage_notes: { custom: 'preserved' },
      plural: null,
      image_url: null,
    }
    rpc.mockImplementation((name, args) =>
      name === EFFECTIVE_RPC
        ? Promise.resolve(response(batch))
        : defaultRpc(name, args)
    )
    await facade.pull(OWNER_A, [WORD_A])
    const before = db.prepare(CARDS_SQL).all()
    expect(await materialized()).toMatchObject({
      translations: { en: ['raw'] },
      examples: [{ nl: 'Een huis', en: 'A house' }],
      conjugation: null,
      usage_notes: null,
      plural: null,
      image_url: null,
    })
    expect(db.prepare(CARDS_SQL).all()).toEqual(before)
    const raw = (await cached()).get(WORD_A)?.card.legacy_content
    expect(raw).toEqual(batch.cards[0].legacy_content)
    await expect(exportFixture()).rejects.toThrow()
    expect(db.prepare(CARDS_SQL).all()).toEqual(before)
  })
  const exportFixture = async () => {
    jest
      .mocked(useApplicationStore.getState)
      .mockReturnValue({ currentUserId: OWNER_A } as ReturnType<
        typeof useApplicationStore.getState
      >)
    db.prepare(
      'INSERT OR IGNORE INTO collections(collection_id,user_id,name,created_at,updated_at) VALUES (?,?,?,?,?)'
    ).run(ENTRY, OWNER_A, 'Shared offline', AT, AT)
    db.prepare('UPDATE words SET collection_id=? WHERE word_id=?').run(
      ENTRY,
      WORD_A
    )
    return exportOfflineDictionaryCollection(ENTRY)
  }
  it('exports raw canonical following content as a self-contained v1 snapshot without personal learning', async () => {
    await seed()
    const before = db.prepare(COMMANDS_SQL).all()
    const document = await exportFixture()
    expect(document.entries[0].content).toEqual(
      followingBatch('9').revisions[0].content
    )
    expect(JSON.stringify(document)).not.toContain('repetition_count')
    expect(db.prepare(COMMANDS_SQL).all()).toEqual(before)
  })
  it('rejects malformed display content instead of showing private fallback', async () => {
    const word = await materialized()
    expect(() => projectDictionaryReadWord(word, {})).toThrow('Invalid cached')
  })
})

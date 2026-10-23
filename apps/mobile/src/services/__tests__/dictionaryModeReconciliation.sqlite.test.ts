import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import type {
  AuthChangeEvent,
  Session,
  PostgrestSingleResponse,
} from '@supabase/supabase-js'
import type { DictionaryEffectiveBatchV2 } from '@woordenaar/domain'
import { supabase } from '@/lib/supabase'
import { createTestDatabase } from '@/db/__tests__/sqlite.fixture'
import { dictionaryModeReconciliationRepository as protectedModes } from '@/db/dictionaryModeReconciliationRepository'
import { wordRepository } from '@/db/wordRepository'
import { getDictionaryWordMaterializations } from '@/db/dictionaryWordReads'
import { dictionaryContentRepository as legacy } from '@/db/dictionaryContentRepository'
import { dictionaryFollowingRepository as cache } from '@/db/dictionaryFollowingRepository'
import {
  AT,
  OWNER_A,
  OWNER_B,
  WORD_A,
  WORD_A2,
  REVISION_1,
  REVISION_2,
  followingBatch,
  followingContent,
} from '@/db/__tests__/dictionaryFollowing.fixture'
import { dictionaryModeReconciliation as service } from '../dictionaryModeReconciliation'
import { dictionaryContentSync as facade } from '../dictionaryContentSync'

jest.mock('@/db/initDB')
jest.mock('@/lib/supabase')
jest.mock('@/lib/sentry')

const EFFECTIVE = 'get_dictionary_effective_content_v2'
const AUTH_CHANGED = 'Authentication changed'
const STALE_COMPARISON = 'Saved content changed'
const REVIEW_REQUIRED = 'reviewed mode reconciliation'
const DELETE_COMMANDS = 'DELETE FROM dictionary_content_commands'
const DISPOSITION = 'load-server-preserve-local' as const
const PRIVATE_NOTE = 'saved private example and note'
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
const rpc = supabase.rpc as unknown as jest.Mock<
  Promise<PostgrestSingleResponse<unknown>>,
  [string, unknown?]
>
type AuthListener = (event: AuthChangeEvent, session: Session | null) => void

const state = {
  word_id: WORD_A,
  user_id: OWNER_A,
  content_version: 1,
  reference: null,
  fallback_content: {
    ...followingContent,
    analysis_notes: PRIVATE_NOTE,
    image_url: 'https://example.test/private.jpg',
  },
  overrides: {},
  updated_at: AT,
}
const command = {
  protocol_version: 1 as const,
  operation_id: REVISION_2,
  word_id: WORD_A,
  expected_content_version: 1,
  kind: 'edit-private' as const,
  overrides: { analysis_notes: { op: 'set' as const, value: PRIVATE_NOTE } },
}

describe('reviewed mode comparison and apply with real private queues and SQLite', () => {
  let db: DatabaseSync
  let directory: string
  let path: string
  let currentOwner: string | null
  let listeners: Set<AuthListener>
  let batch: DictionaryEffectiveBatchV2
  const oldFlags = {
    content: process.env.EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED,
    following: process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED,
  }
  const dump = () =>
    Object.fromEntries(
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
        )
        .all()
        .map(row => [
          String(row.name),
          db.prepare(`SELECT * FROM "${String(row.name)}"`).all(),
        ])
    )
  const restart = () => {
    db.close()
    db = createTestDatabase(path, false)
  }
  const emit = (owner: string | null) => {
    currentOwner = owner
    const session = owner === null ? null : ({ user: { id: owner } } as Session)
    listeners.forEach(listener =>
      listener(owner === null ? 'SIGNED_OUT' : 'SIGNED_IN', session)
    )
  }
  beforeEach(async () => {
    jest.clearAllMocks()
    process.env.EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED = 'true'
    process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED = 'true'
    currentOwner = OWNER_A
    listeners = new Set()
    batch = followingBatch('9')
    Object.assign(supabase.auth, { getUser: jest.fn() })
    jest.mocked(supabase.auth.getUser).mockImplementation(
      async () =>
        ({
          data: { user: currentOwner ? { id: currentOwner } : null },
          error: null,
        }) as Awaited<ReturnType<typeof supabase.auth.getUser>>
    )
    jest
      .mocked(supabase.auth.onAuthStateChange)
      .mockImplementation(listener => {
        listeners.add(listener)
        return {
          data: {
            subscription: { unsubscribe: () => listeners.delete(listener) },
          },
        } as unknown as ReturnType<typeof supabase.auth.onAuthStateChange>
      })
    rpc.mockReset().mockImplementation(async name => {
      if (name === 'dictionary_content_capability_v2')
        return response(capability)
      if (name === EFFECTIVE) return response(batch)
      throw new Error(`Unexpected RPC: ${name}`)
    })
    directory = mkdtempSync(join(tmpdir(), 'dictionary-mode-preview-'))
    path = join(directory, 'fixture.sqlite')
    db = createTestDatabase(path)
    db.prepare(
      `INSERT INTO words(word_id, user_id, dutch_lemma, translations,
      next_review_date, created_at, updated_at, interval_days, repetition_count, easiness_factor,
      sync_status) VALUES (?, ?, 'huis', '{}', '2026-10-11', ?, ?, 7, 8, 2.35, 'synced')`
    ).run(WORD_A, OWNER_A, AT, AT)
    await legacy.saveCardStates([state])
    await legacy.queueCommand(OWNER_A, command)
    await legacy.markCommandIssue(
      OWNER_A,
      command.operation_id,
      'conflict',
      'legacy-content-upgrade-required'
    )
  })
  afterEach(() => {
    expect(listeners.size).toBe(0)
    db.close()
    rmSync(directory, { recursive: true, force: true })
  })
  afterAll(() => {
    for (const [name, value] of [
      ['EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED', oldFlags.content],
      ['EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED', oldFlags.following],
    ]) {
      if (value === undefined) delete process.env[name as string]
      else process.env[name as string] = value
    }
  })

  it('compares an already-following server row without clearing any private/learning/cache/debt/cursor data; survives restart', async () => {
    restart()
    const before = dump()
    const preview = await facade.readConflict(OWNER_A, WORD_A)
    expect(preview).toMatchObject({
      kind: 'mode-reconciliation',
      localContent: { analysis_notes: PRIVATE_NOTE },
      remote: { card: { mode: 'follow', head_sequence: '9' } },
    })
    expect('local' in preview && preview.local.commands[0].payload_json).toBe(
      JSON.stringify(command)
    )
    expect(dump()).toEqual(before)
    restart()
    expect(dump()).toEqual(before)
    expect(await cache.getCachedCards(OWNER_A, [WORD_A])).toEqual(new Map())
    expect(rpc.mock.calls.map(call => call[0])).toEqual([
      'dictionary_content_capability_v2',
      EFFECTIVE,
    ])
  })

  it.each(['local', 'server'] as const)(
    'never routes a reviewed-mode preview through the %s v1 resolver, even with flags OFF',
    async choice => {
      const preview = await service.read(OWNER_A, WORD_A)
      const before = dump()
      process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED = 'false'
      rpc.mockClear()
      await expect(facade.resolveConflict(preview, choice)).rejects.toThrow(
        'reviewed mode reconciliation'
      )
      expect(rpc).not.toHaveBeenCalled()
      expect(dump()).toEqual(before)
    }
  )

  it.each([
    'missing-revision',
    'missing-card',
    'wrong-word',
    'invalid-sequence',
  ])('rejects %s without touching saved inputs', async kind => {
    if (kind === 'missing-revision') batch.revisions = []
    if (kind === 'missing-card') batch.cards = []
    if (kind === 'wrong-word') batch.cards[0].word_id = REVISION_1
    if (kind === 'invalid-sequence') batch.cards[0].content_version = '01'
    const before = dump()
    await expect(service.read(OWNER_A, WORD_A)).rejects.toThrow()
    expect(dump()).toEqual(before)
  })

  it.each(['queue', 'original', 'deletion', 'placement', 'cache'])(
    'rejects a %s change while the comparison is loading',
    async kind => {
      rpc.mockImplementation(async name => {
        if (name !== EFFECTIVE) return response(capability)
        if (kind === 'queue')
          db.prepare(
            'UPDATE dictionary_content_commands SET last_error = ?'
          ).run('changed')
        if (kind === 'original')
          db.prepare('UPDATE dictionary_card_content SET updated_at = ?').run(
            'changed'
          )
        if (kind === 'deletion')
          db.prepare(
            'UPDATE words SET collection_id = NULL, deleted_at = ?'
          ).run(AT)
        if (kind === 'placement') {
          db.prepare(
            'INSERT INTO collections(collection_id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
          ).run(REVISION_1, OWNER_A, 'Moved', AT, AT)
          db.prepare('UPDATE words SET collection_id = ?').run(REVISION_1)
        }
        if (kind === 'cache') {
          await legacy.cacheDependencies([{ revision: batch.revisions[0] }])
          db.prepare(
            `INSERT INTO dictionary_effective_card_cache(word_id, user_id, mode, entry_id,
            revision_id, content_version, head_sequence, watermark, card_json, cached_at)
            VALUES (?, ?, 'follow', ?, ?, ?, ?, ?, ?, ?)`
          ).run(
            WORD_A,
            OWNER_A,
            batch.cards[0].reference?.entry_id ?? '',
            REVISION_1,
            batch.cards[0].content_version,
            '9',
            '9',
            JSON.stringify(batch.cards[0]),
            AT
          )
        }
        return response(batch)
      })
      await expect(service.read(OWNER_A, WORD_A)).rejects.toThrow(
        kind === 'deletion' ? 'unavailable' : STALE_COMPARISON
      )
    }
  )

  it('permits a concurrent learning update without restoring it from the preview', async () => {
    rpc.mockImplementation(async name => {
      if (name !== EFFECTIVE) return response(capability)
      db.prepare(
        'UPDATE words SET interval_days = 21, repetition_count = 9'
      ).run()
      return response(batch)
    })
    await service.read(OWNER_A, WORD_A)
    expect(
      db.prepare('SELECT interval_days, repetition_count FROM words').get()
    ).toEqual({ interval_days: 21, repetition_count: 9 })
    expect(await legacy.getPendingCommands(OWNER_A)).toHaveLength(1)
  })

  it('latches A -> B -> A during the remote request', async () => {
    const before = dump()
    rpc.mockImplementation(async name => {
      if (name !== EFFECTIVE) return response(capability)
      emit(OWNER_B)
      emit(OWNER_A)
      return response(batch)
    })
    await expect(service.read(OWNER_A, WORD_A)).rejects.toThrow(AUTH_CHANGED)
    expect(dump()).toEqual(before)
  })

  it('rejects another owner before reading personal inputs or contacting the dictionary', async () => {
    const before = dump()
    await expect(service.read(OWNER_B, WORD_A)).rejects.toThrow(AUTH_CHANGED)
    expect(rpc).not.toHaveBeenCalled()
    expect(dump()).toEqual(before)
  })

  it('rejects a withdrawn gate or unmounted caller after the reply', async () => {
    let active = true
    const before = dump()
    rpc.mockImplementation(async name => {
      if (name !== EFFECTIVE) return response(capability)
      active = false
      return response(batch)
    })
    await expect(
      service.read(OWNER_A, WORD_A, () => {
        if (!active) throw new Error('Unmounted')
      })
    ).rejects.toThrow('Unmounted')
    expect(dump()).toEqual(before)
  })

  it('previews a remote follow-to-legacy return without silently restoring local mode or replacing originals', async () => {
    db.prepare(DELETE_COMMANDS).run()
    const request = await cache.prepareHydration(OWNER_A, [WORD_A])
    await cache.commitHydration(request, [batch], () => {})
    await legacy.queueCommand(OWNER_A, command)
    batch = {
      protocol_version: 2,
      watermark: '10',
      revisions: [],
      cards: [
        {
          word_id: WORD_A,
          mode: 'legacy',
          content_version: '9007199254740993',
          reference: null,
          adopted_revision_id: null,
          head_sequence: null,
          legacy_content: JSON.parse(JSON.stringify(followingContent)),
          removed_fields: [],
          cefr: { level: null, status: 'unknown', confidence: null },
        },
      ],
    }
    const before = dump()
    const preview = await facade.readConflict(OWNER_A, WORD_A)
    expect(preview).toMatchObject({
      kind: 'mode-reconciliation',
      remote: { card: { mode: 'legacy' } },
    })
    expect(dump()).toEqual(before)
    expect(
      (await cache.getCachedCards(OWNER_A, [WORD_A])).get(WORD_A)?.card.mode
    ).toBe('follow')
  })

  it('rejects a stale legacy decision when remote mode changed before the user choice', async () => {
    const before = dump()
    await expect(
      facade.resolveConflict(
        {
          userId: OWNER_A,
          wordId: WORD_A,
          operationIds: [command.operation_id],
          localContent: state.fallback_content,
          remoteContent: followingContent,
          remoteState: state,
        },
        'local'
      )
    ).rejects.toThrow(REVIEW_REQUIRED)
    expect(dump()).toEqual(before)
    expect(rpc.mock.calls.map(call => call[0])).not.toContain(
      'apply_dictionary_content_command_v1'
    )
  })
  it('blocks a late private resolution inside the transaction after a following cache appeared, with flags OFF', async () => {
    db.prepare(DELETE_COMMANDS).run()
    const request = await cache.prepareHydration(OWNER_A, [WORD_A])
    await cache.commitHydration(request, [batch], () => {})
    await legacy.queueCommand(OWNER_A, command)
    await legacy.markCommandIssue(
      OWNER_A,
      command.operation_id,
      'conflict',
      'stale'
    )
    process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED = 'false'
    const before = dump()
    await expect(
      legacy.saveCardStates([state], [], {
        userId: OWNER_A,
        wordId: WORD_A,
        operationIds: [command.operation_id],
        replacement: null,
      })
    ).rejects.toThrow(REVIEW_REQUIRED)
    expect(dump()).toEqual(before)
  })

  it('rolls back the entire legacy resolution if its mounted owner guard fails before commit', async () => {
    let calls = 0
    const before = dump()
    await expect(
      legacy.saveCardStates([state], [], {
        userId: OWNER_A,
        wordId: WORD_A,
        operationIds: [command.operation_id],
        replacement: null,
        assertCurrent: () => {
          if (++calls === 3) throw new Error(AUTH_CHANGED)
        },
      })
    ).rejects.toThrow(AUTH_CHANGED)
    expect(dump()).toEqual(before)
    restart()
    expect(dump()).toEqual(before)
  })

  it('does not resolve a deleted word whose old command IDs still match', async () => {
    db.prepare('UPDATE words SET deleted_at = ?').run(AT)
    const before = dump()
    await expect(
      legacy.saveCardStates([state], [], {
        userId: OWNER_A,
        wordId: WORD_A,
        operationIds: [command.operation_id],
        replacement: null,
      })
    ).rejects.toThrow('unavailable')
    expect(dump()).toEqual(before)
  })
  it.each(['gate-withdrawn', 'unavailable', 'offline'])(
    'holds saved commands after %s instead of using the legacy fallback',
    async kind => {
      const before = dump()
      rpc.mockImplementation(async name => {
        if (kind === 'unavailable')
          return response({ ...capability, following_enabled: false })
        if (name !== EFFECTIVE) return response(capability)
        if (kind === 'offline') throw new Error('Offline')
        process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED = 'false'
        return response(batch)
      })
      await expect(service.read(OWNER_A, WORD_A)).rejects.toThrow()
      expect(dump()).toEqual(before)
      expect(rpc.mock.calls.map(call => call[0])).not.toContain(
        'get_dictionary_effective_content_v1'
      )
    }
  )
  it('retains explicit legacy conflict resolution when both current modes are legacy', async () => {
    db.prepare(DELETE_COMMANDS).run()
    batch = {
      protocol_version: 2,
      watermark: '9',
      revisions: [],
      cards: [
        {
          word_id: WORD_A,
          mode: 'legacy',
          content_version: '1',
          reference: null,
          adopted_revision_id: null,
          head_sequence: null,
          legacy_content: JSON.parse(JSON.stringify(followingContent)),
          removed_fields: [],
          cefr: { level: null, status: 'unknown', confidence: null },
        },
      ],
    }
    const request = await cache.prepareHydration(OWNER_A, [WORD_A])
    await cache.commitHydration(request, [batch], () => {})
    await legacy.queueCommand(OWNER_A, command)
    await legacy.markCommandIssue(
      OWNER_A,
      command.operation_id,
      'conflict',
      'stale'
    )
    const wordBefore = db.prepare('SELECT * FROM words').get()
    rpc.mockImplementation(async name => {
      if (name === 'dictionary_content_capability_v2')
        return response(capability)
      if (name === EFFECTIVE) return response(batch)
      if (name === 'get_dictionary_effective_content_v1')
        return response({
          protocol_version: 1,
          cards: [
            {
              word_id: WORD_A,
              content_version: 1,
              reference: null,
              content: followingContent,
              source: 'fallback',
              removed_fields: [],
              cefr: { level: null, status: 'unknown', confidence: null },
            },
          ],
        })
      throw new Error(`Unexpected RPC: ${name}`)
    })
    await facade.resolveConflict(
      {
        userId: OWNER_A,
        wordId: WORD_A,
        operationIds: [command.operation_id],
        localContent: state.fallback_content,
        remoteContent: followingContent,
        remoteState: { ...state, fallback_content: followingContent },
      },
      'server'
    )
    expect(await legacy.getPendingCommands(OWNER_A)).toHaveLength(0)
    expect(db.prepare('SELECT * FROM words').get()).toEqual(wordBefore)
    expect(
      (await cache.getCachedCards(OWNER_A, [WORD_A])).get(WORD_A)?.card.mode
    ).toBe('legacy')
  })
  const originals = () => ({
    words: db.prepare('SELECT * FROM words ORDER BY word_id').all(),
    private: db
      .prepare('SELECT * FROM dictionary_card_content ORDER BY word_id')
      .all(),
    commands: db
      .prepare('SELECT * FROM dictionary_content_commands ORDER BY sequence')
      .all(),
    cache: db
      .prepare('SELECT * FROM dictionary_effective_card_cache ORDER BY word_id')
      .all(),
    protected: db
      .prepare(
        'SELECT * FROM dictionary_mode_reconciliations ORDER BY operation_id'
      )
      .all(),
    cursor: db.prepare('SELECT * FROM dictionary_following_cursors').all(),
  })

  it('applies only an explicit decision, preserving exact originals and commands durably without touching learning or cursors', async () => {
    const preview = await service.read(OWNER_A, WORD_A)
    const before = originals()
    await service.apply(preview)
    expect(db.prepare('SELECT * FROM words ORDER BY word_id').all()).toEqual(
      before.words
    )
    expect(
      db.prepare('SELECT * FROM dictionary_card_content ORDER BY word_id').all()
    ).toEqual(before.private)
    expect(await legacy.getPendingCommands(OWNER_A)).toEqual([])
    const saved = await protectedModes.getProtectedDecisions(OWNER_A, WORD_A)
    expect(saved).toEqual([
      {
        disposition: DISPOSITION,
        operationId: preview.operationId,
        userId: OWNER_A,
        wordId: WORD_A,
        local: preview.local,
        remote: preview.remote,
      },
    ])
    expect(saved[0].local.commands).toEqual(before.commands)
    expect(saved[0].local.commands[0].payload_json).toBe(
      JSON.stringify(command)
    )
    expect(
      (await cache.getCachedCards(OWNER_A, [WORD_A])).get(WORD_A)?.card.mode
    ).toBe('follow')
    expect(
      db.prepare('SELECT * FROM dictionary_following_cursors').all()
    ).toEqual(before.cursor)
    expect(await cache.getPendingRefreshWordIds(OWNER_A)).toEqual([])
    expect(
      rpc.mock.calls
        .map(call => call[0])
        .every(
          name =>
            name === EFFECTIVE || name === 'dictionary_content_capability_v2'
        )
    ).toBe(true)
    restart()
    expect(await protectedModes.getProtectedDecisions(OWNER_A, WORD_A)).toEqual(
      saved
    )
    expect(await protectedModes.getProtectedDecisions(OWNER_B, WORD_A)).toEqual(
      []
    )
    db.prepare('DELETE FROM words WHERE word_id = ?').run(WORD_A)
    expect(await protectedModes.getProtectedDecisions(OWNER_A, WORD_A)).toEqual(
      saved
    )
    expect(() =>
      db
        .prepare('UPDATE dictionary_mode_reconciliations SET applied_at = ?')
        .run(AT)
    ).toThrow('immutable')
  })

  it('recovers a committed decision after restart with flags OFF and never rewinds a newer cache or performs an RPC', async () => {
    const preview = await service.read(OWNER_A, WORD_A)
    await service.apply(preview)
    const newer = followingBatch('10', REVISION_2)
    await cache.commitHydration(
      await cache.prepareHydration(OWNER_A, [WORD_A]),
      [newer],
      () => {}
    )
    restart()
    const before = dump()
    rpc.mockClear()
    process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED = 'false'
    await service.apply(preview)
    expect(dump()).toEqual(before)
    expect(rpc).not.toHaveBeenCalled()
    await expect(
      service.apply({
        ...preview,
        remote: { ...preview.remote, watermark: '10' },
      })
    ).rejects.toThrow('identity conflict')
  })

  it.each(['queue', 'original', 'raw-content', 'placement', 'deleted'])(
    'rejects an explicit decision after a local %s change',
    async kind => {
      const preview = await service.read(OWNER_A, WORD_A)
      if (kind === 'queue')
        db.prepare('UPDATE dictionary_content_commands SET last_error = ?').run(
          'later'
        )
      if (kind === 'original')
        db.prepare('UPDATE dictionary_card_content SET updated_at = ?').run(
          'later'
        )
      if (kind === 'raw-content')
        db.prepare('UPDATE words SET analysis_notes = ?').run('later')
      if (kind === 'deleted')
        db.prepare('UPDATE words SET deleted_at = ?').run(AT)
      if (kind === 'placement') {
        db.prepare(
          'INSERT INTO collections(collection_id, user_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
        ).run(REVISION_1, OWNER_A, 'Moved', AT, AT)
        db.prepare('UPDATE words SET collection_id = ?').run(REVISION_1)
      }
      const before = dump()
      await expect(service.apply(preview)).rejects.toThrow()
      expect(dump()).toEqual(before)
    }
  )

  it.each([
    'version',
    'head',
    'revision',
    'content',
    'cefr',
    'missing',
    'offline',
  ])(
    'retains exact private inputs when the fresh server %s differs',
    async kind => {
      const preview = await service.read(OWNER_A, WORD_A)
      if (kind === 'version')
        batch.cards[0].content_version = '9007199254740994'
      if (kind === 'head') batch.cards[0].head_sequence = '10'
      if (kind === 'revision') batch = followingBatch('10', REVISION_2)
      if (kind === 'content')
        batch.revisions[0].content.analysis_notes = 'changed'
      if (kind === 'cefr') batch.cards[0].cefr.status = 'estimated'
      if (kind === 'missing') batch.revisions = []
      if (kind === 'offline') rpc.mockRejectedValue(new Error('Offline'))
      const before = originals()
      await expect(service.apply(preview)).rejects.toThrow()
      expect(originals()).toEqual(before)
      expect(await cache.getPendingRefreshWordIds(OWNER_A)).toEqual([WORD_A])
      restart()
      expect(originals()).toEqual(before)
    }
  )

  it('accepts a newer unrelated publication watermark without approving changed content', async () => {
    const preview = await service.read(OWNER_A, WORD_A)
    batch.watermark = '10'
    await service.apply(preview)
    expect(
      (await cache.getCachedCards(OWNER_A, [WORD_A])).get(WORD_A)?.watermark
    ).toBe('10')
  })

  it('keeps an independent learning update made during the explicit load', async () => {
    const preview = await service.read(OWNER_A, WORD_A)
    rpc.mockImplementation(async name => {
      if (name !== EFFECTIVE) return response(capability)
      db.prepare(
        'UPDATE words SET interval_days = 31, repetition_count = 12'
      ).run()
      return response(batch)
    })
    await service.apply(preview)
    expect(
      db.prepare('SELECT interval_days, repetition_count FROM words').get()
    ).toEqual({ interval_days: 31, repetition_count: 12 })
  })

  it.each(['account-aba', 'unmounted', 'gate', 'refresh-generation'])(
    'holds originals after %s changes while the explicit load is in flight',
    async kind => {
      const preview = await service.read(OWNER_A, WORD_A)
      const before = originals()
      let active = true
      rpc.mockImplementation(async name => {
        if (name !== EFFECTIVE) return response(capability)
        if (kind === 'account-aba') {
          emit(OWNER_B)
          emit(OWNER_A)
        }
        if (kind === 'unmounted') active = false
        if (kind === 'gate')
          process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED = 'false'
        if (kind === 'refresh-generation')
          await cache.prepareHydration(OWNER_A, [WORD_A])
        return response(batch)
      })
      await expect(
        service.apply(preview, () => {
          if (!active) throw new Error('Unmounted')
        })
      ).rejects.toThrow()
      expect(originals()).toEqual(before)
    }
  )

  it('rolls back protection and command retirement if a dependency/cache write fails', async () => {
    const preview = await service.read(OWNER_A, WORD_A)
    const request = await cache.prepareHydration(OWNER_A, [WORD_A])
    db.exec(
      "CREATE TRIGGER reject_mode_cache BEFORE INSERT ON dictionary_effective_card_cache BEGIN SELECT RAISE(ABORT, 'Injected cache failure'); END"
    )
    const before = dump()
    const decision = {
      disposition: DISPOSITION,
      operationId: preview.operationId,
      userId: OWNER_A,
      wordId: WORD_A,
      local: preview.local,
      remote: preview.remote,
    }
    await expect(
      cache.commitReviewedMode(decision, request, [batch], () => {})
    ).rejects.toThrow('Injected cache failure')
    expect(dump()).toEqual(before)
    restart()
    expect(dump()).toEqual(before)
  })

  it('rolls back the entire reviewed transaction if the caller changes after archive insertion', async () => {
    const preview = await service.read(OWNER_A, WORD_A)
    const request = await cache.prepareHydration(OWNER_A, [WORD_A])
    const before = dump()
    await expect(
      cache.commitReviewedMode(
        {
          disposition: DISPOSITION,
          operationId: preview.operationId,
          userId: OWNER_A,
          wordId: WORD_A,
          local: preview.local,
          remote: preview.remote,
        },
        request,
        [batch],
        () => {
          if (
            db
              .prepare(
                'SELECT COUNT(*) AS count FROM dictionary_mode_reconciliations'
              )
              .get()?.count
          )
            throw new Error(AUTH_CHANGED)
        }
      )
    ).rejects.toThrow(AUTH_CHANGED)
    expect(dump()).toEqual(before)
  })

  it('includes cached siblings in the same complete hydration and rolls back for another unresolved private queue', async () => {
    db.prepare(DELETE_COMMANDS).run()
    db.prepare(
      `INSERT INTO words(word_id, user_id, dutch_lemma, translations, next_review_date, created_at, updated_at) VALUES (?, ?, 'huizen', '{}', '2026-10-11', ?, ?)`
    ).run(WORD_A2, OWNER_A, AT, AT)
    await cache.commitHydration(
      await cache.prepareHydration(OWNER_A, [WORD_A, WORD_A2]),
      [followingBatch('8', REVISION_1, [WORD_A, WORD_A2])],
      () => {}
    )
    await legacy.queueCommand(OWNER_A, command)
    await legacy.queueCommand(OWNER_A, {
      ...command,
      word_id: WORD_A2,
      operation_id: WORD_A2,
    })
    const preview = await service.read(OWNER_A, WORD_A)
    const before = originals()
    rpc.mockImplementation(async (name, args) =>
      name === EFFECTIVE
        ? response(
            followingBatch(
              '9',
              REVISION_1,
              (args as { p_word_ids: string[] }).p_word_ids
            )
          )
        : response(capability)
    )
    await expect(service.apply(preview)).rejects.toThrow(
      'Legacy dictionary commands'
    )
    expect(originals()).toEqual(before)
    db.prepare('DELETE FROM dictionary_content_commands WHERE word_id = ?').run(
      WORD_A2
    )
    await service.apply(preview)
    expect((await cache.getCachedCards(OWNER_A, [WORD_A, WORD_A2])).size).toBe(
      2
    )
  })

  it('surfaces a bare mode return without private commands and restores only after explicit review; selected content survives flag withdrawal', async () => {
    db.prepare(DELETE_COMMANDS).run()
    db.prepare('DELETE FROM dictionary_card_content').run()
    await cache.commitHydration(
      await cache.prepareHydration(OWNER_A, [WORD_A]),
      [batch],
      () => {}
    )
    batch = {
      protocol_version: 2,
      watermark: '10',
      revisions: [],
      cards: [
        {
          word_id: WORD_A,
          mode: 'legacy',
          content_version: '9007199254740993',
          reference: null,
          adopted_revision_id: null,
          head_sequence: null,
          legacy_content: JSON.parse(
            JSON.stringify({
              ...followingContent,
              analysis_notes: 'server restore',
            })
          ),
          removed_fields: [],
          cefr: { level: null, status: 'unknown', confidence: null },
        },
      ],
    }
    await expect(
      cache.commitHydration(
        await cache.prepareHydration(OWNER_A, [WORD_A]),
        [batch],
        () => {}
      )
    ).rejects.toThrow('reviewed reconciliation')
    expect(
      (await getDictionaryWordMaterializations(OWNER_A, [WORD_A])).get(WORD_A)
        ?.has_conflict
    ).toBe(true)
    restart()
    const preview = await service.read(OWNER_A, WORD_A)
    expect(preview.local.cachedRevision).not.toBeNull()
    await service.apply(preview)
    expect(await protectedModes.getRequiredWordIds(OWNER_A)).toEqual(new Set())
    process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED = 'false'
    const selected = (
      await getDictionaryWordMaterializations(OWNER_A, [WORD_A])
    ).get(WORD_A)
    expect(selected).toMatchObject({
      card: {
        mode: 'legacy',
        legacy_content: { analysis_notes: 'server restore' },
      },
      has_conflict: false,
    })
    expect(
      (await protectedModes.getProtectedDecisions(OWNER_A, WORD_A))[0].local
        .cachedRevision?.content_json
    ).toContain('house')
  })
  it('blocks stale private editing after explicit legacy restoration even when following is disabled', async () => {
    db.prepare(DELETE_COMMANDS).run()
    await cache.commitHydration(
      await cache.prepareHydration(OWNER_A, [WORD_A]),
      [batch],
      () => {}
    )
    batch = {
      protocol_version: 2,
      watermark: '10',
      revisions: [],
      cards: [
        {
          word_id: WORD_A,
          mode: 'legacy',
          content_version: '9007199254740993',
          reference: null,
          adopted_revision_id: null,
          head_sequence: null,
          legacy_content: JSON.parse(JSON.stringify(followingContent)),
          removed_fields: [],
          cefr: { level: null, status: 'unknown', confidence: null },
        },
      ],
    }
    const preview = await service.read(OWNER_A, WORD_A)
    await service.apply(preview)
    process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED = 'false'
    const before = dump()
    await expect(
      wordRepository.assertPrivateContentEditable(OWNER_A, WORD_A)
    ).rejects.toThrow('Sync or resolve')
    expect(dump()).toEqual(before)
  })

  it.each(['9007199254740992', '9007199254740991'])(
    'rejects a reviewed mode return with non-advancing personal version %s',
    async version => {
      db.prepare(DELETE_COMMANDS).run()
      await cache.commitHydration(
        await cache.prepareHydration(OWNER_A, [WORD_A]),
        [batch],
        () => {}
      )
      batch = {
        protocol_version: 2,
        watermark: '10',
        revisions: [],
        cards: [
          {
            word_id: WORD_A,
            mode: 'legacy',
            content_version: version,
            reference: null,
            adopted_revision_id: null,
            head_sequence: null,
            legacy_content: JSON.parse(JSON.stringify(followingContent)),
            removed_fields: [],
            cefr: { level: null, status: 'unknown', confidence: null },
          },
        ],
      }
      const preview = await service.read(OWNER_A, WORD_A)
      const before = originals()
      await expect(service.apply(preview)).rejects.toThrow(
        'Stale dictionary mode return'
      )
      expect(originals()).toEqual(before)
    }
  )
})

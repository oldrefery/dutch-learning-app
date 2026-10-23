import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { createMockWord } from '@/__tests__/helpers/factories'
import { createTestDatabase } from '@/db/__tests__/sqlite.fixture'
import { getDatabase } from '@/db/initDB'
import { wordRepository } from '@/db/wordRepository'
import { dictionaryFollowingImportRepository as journal } from '@/db/dictionaryFollowingImportRepository'
import { dictionaryFollowingRepository as cache } from '@/db/dictionaryFollowingRepository'
import { supabase } from '@/lib/supabase'
import { useApplicationStore } from '@/stores/useApplicationStore'
import {
  AT,
  OWNER_A,
  OWNER_B,
  WORD_A,
  WORD_A2,
  ENTRY,
  followingBatch,
} from '@/db/__tests__/dictionaryFollowing.fixture'
import {
  importOperation,
  importReceipt,
  importState,
  importCapability,
  recoveryOperation,
  recoveryReceipt,
  cancellationOperation,
} from '@/db/__tests__/dictionaryFollowingImport.fixture'
import {
  loadFollowingImport,
  loadFollowingExistingCard,
} from '../dictionaryFollowingImportHydration'

jest.mock('@/db/initDB')
jest.mock('@/lib/supabase')
jest.mock('@/lib/sentry')
jest.mock('@/components/AppToast', () => ({ ToastService: {} }))
jest.mock('@/stores/useHistoryStore', () => ({
  useHistoryStore: { getState: jest.fn() },
}))
jest.mock('@/stores/useApplicationStore', () => ({
  useApplicationStore: { getState: jest.fn() },
}))
const EFFECTIVE = 'get_dictionary_effective_content_v2'
const CAPABILITY = 'dictionary_content_capability_v2'
const UNAVAILABLE = 'unavailable'
const WORDS = 'SELECT * FROM words ORDER BY word_id'
const WRONG_OWNER = 'wrong-owner'
const INVALID_SRS = 'invalid-srs'
const LEARNING_ROWS = 'SELECT * FROM learning_commands'
const AUTH_CHANGED = 'Authentication changed'
const OFFLINE = 'Offline'
const rpc = supabase.rpc as unknown as jest.Mock
const from = supabase.from as unknown as jest.Mock
const response = (data: unknown) => ({ data, error: null })
const defaultRpc = async (name: string, args?: { p_word_ids?: string[] }) => {
  if (name === CAPABILITY) return response(importCapability())
  if (name === EFFECTIVE)
    return response(followingBatch(undefined, undefined, args?.p_word_ids))
  return response(importState(true))
}

describe('explicit receipt-bound personal pull and shared hydration', () => {
  let db: DatabaseSync
  let directory: string
  let path: string
  let account: string
  let listeners: Set<(event: AuthChangeEvent, session: Session | null) => void>
  let query: {
    select: jest.Mock
    eq: jest.Mock
    in: jest.Mock
    order: jest.Mock
    range: jest.Mock
  }
  const remoteWord = () => ({
    ...createMockWord({
      word_id: WORD_A,
      user_id: OWNER_A,
      collection_id: null,
      updated_at: AT,
      created_at: AT,
      interval_days: 11,
      repetition_count: 7,
    }),
    deleted_at: null,
  })
  const emit = (id: string) => {
    account = id
    listeners.forEach(fn => fn('SIGNED_IN', { user: { id } } as Session))
  }
  const saved = async () => {
    const operation = await journal.prepare(importOperation(), () => {})
    return journal.save(operation, importReceipt(), () => {})
  }
  const restart = () => {
    db.close()
    db = createTestDatabase(path, false)
  }
  beforeEach(() => {
    jest.clearAllMocks()
    directory = mkdtempSync(join(tmpdir(), 'following-hydration-'))
    path = join(directory, 'fixture.sqlite')
    db = createTestDatabase(path)
    account = OWNER_A
    listeners = new Set()
    process.env.EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED = 'true'
    process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED = 'true'
    jest
      .mocked(useApplicationStore.getState)
      .mockReturnValue({ currentUserId: OWNER_A } as never)
    Object.assign(supabase.auth, { getUser: jest.fn() })
    jest
      .mocked(supabase.auth.getUser)
      .mockImplementation(
        async () => ({ data: { user: { id: account } }, error: null }) as never
      )
    jest.mocked(supabase.auth.onAuthStateChange).mockImplementation(fn => {
      listeners.add(fn)
      return {
        data: { subscription: { unsubscribe: () => listeners.delete(fn) } },
      } as never
    })
    query = {
      select: jest.fn(),
      eq: jest.fn(),
      in: jest.fn(),
      order: jest.fn(),
      range: jest.fn(),
    }
    for (const method of [query.select, query.eq, query.in, query.order])
      method.mockReturnValue(query)
    query.range.mockImplementation(async () => response([remoteWord()]))
    from.mockReturnValue(query)
    rpc.mockImplementation(defaultRpc)
  })
  afterEach(() => {
    db.close()
    rmSync(directory, { recursive: true, force: true })
    delete process.env.EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED
    delete process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED
  })
  it('loads exact server personal state and complete shared content without a push or receipt rewrite', async () => {
    const operation = await saved()
    await loadFollowingImport(operation, () => {})
    expect(query.eq).toHaveBeenCalledWith('user_id', OWNER_A)
    expect(query.in).toHaveBeenCalledWith('word_id', [WORD_A])
    expect(from).toHaveBeenCalledTimes(1)
    expect(db.prepare(WORDS).all()).toEqual([
      expect.objectContaining({
        word_id: WORD_A,
        interval_days: 11,
        repetition_count: 7,
      }),
    ])
    expect((await cache.getCachedCards(OWNER_A, [WORD_A])).size).toBe(1)
    expect(await journal.list(OWNER_A)).toEqual([operation])
    expect(
      rpc.mock.calls.some(
        ([name]) =>
          /apply|recover|cancel/.test(name) &&
          name !== 'read_dictionary_import_recovery_v2'
      )
    ).toBe(false)
    expect(listeners.size).toBe(0)
  })
  it('retries a failed shared read after restart with the original receipt and personal state', async () => {
    const operation = await saved()
    const normal = defaultRpc
    rpc.mockImplementation(async (name, args) =>
      name === EFFECTIVE
        ? { data: null, error: new Error(OFFLINE) }
        : normal(name, args)
    )
    await expect(loadFollowingImport(operation, () => {})).rejects.toThrow(
      OFFLINE
    )
    expect(await cache.getPendingRefreshWordIds(OWNER_A)).toEqual([WORD_A])
    restart()
    rpc.mockImplementation(normal)
    await loadFollowingImport((await journal.list(OWNER_A))[0], () => {})
    expect(await cache.getPendingRefreshWordIds(OWNER_A)).toEqual([])
    expect(await journal.list(OWNER_A)).toEqual([operation])
  })
  it.each(['pending', 'error', 'conflict'])(
    'preserves unsynced personal learning and placement (%s)',
    async status => {
      const operation = await saved()
      await wordRepository.saveWords([remoteWord()])
      db.prepare(
        "UPDATE words SET interval_days=80,repetition_count=20,sync_status=?,updated_at='2026-10-11T12:00:00Z'"
      ).run(status)
      const before = db.prepare(WORDS).all()
      await loadFollowingImport(operation, () => {})
      expect(db.prepare(WORDS).all()).toEqual(before)
    }
  )
  it('preserves a newer synchronized row and hydrates all known shared siblings', async () => {
    const operation = await saved()
    await wordRepository.saveWords([
      remoteWord(),
      { ...remoteWord(), word_id: WORD_A2, dutch_lemma: 'other' },
    ])
    const request = await cache.prepareHydration(OWNER_A, [WORD_A2])
    await cache.commitHydration(
      request,
      [followingBatch(undefined, undefined, [WORD_A2])],
      () => {}
    )
    db.prepare(
      "UPDATE words SET interval_days=80,updated_at='2026-10-11T12:00:00Z' WHERE word_id=?"
    ).run(WORD_A)
    await loadFollowingImport(operation, () => {})
    expect(
      db.prepare('SELECT interval_days FROM words WHERE word_id=?').get(WORD_A)
    ).toEqual({ interval_days: 80 })
    expect(rpc).toHaveBeenCalledWith(EFFECTIVE, {
      p_word_ids: [WORD_A, WORD_A2],
    })
  })
  it.each([
    'local-deleted',
    'remote-deleted',
    WRONG_OWNER,
    'missing',
    INVALID_SRS,
  ])('refuses unavailable personal rows: %s', async kind => {
    const operation = await saved()
    await wordRepository.saveWords([remoteWord()])
    if (kind === 'local-deleted')
      db.prepare("UPDATE words SET deleted_at=?,sync_status='deleted'").run(AT)
    const before = db.prepare(WORDS).all()
    query.range.mockResolvedValue(
      response(
        kind === 'missing'
          ? []
          : [
              {
                ...remoteWord(),
                ...(kind === 'remote-deleted' ? { deleted_at: AT } : {}),
                ...(kind === WRONG_OWNER ? { user_id: OWNER_B } : {}),
                ...(kind === INVALID_SRS ? { interval_days: null } : {}),
              },
            ]
      )
    )
    await expect(loadFollowingImport(operation, () => {})).rejects.toThrow()
    expect(db.prepare(WORDS).all()).toEqual(before)
    expect(await cache.getCachedCards(OWNER_A, [WORD_A])).toEqual(new Map())
  })
  it('never merges a same-spelling personal card or another local owner', async () => {
    const operation = await saved()
    await wordRepository.saveWords([{ ...remoteWord(), word_id: WORD_A2 }])
    const before = db.prepare(WORDS).all()
    await expect(loadFollowingImport(operation, () => {})).rejects.toThrow(
      'identity conflict'
    )
    expect(db.prepare(WORDS).all()).toEqual(before)
  })
  it('preserves actual pending learning and the other owner while refreshing shared content', async () => {
    const operation = await saved()
    await wordRepository.saveWords([
      remoteWord(),
      { ...remoteWord(), word_id: WORD_A2, user_id: OWNER_B },
    ])
    db.prepare(
      'INSERT INTO learning_commands(operation_id,kind,user_id,word_id) VALUES (?, ?, ?, ?)'
    ).run(WORD_A, 'review', OWNER_A, WORD_A)
    db.prepare('UPDATE words SET interval_days=80 WHERE word_id=?').run(WORD_A)
    const before = db.prepare(WORDS).all()
    const commands = db.prepare(LEARNING_ROWS).all()
    await loadFollowingImport(operation, () => {})
    expect(db.prepare(WORDS).all()).toEqual(before)
    expect(db.prepare(LEARNING_ROWS).all()).toEqual(commands)
    expect((await cache.getCachedCards(OWNER_B, [WORD_A2])).size).toBe(0)
  })
  it('rejects another owner already holding the exact local ID', async () => {
    const operation = await saved()
    await wordRepository.saveWords([{ ...remoteWord(), user_id: OWNER_B }])
    const before = db.prepare(WORDS).all()
    await expect(loadFollowingImport(operation, () => {})).rejects.toThrow(
      'another owner'
    )
    expect(db.prepare(WORDS).all()).toEqual(before)
  })
  it('retains personal debt if an Auth change occurs during shared fetch', async () => {
    const operation = await saved()
    rpc.mockImplementation(async (name, args) => {
      if (name === EFFECTIVE) {
        emit(OWNER_B)
        emit(OWNER_A)
      }
      return defaultRpc(name, args)
    })
    await expect(loadFollowingImport(operation, () => {})).rejects.toThrow(
      AUTH_CHANGED
    )
    expect((await cache.getCachedCards(OWNER_A, [WORD_A])).size).toBe(0)
    expect(await cache.getPendingRefreshWordIds(OWNER_A)).toEqual([WORD_A])
    expect(await journal.list(OWNER_A)).toEqual([operation])
  })
  it('keeps a deleted card deleted if deletion happens during shared fetching', async () => {
    const operation = await saved()
    rpc.mockImplementation(async (name, args) => {
      if (name === EFFECTIVE)
        db.prepare(
          "UPDATE words SET deleted_at=?,sync_status='deleted' WHERE word_id=?"
        ).run(AT, WORD_A)
      return defaultRpc(name, args)
    })
    await expect(loadFollowingImport(operation, () => {})).rejects.toThrow()
    expect(
      db.prepare('SELECT deleted_at FROM words WHERE word_id=?').get(WORD_A)
    ).toEqual({ deleted_at: AT })
    expect((await cache.getCachedCards(OWNER_A, [WORD_A])).size).toBe(0)
  })
  it('fences account ABA after personal fetch before writing', async () => {
    const operation = await saved()
    query.range.mockImplementation(async () => {
      emit(OWNER_B)
      emit(OWNER_A)
      return response([remoteWord()])
    })
    await expect(loadFollowingImport(operation, () => {})).rejects.toThrow(
      AUTH_CHANGED
    )
    expect(db.prepare(WORDS).all()).toEqual([])
    expect(listeners.size).toBe(0)
  })
  it.each(['flag', 'capability', 'state', 'offline'])(
    'keeps receipts and avoids personal writes after %s withdrawal',
    async boundary => {
      const operation = await saved()
      if (boundary === 'flag')
        delete process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED
      if (boundary === 'capability')
        rpc.mockResolvedValue(
          response({ ...importCapability(), following_enabled: false })
        )
      if (boundary === 'state')
        rpc.mockImplementation(async name =>
          response(
            name === CAPABILITY
              ? importCapability()
              : {
                  ...importState(true),
                  state: UNAVAILABLE,
                  collection_id: null,
                }
          )
        )
      if (boundary === 'offline')
        query.range.mockRejectedValue(new Error(OFFLINE))
      await expect(loadFollowingImport(operation, () => {})).rejects.toThrow()
      expect(db.prepare(WORDS).all()).toEqual([])
      expect(await journal.list(OWNER_A)).toEqual([operation])
    }
  )
  it('rejects stale head/private fallback and retains pending cache debt', async () => {
    const operation = await saved()
    const normal = defaultRpc
    rpc.mockImplementation(async (name, args) =>
      name === EFFECTIVE ? response(followingBatch('1')) : normal(name, args)
    )
    await expect(loadFollowingImport(operation, () => {})).rejects.toThrow(
      'predates'
    )
    expect(await cache.getPendingRefreshWordIds(OWNER_A)).toEqual([WORD_A])
  })
  it('holds pending recovery/cancellation, then loads the confirmed recovery with original IDs', async () => {
    const operation = await saved()
    const recovery = await journal.prepare(recoveryOperation(true), () => {})
    await expect(loadFollowingImport(operation, () => {})).rejects.toThrow(
      'confirmed'
    )
    await journal.save(recovery, recoveryReceipt(), () => {})
    await loadFollowingImport(operation, () => {})
    expect((await cache.getCachedCards(OWNER_A, [WORD_A])).size).toBe(1)
    await journal.prepare(cancellationOperation(), () => {})
    await expect(loadFollowingImport(operation, () => {})).rejects.toThrow(
      'confirmed'
    )
  })
  it('holds a cancellation reserved while the personal read is in flight', async () => {
    const operation = await saved()
    query.range.mockImplementationOnce(async () => {
      await journal.prepare(cancellationOperation(), () => {})
      return response([remoteWord()])
    })
    await expect(loadFollowingImport(operation, () => {})).rejects.toThrow(
      'confirmed'
    )
    expect(db.prepare(WORDS).all()).toEqual([])
  })
  it('rejects withdrawn gates after the personal fetch and before the local commit', async () => {
    const operation = await saved()
    query.range.mockImplementationOnce(async () => {
      delete process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED
      return response([remoteWord()])
    })
    await expect(loadFollowingImport(operation, () => {})).rejects.toThrow(
      'unavailable'
    )
    expect(db.prepare(WORDS).all()).toEqual([])
  })
  it('retains newer pending placement and requires an owned active target collection', async () => {
    const operation = await saved()
    await wordRepository.saveWords([remoteWord()])
    db.prepare(
      "INSERT INTO collections(collection_id,user_id,name,created_at,updated_at,sync_status) VALUES (?,?,'Later',?,?,'synced')"
    ).run(WORD_A2, OWNER_A, AT, AT)
    db.prepare(
      "UPDATE words SET collection_id=?,sync_status='pending' WHERE word_id=?"
    ).run(WORD_A2, WORD_A)
    const before = db.prepare(WORDS).all()
    await loadFollowingImport(operation, () => {})
    expect(db.prepare(WORDS).all()).toEqual(before)
    query.range.mockResolvedValue(
      response([{ ...remoteWord(), collection_id: OWNER_B }])
    )
    await expect(loadFollowingImport(operation, () => {})).rejects.toThrow(
      'collection'
    )
    expect(db.prepare(WORDS).all()).toEqual(before)
  })
  it('inserts only into an owned active collection and leaves deleted or foreign targets untouched', async () => {
    const operation = await saved()
    db.prepare(
      "INSERT INTO collections(collection_id,user_id,name,created_at,updated_at,sync_status) VALUES (?,?,'Target',?,?,'synced')"
    ).run(WORD_A2, OWNER_A, AT, AT)
    query.range.mockResolvedValue(
      response([{ ...remoteWord(), collection_id: WORD_A2 }])
    )
    await loadFollowingImport(operation, () => {})
    expect(
      db.prepare('SELECT collection_id FROM words WHERE word_id=?').get(WORD_A)
    ).toEqual({ collection_id: WORD_A2 })
    db.prepare(
      "UPDATE collections SET sync_status='deleted' WHERE collection_id=?"
    ).run(WORD_A2)
    await expect(loadFollowingImport(operation, () => {})).rejects.toThrow(
      'collection'
    )
    db.prepare(
      "UPDATE collections SET sync_status='synced',user_id=? WHERE collection_id=?"
    ).run(OWNER_B, WORD_A2)
    await expect(loadFollowingImport(operation, () => {})).rejects.toThrow(
      'collection'
    )
  })
  it('rolls the personal write and refresh debt back if the mounted owner fence fails at commit', async () => {
    let calls = 0
    await expect(
      wordRepository.saveFollowingPersonalWord(remoteWord(), () => {
        if (++calls === 2) throw new Error('Unmounted')
      })
    ).rejects.toThrow('Unmounted')
    expect(db.prepare(WORDS).all()).toEqual([])
    expect(
      db.prepare('SELECT * FROM dictionary_following_refresh_queue').all()
    ).toEqual([])
    expect(getDatabase).toHaveBeenCalled()
  })
  const existingWord = () => ({
    ...remoteWord(),
    word_id: WORD_A2,
    dictionary_content_mode: 'follow',
    dictionary_entry_id: ENTRY,
  })
  const conflictRpc = async (
    name: string,
    args?: { p_word_ids?: string[] },
    version = 0
  ) =>
    name === 'read_dictionary_import_recovery_v2'
      ? response({ ...importState(false), recovery_version: version })
      : defaultRpc(name, args)
  const conflict = async (recovered = false) => {
    const original = await journal.prepare(importOperation(), () => {})
    const root = await journal.save(
      original,
      {
        ...importReceipt(),
        outcome: 'identity-conflict',
        existing_word_id: WORD_A2,
        reference: null,
        applied_reference: null,
        applied_head_sequence: null,
      },
      () => {}
    )
    if (recovered) {
      const recovery = await journal.prepare(recoveryOperation(), () => {})
      await journal.save(
        recovery,
        {
          ...recoveryReceipt(),
          outcome: 'identity-conflict',
          existing_word_id: WORD_A2,
        },
        () => {}
      )
    }
    query.range.mockResolvedValue(response([existingWord()]))
    rpc.mockImplementation((name, args) =>
      conflictRpc(name, args, recovered ? 1 : 0)
    )
    return root
  }
  it.each([false, true])(
    'explicitly loads the exact existing ID from an immutable conflict (recovery=%s)',
    async recovered => {
      const root = await conflict(recovered)
      const before = await journal.list(OWNER_A)
      await expect(loadFollowingImport(root, () => {})).rejects.toThrow(
        'confirmed'
      )
      await loadFollowingExistingCard(root, () => {})
      expect(query.in).toHaveBeenCalledWith('word_id', [WORD_A2])
      expect(db.prepare(WORDS).all()).toEqual([
        expect.objectContaining({
          word_id: WORD_A2,
          interval_days: 11,
          repetition_count: 7,
        }),
      ])
      expect((await cache.getCachedCards(OWNER_A, [WORD_A2])).size).toBe(1)
      expect((await cache.getCachedCards(OWNER_A, [WORD_A])).size).toBe(0)
      expect(await journal.list(OWNER_A)).toEqual(before)
      expect(
        rpc.mock.calls.some(([name]) => /^(apply|recover|cancel)_/.test(name))
      ).toBe(false)
    }
  )
  it('keeps existing pending learning, placement and the other owner intact without merging the original ID', async () => {
    const root = await conflict()
    await wordRepository.saveWords([
      existingWord(),
      { ...remoteWord(), user_id: OWNER_B },
    ])
    db.prepare(
      "UPDATE words SET interval_days=80,repetition_count=20,sync_status='pending',updated_at='2026-10-11T12:00:00Z' WHERE word_id=?"
    ).run(WORD_A2)
    db.prepare(
      'INSERT INTO learning_commands(operation_id,kind,user_id,word_id) VALUES (?,?,?,?)'
    ).run(WORD_A2, 'review', OWNER_A, WORD_A2)
    const before = db.prepare(WORDS).all()
    const commands = db.prepare(LEARNING_ROWS).all()
    await loadFollowingExistingCard(root, () => {})
    expect(db.prepare(WORDS).all()).toEqual(before)
    expect(db.prepare(LEARNING_ROWS).all()).toEqual(commands)
    expect((await cache.getCachedCards(OWNER_B, [WORD_A])).size).toBe(0)
  })
  it.each([
    'missing',
    'deleted',
    WRONG_OWNER,
    'wrong-id',
    'wrong-meaning',
    'legacy-mode',
    'missing-mode',
    'unknown-deletion',
    INVALID_SRS,
  ])(
    'rejects an existing personal row before SQLite writes: %s',
    async failure => {
      const root = await conflict()
      const row = {
        ...existingWord(),
        ...(failure === 'deleted' ? { deleted_at: AT } : {}),
        ...(failure === 'unknown-deletion' ? { deleted_at: undefined } : {}),
        ...(failure === WRONG_OWNER ? { user_id: OWNER_B } : {}),
        ...(failure === 'wrong-id' ? { word_id: WORD_A } : {}),
        ...(failure === 'wrong-meaning'
          ? { dictionary_entry_id: OWNER_B }
          : {}),
        ...(failure === 'legacy-mode'
          ? { dictionary_content_mode: 'legacy' }
          : {}),
        ...(failure === 'missing-mode'
          ? { dictionary_content_mode: undefined }
          : {}),
        ...(failure === INVALID_SRS ? { repetition_count: null } : {}),
      }
      query.range.mockResolvedValue(
        response(failure === 'missing' ? [] : [row])
      )
      await expect(loadFollowingExistingCard(root, () => {})).rejects.toThrow()
      expect(db.prepare(WORDS).all()).toEqual([])
      expect(await cache.getPendingRefreshWordIds(OWNER_A)).toEqual([])
      expect(await journal.list(OWNER_A)).toEqual([root])
    }
  )
  it.each(['deleted', 'foreign', 'semantic-collision'])(
    'preserves local existing identity boundaries: %s',
    async boundary => {
      const root = await conflict()
      await wordRepository.saveWords([
        {
          ...existingWord(),
          ...(boundary === 'foreign' ? { user_id: OWNER_B } : {}),
          ...(boundary === 'semantic-collision' ? { word_id: WORD_A } : {}),
        },
      ])
      if (boundary === 'deleted')
        db.prepare("UPDATE words SET deleted_at=?,sync_status='deleted'").run(
          AT
        )
      const before = db.prepare(WORDS).all()
      await expect(loadFollowingExistingCard(root, () => {})).rejects.toThrow()
      expect(db.prepare(WORDS).all()).toEqual(before)
      expect((await cache.getCachedCards(OWNER_A, [WORD_A2])).size).toBe(0)
    }
  )
  it('retries existing hydration after offline restart without rewriting conflict receipts or original nonces', async () => {
    const root = await conflict()
    const normal = conflictRpc
    rpc.mockImplementation(async (name, args) =>
      name === EFFECTIVE
        ? { data: null, error: new Error(OFFLINE) }
        : normal(name, args)
    )
    await expect(loadFollowingExistingCard(root, () => {})).rejects.toThrow(
      OFFLINE
    )
    expect(await cache.getPendingRefreshWordIds(OWNER_A)).toEqual([WORD_A2])
    restart()
    rpc.mockImplementation(normal)
    await loadFollowingExistingCard((await journal.list(OWNER_A))[0], () => {})
    expect(await cache.getPendingRefreshWordIds(OWNER_A)).toEqual([])
    expect(await journal.list(OWNER_A)).toEqual([root])
  })
  it.each(['personal', 'shared'] as const)(
    'fences existing-card loading after Auth ABA during %s read',
    async boundary => {
      const root = await conflict()
      if (boundary === 'personal')
        query.range.mockImplementationOnce(async () => {
          emit(OWNER_B)
          emit(OWNER_A)
          return response([existingWord()])
        })
      else {
        const normal = conflictRpc
        rpc.mockImplementation(async (name, args) => {
          if (name === EFFECTIVE) {
            emit(OWNER_B)
            emit(OWNER_A)
          }
          return normal(name, args)
        })
      }
      await expect(loadFollowingExistingCard(root, () => {})).rejects.toThrow(
        AUTH_CHANGED
      )
      expect((await cache.getCachedCards(OWNER_A, [WORD_A2])).size).toBe(0)
      expect(await journal.list(OWNER_A)).toEqual([root])
    }
  )
  it.each(['recover', 'cancel'] as const)(
    'holds a newer pending %s reserved during the existing personal fetch',
    async kind => {
      const root = await conflict()
      query.range.mockImplementationOnce(async () => {
        await journal.prepare(
          kind === 'recover' ? recoveryOperation() : cancellationOperation(),
          () => {}
        )
        return response([existingWord()])
      })
      await expect(loadFollowingExistingCard(root, () => {})).rejects.toThrow(
        'confirmed'
      )
      expect(db.prepare(WORDS).all()).toEqual([])
    }
  )
  it.each(['cancelled', 'active', 'new-version'] as const)(
    'rejects changed server root state before existing loading: %s',
    async change => {
      const root = await conflict()
      const normal = conflictRpc
      rpc.mockImplementation(async (name, args) =>
        name === 'read_dictionary_import_recovery_v2'
          ? response(
              change === 'active'
                ? importState(true)
                : {
                    ...importState(false),
                    recovery_version: 1,
                    ...(change === 'cancelled' ? { state: 'cancelled' } : {}),
                  }
            )
          : normal(name, args)
      )
      await expect(loadFollowingExistingCard(root, () => {})).rejects.toThrow(
        'recovery changed'
      )
      expect(db.prepare(WORDS).all()).toEqual([])
    }
  )
  it('checks server cancellation again after existing shared hydration', async () => {
    const root = await conflict()
    let changed = false
    const normal = conflictRpc
    rpc.mockImplementation(async (name, args) => {
      if (name === EFFECTIVE) changed = true
      if (changed && name === 'read_dictionary_import_recovery_v2')
        return response({
          ...importState(false),
          recovery_version: 1,
          state: 'cancelled',
        })
      return normal(name, args)
    })
    await expect(loadFollowingExistingCard(root, () => {})).rejects.toThrow(
      'recovery changed'
    )
    expect(await journal.list(OWNER_A)).toEqual([root])
  })

  it('rejects a different effective shared meaning without committing cache dependencies', async () => {
    const root = await conflict()
    rpc.mockImplementation(async (name, args) => {
      if (name !== EFFECTIVE) return conflictRpc(name, args)
      const batch = followingBatch(undefined, undefined, [WORD_A2])
      return response({
        ...batch,
        cards: batch.cards.map(card => ({
          ...card,
          reference: { ...card.reference!, entry_id: OWNER_B },
        })),
        revisions: batch.revisions.map(row => ({ ...row, entry_id: OWNER_B })),
      })
    })
    await expect(loadFollowingExistingCard(root, () => {})).rejects.toThrow(
      'unavailable'
    )
    expect((await cache.getCachedCards(OWNER_A, [WORD_A2])).size).toBe(0)
    expect(await cache.getPendingRefreshWordIds(OWNER_A)).toEqual([WORD_A2])
  })
})

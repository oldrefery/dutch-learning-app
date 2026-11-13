import { pullPersonalMetadata } from '@/services/dictionaryPersonalMetadataSync'
import { supabase } from '@/lib/supabase'
import { setSyncCursor } from '@/utils/network'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import type { SQLiteBindValue } from 'expo-sqlite'
import { createTestDatabase } from '@/db/__tests__/sqlite.fixture'
import { getDatabase } from '@/db/initDB'
import { wordRepository } from '@/db/wordRepository'
import type { LocalWord } from '@/db/wordRepository'
import { dictionaryFollowingRepository as following } from '@/db/dictionaryFollowingRepository'
import { dictionaryContentRepository as legacy } from '@/db/dictionaryContentRepository'
import { getDictionaryWordProjections } from '@/db/dictionaryWordReads'
import {
  personalStorageWord,
  type PersonalMetadataRow,
} from '@/db/dictionaryPersonalMetadata'
import {
  OWNER_A,
  WORD_A,
  WORD_A2,
  ENTRY,
  REVISION_1,
  REVISION_2,
  AT,
  followingBatch,
  followingContent,
} from '@/db/__tests__/dictionaryFollowing.fixture'
import { reviewEventRepository } from '@/db/reviewEventRepository'
import type { Word } from '@/types/database'
import { ExpressionType } from '@/types/ExpressionTypes'

jest.mock('@/db/initDB')
jest.mock('@/lib/sentry')
jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: jest.fn(), from: jest.fn() },
}))
jest.mock('@/utils/network', () => ({
  setSyncCursor: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('@/services/dictionaryImportOwner', () => ({
  withDictionaryOwner: async (
    _id: string,
    action: (guard: {
      assert: () => void
      check: () => Promise<void>
    }) => Promise<unknown>
  ) => action({ assert: () => {}, check: async () => {} }),
}))

// Pre-v24 readers query the ordinary table without the readiness sidecar.
const oldRepository = {
  async getWordsByUserId(owner: string): Promise<LocalWord[]> {
    const rows = db
      .prepare(
        'SELECT * FROM words WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC'
      )
      .all(owner)
    return rows.map(row => ({
      ...row,
      translations: JSON.parse(String(row.translations)),
    })) as unknown as LocalWord[]
  },
}

const meta = (
  extra: Partial<PersonalMetadataRow> = {}
): PersonalMetadataRow => ({
  word_id: WORD_A,
  user_id: OWNER_A,
  collection_id: null,
  dutch_lemma: 'huis',
  part_of_speech: 'noun',
  article: 'het',
  created_at: AT,
  updated_at: AT,
  interval_days: 7,
  repetition_count: 8,
  easiness_factor: 2.35,
  next_review_date: '2026-11-15',
  last_reviewed_at: AT,
  deleted_at: null,
  dictionary_content_mode: 'follow',
  dictionary_entry_id: ENTRY,
  dictionary_revision_id: REVISION_1,
  content_version: '9007199254740992',
  ...extra,
})
const completeMeta = (
  extra: Partial<PersonalMetadataRow> = {}
): PersonalMetadataRow => {
  const row = meta(extra)
  return {
    ...row,
    bootstrapWord: {
      ...personalStorageWord(row),
      ...followingContent,
      ...row,
      expression_type: null,
      examples: [],
      conjugation: null,
      usage_notes: null,
    },
  }
}
const REVIEWED_AT = '2026-11-12T12:00:00Z'
const NEXT_REVIEW_DATE = '2026-11-27'
const LATER_CURSOR_TIME = '2026-11-12T18:00:00Z'
const ALL_WORDS_SQL = 'SELECT * FROM words'
const ALL_PERSONAL_STATE_SQL = 'SELECT * FROM dictionary_personal_state'
const ALL_LEARNING_COMMANDS_SQL = 'SELECT * FROM learning_commands'
const MARK_SPARSE_SQL =
  'UPDATE dictionary_personal_state SET sparse=1 WHERE word_id=?'
const noop = () => {}
let db: DatabaseSync
let directory: string
let file: string
const open = async (initialize = true) => {
  db = createTestDatabase(file, initialize)
  const adapter = await getDatabase()
  const run = adapter.runAsync.bind(adapter)
  adapter.runAsync = ((
    sql: string,
    ...values: (SQLiteBindValue | SQLiteBindValue[])[]
  ) => run(sql, ...values.flat())) as typeof adapter.runAsync
}
const reopen = async () => {
  db.close()
  await open(false)
}
const debt = async () => ({
  following: await following.getPendingRefreshWordIds(OWNER_A),
  legacy: await following.getLegacyRefreshWordIds(OWNER_A),
  cursor: await following.getChangeCursor(OWNER_A),
})
const hydrate = async () => {
  const request = await following.prepareHydration(OWNER_A, [WORD_A])
  await following.commitHydration(request, [followingBatch()], noop)
}
const recordLocalReview = () =>
  reviewEventRepository.recordAssessment({
    event: {
      event_id: WORD_A2,
      word_id: WORD_A,
      user_id: OWNER_A,
      assessment: 'good',
      review_mode: 'recognition',
      answered_correctly: true,
      response_time_ms: 600,
      previous_interval_days: 7,
      next_interval_days: 15,
      previous_easiness_factor: 2.35,
      next_easiness_factor: 2.35,
      reviewed_at: REVIEWED_AT,
    },
    progress: {
      interval_days: 15,
      repetition_count: 9,
      easiness_factor: 2.35,
      next_review_date: NEXT_REVIEW_DATE,
    },
  })
beforeEach(async () => {
  jest.clearAllMocks()
  process.env.EXPO_PUBLIC_DICTIONARY_CONTENT_ENABLED = 'true'
  process.env.EXPO_PUBLIC_DICTIONARY_FOLLOWING_ENABLED = 'true'
  process.env.EXPO_PUBLIC_DICTIONARY_LIGHT_WORDS_ENABLED = 'true'
  directory = mkdtempSync(join(tmpdir(), 'd14-light-audit-'))
  file = join(directory, 'audit.sqlite')
  await open()
})
afterEach(() => {
  db.close()
  rmSync(directory, { recursive: true, force: true })
})

it('persists both refresh queues across reopen and resolves pending content without changing SRS', async () => {
  await wordRepository.savePersonalMetadata(OWNER_A, [completeMeta()], noop)
  await legacy.requireCardRefresh(OWNER_A, [WORD_A])
  const before = await debt()
  expect(before.following).toEqual([WORD_A])
  expect(before.legacy).toEqual([WORD_A])
  expect(before.cursor).toBe('0')
  expect(await wordRepository.getWordsByUserId(OWNER_A)).toEqual([])
  await reopen()
  expect(await debt()).toEqual(before)
  await hydrate()
  const visible = await wordRepository.getWordsByUserId(OWNER_A)
  expect(visible).toHaveLength(1)
  expect(visible[0]).toMatchObject({
    repetition_count: 8,
    translations: { en: ['house'] },
  })
  expect((await debt()).following).toEqual([])
  expect((await debt()).legacy).toEqual([])
  expect((await debt()).cursor).toBe('0')
})

it('rolls back rows and debt if ownership invalidates during the metadata transaction', async () => {
  let assertions = 0
  await expect(
    wordRepository.savePersonalMetadata(OWNER_A, [completeMeta()], () => {
      if (++assertions >= 3) throw new Error('audit owner changed')
    })
  ).rejects.toThrow('audit owner changed')
  await reopen()
  expect(db.prepare(ALL_WORDS_SQL).all()).toEqual([])
  expect(db.prepare(ALL_PERSONAL_STATE_SQL).all()).toEqual([])
  expect((await debt()).following).toEqual([])
})

it('rejects a mismatched revision without changing either queue or dictionary cursor', async () => {
  await wordRepository.savePersonalMetadata(OWNER_A, [completeMeta()], noop)
  await legacy.requireCardRefresh(OWNER_A, [WORD_A])
  const request = await following.prepareHydration(OWNER_A, [WORD_A])
  const before = await debt()
  const batch = followingBatch()
  batch.cards[0].adopted_revision_id = REVISION_2
  await expect(
    following.commitHydration(request, [batch], noop)
  ).rejects.toThrow()
  await reopen()
  expect(await debt()).toEqual(before)
  expect((await following.getCachedCards(OWNER_A, [WORD_A])).size).toBe(0)
})

it('preserves a provisional review, command and history through newer metadata and reopen', async () => {
  await wordRepository.savePersonalMetadata(OWNER_A, [completeMeta()], noop)
  await hydrate()
  await recordLocalReview()
  const history = db.prepare('SELECT * FROM review_events').all()
  const queue = db.prepare(ALL_LEARNING_COMMANDS_SQL).all()
  expect(history).toHaveLength(1)
  expect(queue).toHaveLength(1)
  await wordRepository.savePersonalMetadata(
    OWNER_A,
    [
      completeMeta({
        updated_at: '2026-11-12T13:00:00Z',
        repetition_count: 80,
      }),
    ],
    noop
  )
  await reopen()
  expect(db.prepare('SELECT * FROM review_events').all()).toEqual(history)
  expect(db.prepare(ALL_LEARNING_COMMANDS_SQL).all()).toEqual(queue)
  expect(
    (await wordRepository.getWordsByUserId(OWNER_A))[0].repetition_count
  ).toBe(9)
})

it('keeps a complete personal copy readable by the old reader after reopen before hydration', async () => {
  await wordRepository.savePersonalMetadata(OWNER_A, [completeMeta()], noop)
  await reopen()
  expect(await wordRepository.getWordsByUserId(OWNER_A)).toEqual([])
  const oldRows = await oldRepository.getWordsByUserId(OWNER_A)
  const oldProjection = await getDictionaryWordProjections(OWNER_A, oldRows)
  expect(oldProjection).toHaveLength(1)
  expect(oldProjection[0].translations).toEqual(followingContent.translations)
  expect(oldProjection[0].repetition_count).toBe(8)
})

it('rejects a new incomplete personal row atomically without creating a placeholder', async () => {
  await expect(
    wordRepository.savePersonalMetadata(OWNER_A, [meta()], noop)
  ).rejects.toThrow('Complete personal bootstrap is unavailable')
  await reopen()
  expect(db.prepare(ALL_WORDS_SQL).all()).toEqual([])
  expect((await debt()).following).toEqual([])
})

it('retains readability when only the light flag is disabled and the binding has not changed', async () => {
  await wordRepository.savePersonalMetadata(OWNER_A, [completeMeta()], noop)
  await hydrate()
  process.env.EXPO_PUBLIC_DICTIONARY_LIGHT_WORDS_ENABLED = 'false'
  await reopen()
  expect(
    (await wordRepository.getWordsByUserId(OWNER_A))[0].translations.en
  ).toEqual(['house'])
})

it('allows changed-adoption hydration after a full-reader fallback and reopen', async () => {
  await wordRepository.savePersonalMetadata(OWNER_A, [completeMeta()], noop)
  process.env.EXPO_PUBLIC_DICTIONARY_LIGHT_WORDS_ENABLED = 'false'
  await wordRepository.saveWords(
    [
      {
        ...personalStorageWord(meta()),
        translations: { en: ['full server copy'] },
        updated_at: '2026-11-12T14:00:00Z',
      },
    ],
    { preserveUnsynced: true, completePersonalRead: true }
  )
  const request = await following.prepareHydration(OWNER_A, [WORD_A])
  const batch = followingBatch('9007199254740994', REVISION_2)
  batch.cards[0].adopted_revision_id = REVISION_2
  batch.cards[0].content_version = '9007199254740993'
  await following.commitHydration(request, [batch], noop)
  await reopen()
  expect(await wordRepository.getWordsByUserId(OWNER_A)).toHaveLength(1)
  expect((await debt()).following).toEqual([])
  expect(db.prepare(ALL_PERSONAL_STATE_SQL).all()).toEqual([])
  expect(
    (await following.getCachedCards(OWNER_A, [WORD_A])).get(WORD_A)?.card
      .adopted_revision_id
  ).toBe(REVISION_2)
})

it.each(['light', 'full'])(
  'repairs an earlier sparse copy via %s without losing queued learning or either refresh queue',
  async mode => {
    const row = meta()
    await wordRepository.savePersonalMetadata(
      OWNER_A,
      [{ ...row, bootstrapWord: personalStorageWord(row) }],
      noop
    )
    db.prepare(
      "UPDATE words SET repetition_count=4, sync_status='pending' WHERE word_id=?"
    ).run(WORD_A)
    db.prepare(MARK_SPARSE_SQL).run(WORD_A)
    db.prepare(
      "INSERT INTO learning_commands(operation_id,kind,user_id,word_id,reset_at,review_date) VALUES (?,'reset',?,?,?,'2026-11-12')"
    ).run(WORD_A2, OWNER_A, WORD_A, AT)
    await legacy.requireCardRefresh(OWNER_A, [WORD_A])
    const before = await debt()
    await reopen()
    expect(await wordRepository.getSparsePersonalWordIds(OWNER_A)).toEqual([
      WORD_A,
    ])
    if (mode === 'light') {
      mockPublishedBootstrap(
        [[{ word_id: WORD_A, updated_at: AT, payload: row }]],
        row
      )
      await pullPersonalMetadata(OWNER_A, null)
    } else
      await wordRepository.saveWords([completeMeta().bootstrapWord!], {
        preserveUnsynced: true,
        completePersonalRead: true,
      })
    await reopen()
    expect(await wordRepository.getSparsePersonalWordIds(OWNER_A)).toEqual([])
    expect(await debt()).toEqual(before)
    const old = (await oldRepository.getWordsByUserId(OWNER_A))[0]
    expect(old.translations).toEqual(followingContent.translations)
    expect(old.repetition_count).toBe(4)
    expect(old.sync_status).toBe('pending')
    expect(
      db.prepare('SELECT operation_id FROM learning_commands').all()
    ).toEqual([{ operation_id: WORD_A2 }])
  }
)

it('keeps the sidecar and both queues if a complete fallback transaction fails', async () => {
  await wordRepository.savePersonalMetadata(OWNER_A, [completeMeta()], noop)
  await legacy.requireCardRefresh(OWNER_A, [WORD_A])
  const before = await debt()
  const state = db.prepare(ALL_PERSONAL_STATE_SQL).all()
  db.exec(
    "CREATE TRIGGER audit_fail_full BEFORE DELETE ON dictionary_personal_state BEGIN SELECT RAISE(ABORT,'audit full write failed'); END;"
  )
  await expect(
    wordRepository.saveWords([completeMeta().bootstrapWord!], {
      completePersonalRead: true,
    })
  ).rejects.toThrow('audit full write failed')
  await reopen()
  expect(await debt()).toEqual(before)
  expect(db.prepare(ALL_PERSONAL_STATE_SQL).all()).toEqual(state)
})

it('rejects a full fallback older than observed metadata without changing queues', async () => {
  await wordRepository.savePersonalMetadata(
    OWNER_A,
    [completeMeta({ updated_at: '2026-11-12T14:00:00Z' })],
    noop
  )
  const before = await debt()
  await expect(
    wordRepository.saveWords([completeMeta().bootstrapWord!], {
      completePersonalRead: true,
    })
  ).rejects.toThrow('Stale full personal row')
  await reopen()
  expect(await debt()).toEqual(before)
})

it('repairs a sparse row behind the personal cursor without moving that cursor', async () => {
  await wordRepository.savePersonalMetadata(OWNER_A, [completeMeta()], noop)
  db.prepare(MARK_SPARSE_SQL).run(WORD_A)
  db.prepare('UPDATE words SET translations=? WHERE word_id=?').run(
    JSON.stringify({ en: [] }),
    WORD_A
  )
  const responses = [[], [{ word_id: WORD_A, updated_at: AT, payload: meta() }]]
  mockPublishedBootstrap(responses, meta())
  await pullPersonalMetadata(OWNER_A, {
    id: WORD_A2,
    updatedAt: LATER_CURSOR_TIME,
  })
  expect(await wordRepository.getSparsePersonalWordIds(OWNER_A)).toEqual([])
  expect(setSyncCursor).not.toHaveBeenCalled()
  await reopen()
  expect(
    (await oldRepository.getWordsByUserId(OWNER_A))[0].translations
  ).toEqual(followingContent.translations)
  expect((await debt()).following).toEqual([WORD_A])
  expect((await debt()).cursor).toBe('0')
})

it('does not save a new placeholder or advance the cursor when personal bootstrap changes during the read', async () => {
  mockPublishedBootstrap(
    [[{ word_id: WORD_A, updated_at: AT, payload: meta() }]],
    meta({ updated_at: LATER_CURSOR_TIME })
  )
  await expect(pullPersonalMetadata(OWNER_A, null)).rejects.toThrow(
    'Personal bootstrap changed during read'
  )
  await reopen()
  expect(db.prepare(ALL_WORDS_SQL).all()).toEqual([])
  expect((await debt()).following).toEqual([])
  expect(setSyncCursor).not.toHaveBeenCalled()
})

function mockPublishedBootstrap(
  pages: unknown[],
  current: PersonalMetadataRow,
  snapshot = followingBatch()
) {
  jest.mocked(supabase.rpc).mockImplementation(
    name =>
      (name === 'd14_read_following_bootstrap_v1'
        ? Promise.resolve({
            data: {
              rows: [
                {
                  word_id: current.word_id,
                  updated_at: current.updated_at,
                  payload: current,
                },
              ],
              snapshot,
            },
            error: null,
          })
        : {
            order: () => ({
              order: async () => ({ data: pages.shift(), error: null }),
            }),
          }) as unknown as ReturnType<typeof supabase.rpc>
  )
}

it('keeps published lexical content in the local rollback row and defers queue acknowledgement', async () => {
  const batch = followingBatch('9007199254740993', REVISION_2)
  batch.revisions[0].content.usage_notes = {
    summary: 'Published note',
    contrasts: [],
  }
  batch.revisions[0].content.expression_type = ExpressionType.FIXED_EXPRESSION
  batch.revisions[0].content.is_expression = true
  const row = meta({ dutch_lemma: 'personal storage key' })
  mockPublishedBootstrap(
    [[{ word_id: WORD_A, updated_at: AT, payload: row }]],
    row,
    batch
  )
  const capture = jest.fn()
  await pullPersonalMetadata(
    OWNER_A,
    null,
    undefined,
    undefined,
    undefined,
    capture
  )
  expect(supabase.from).not.toHaveBeenCalled()
  expect(await debt()).toEqual({ following: [WORD_A], legacy: [], cursor: '0' })
  expect(capture.mock.calls[0][0].versions.get(WORD_A)).toBe(1)
  await reopen()
  expect((await oldRepository.getWordsByUserId(OWNER_A))[0]).toMatchObject({
    dutch_lemma: 'personal storage key',
    translations: { en: ['home'], ru: ['дом'] },
    expression_type: ExpressionType.FIXED_EXPRESSION,
    repetition_count: 8,
  })
  expect(
    JSON.parse(
      String(db.prepare('SELECT usage_notes FROM words').get()!.usage_notes)
    )
  ).toEqual({ summary: 'Published note', contrasts: [] })
})

it('keeps a pending lexical edit when the server can bootstrap the sparse row', async () => {
  const row = meta()
  await wordRepository.savePersonalMetadata(
    OWNER_A,
    [{ ...row, bootstrapWord: personalStorageWord(row) }],
    noop
  )
  db.prepare(MARK_SPARSE_SQL).run(WORD_A)
  db.prepare(
    "UPDATE words SET usage_notes=?, sync_status='pending' WHERE word_id=?"
  ).run(JSON.stringify({ summary: 'Local edit', contrasts: [] }), WORD_A)
  const before = db.prepare(ALL_WORDS_SQL).all()
  mockPublishedBootstrap(
    [[{ word_id: WORD_A, updated_at: AT, payload: row }]],
    row
  )
  await expect(pullPersonalMetadata(OWNER_A, null)).rejects.toThrow(
    'pending content edit'
  )
  await reopen()
  expect(db.prepare(ALL_WORDS_SQL).all()).toEqual(before)
  expect(await wordRepository.getSparsePersonalWordIds(OWNER_A)).toEqual([
    WORD_A,
  ])
  expect(setSyncCursor).not.toHaveBeenCalled()
})

it('preserves a sparse card, history and both queues when the published revision is unavailable', async () => {
  await wordRepository.savePersonalMetadata(OWNER_A, [completeMeta()], noop)
  await hydrate()
  await recordLocalReview()
  db.prepare(MARK_SPARSE_SQL).run(WORD_A)
  await legacy.requireCardRefresh(OWNER_A, [WORD_A])
  const before = [
    db.prepare(ALL_WORDS_SQL).all(),
    db.prepare(ALL_LEARNING_COMMANDS_SQL).all(),
    await reviewEventRepository.getRecentByWord(OWNER_A, WORD_A),
    await debt(),
  ]
  mockPublishedBootstrap(
    [[{ word_id: WORD_A, updated_at: AT, payload: meta() }]],
    meta(),
    {
      ...followingBatch(),
      revisions: [],
    }
  )
  await expect(pullPersonalMetadata(OWNER_A, null)).rejects.toThrow(
    'Invalid dictionary following response'
  )
  await reopen()
  expect([
    db.prepare(ALL_WORDS_SQL).all(),
    db.prepare(ALL_LEARNING_COMMANDS_SQL).all(),
    await reviewEventRepository.getRecentByWord(OWNER_A, WORD_A),
    await debt(),
  ]).toEqual(before)
  expect(setSyncCursor).not.toHaveBeenCalled()
})

const seedLegacyRecovery = async (withReview = false) => {
  const row = meta()
  await wordRepository.savePersonalMetadata(
    OWNER_A,
    [{ ...row, bootstrapWord: personalStorageWord(row) }],
    noop
  )
  if (withReview) {
    // An older reader could record a review before readiness was enforced.
    db.exec('DELETE FROM dictionary_personal_state')
    await recordLocalReview()
    await wordRepository.savePersonalMetadata(
      OWNER_A,
      [{ ...row, bootstrapWord: personalStorageWord(row) }],
      noop
    )
  }
  db.prepare(MARK_SPARSE_SQL).run(WORD_A)
  await legacy.requireCardRefresh(OWNER_A, [WORD_A])
  const metadata = meta({
    dictionary_content_mode: 'legacy',
    dictionary_entry_id: null,
    dictionary_revision_id: null,
    updated_at: '2026-11-12T15:00:00Z',
  })
  return {
    ...metadata,
    legacyWord: {
      ...personalStorageWord(metadata),
      translations: { en: ['complete private content'] },
    },
  }
}

it('shows a recovered private card after reopen and stops exact recovery behind the cursor', async () => {
  const row = await seedLegacyRecovery()
  const before = await debt()
  const cursor = { id: WORD_A2, updatedAt: LATER_CURSOR_TIME }
  const responses = [
    [],
    [{ word_id: WORD_A, updated_at: row.updated_at, payload: row.legacyWord }],
    [],
  ]
  jest.mocked(supabase.rpc).mockImplementation(
    () =>
      ({
        order: () => ({
          order: async () => ({ data: responses.shift(), error: null }),
        }),
      }) as unknown as ReturnType<typeof supabase.rpc>
  )
  await pullPersonalMetadata(OWNER_A, cursor)
  await reopen()
  expect(
    await wordRepository.getWordByIdAndUserId(WORD_A, OWNER_A)
  ).toMatchObject({
    translations: row.legacyWord.translations,
    repetition_count: 8,
  })
  expect(await wordRepository.getSparsePersonalWordIds(OWNER_A)).toEqual([])
  expect((await following.getCachedCards(OWNER_A, [WORD_A])).size).toBe(0)
  expect(await debt()).toEqual(before)
  await pullPersonalMetadata(OWNER_A, cursor)
  expect(jest.mocked(supabase.rpc).mock.calls.map(([, args]) => args)).toEqual([
    expect.objectContaining({ p_word_ids: null }),
    expect.objectContaining({ p_word_ids: [WORD_A] }),
    expect.objectContaining({ p_word_ids: null }),
  ])
  expect(supabase.from).not.toHaveBeenCalled()
  expect(setSyncCursor).not.toHaveBeenCalled()
})

const USAGE_NOTES = { summary: 'Private usage note', contrasts: [] }
const EXPRESSION_FIELDS = {
  is_expression: true,
  expression_type: ExpressionType.IDIOM,
}
const mockLegacyMetadata = (payload: Word) => {
  jest.mocked(supabase.rpc).mockImplementation(
    () =>
      ({
        order: () => ({
          order: async () => ({
            data: [
              { word_id: WORD_A, updated_at: payload.updated_at, payload },
            ],
            error: null,
          }),
        }),
      }) as unknown as ReturnType<typeof supabase.rpc>
  )
}

it.each([
  ['usage notes', { usage_notes: USAGE_NOTES }],
  ['expression type', EXPRESSION_FIELDS],
  ['both optional fields', { ...EXPRESSION_FIELDS, usage_notes: USAGE_NOTES }],
] satisfies [string, Partial<Word>][])(
  'recovers a private card with %s from the wire without losing pending learning',
  async (_label, fields) => {
    const row = await seedLegacyRecovery(true)
    mockLegacyMetadata({ ...row.legacyWord, ...fields })
    const before = await debt()
    expect(before.following).toEqual([WORD_A])
    expect(before.legacy).toEqual([WORD_A])
    const history = await reviewEventRepository.getRecentByWord(OWNER_A, WORD_A)
    const commands = db.prepare(ALL_LEARNING_COMMANDS_SQL).all()
    expect(history).toHaveLength(1)
    expect(commands).toHaveLength(1)

    await pullPersonalMetadata(OWNER_A, null)
    await reopen()
    const visible = await wordRepository.getWordByIdAndUserId(WORD_A, OWNER_A)
    expect(visible).toMatchObject({
      ...fields,
      translations: row.legacyWord.translations,
      interval_days: 15,
      repetition_count: 9,
      easiness_factor: 2.35,
      next_review_date: NEXT_REVIEW_DATE,
      last_reviewed_at: REVIEWED_AT,
      sync_status: 'pending',
    })
    expect(await wordRepository.getSparsePersonalWordIds(OWNER_A)).toEqual([])

    await pullPersonalMetadata(OWNER_A, null, [WORD_A])
    await reopen()
    expect(await wordRepository.getWordByIdAndUserId(WORD_A, OWNER_A)).toEqual(
      visible
    )
    expect(
      await reviewEventRepository.getRecentByWord(OWNER_A, WORD_A)
    ).toEqual(history)
    expect(db.prepare(ALL_LEARNING_COMMANDS_SQL).all()).toEqual(commands)
    expect(await debt()).toEqual(before)
  }
)

it.each(['untracked lexical edit', 'queued dictionary edit'])(
  'preserves a sparse row with a pending %s after legacy recovery and reopen',
  async edit => {
    const row = await seedLegacyRecovery(true)
    if (edit === 'untracked lexical edit') {
      db.prepare('UPDATE words SET usage_notes=? WHERE word_id=?').run(
        JSON.stringify({ ...USAGE_NOTES, summary: 'Keep this local note' }),
        WORD_A
      )
    } else {
      db.prepare(
        `INSERT INTO dictionary_content_commands(operation_id,user_id,word_id,kind,expected_content_version,payload_json,queued_at)
         VALUES(?,?,?,'edit-private',0,'{}',?)`
      ).run(WORD_A2, OWNER_A, WORD_A, AT)
    }
    const before = await debt()
    const words = db.prepare(ALL_WORDS_SQL).all()
    const commands = db
      .prepare('SELECT * FROM dictionary_content_commands')
      .all()
    mockLegacyMetadata({ ...row.legacyWord, usage_notes: USAGE_NOTES })
    await pullPersonalMetadata(OWNER_A, null)
    await reopen()
    expect(db.prepare(ALL_WORDS_SQL).all()).toEqual(words)
    expect(
      db.prepare('SELECT * FROM dictionary_content_commands').all()
    ).toEqual(commands)
    expect(await wordRepository.getSparsePersonalWordIds(OWNER_A)).toEqual([
      WORD_A,
    ])
    expect(await debt()).toEqual(before)
  }
)

it('rolls back the private copy and leaves both queues when readiness cannot be saved', async () => {
  const row = await seedLegacyRecovery()
  const before = await debt()
  const words = db.prepare(ALL_WORDS_SQL).all()
  db.exec(
    "CREATE TRIGGER fail_legacy_readiness BEFORE UPDATE ON dictionary_personal_state BEGIN SELECT RAISE(ABORT,'readiness write failed'); END;"
  )
  await expect(
    wordRepository.savePersonalMetadata(OWNER_A, [row], noop)
  ).rejects.toThrow('readiness write failed')
  await reopen()
  expect(db.prepare(ALL_WORDS_SQL).all()).toEqual(words)
  expect(await wordRepository.getSparsePersonalWordIds(OWNER_A)).toEqual([
    WORD_A,
  ])
  expect(await debt()).toEqual(before)
})

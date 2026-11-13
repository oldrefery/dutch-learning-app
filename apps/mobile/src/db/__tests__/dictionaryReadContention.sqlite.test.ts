import {
  DatabaseSync,
  type SQLInputValue,
  type SQLOutputValue,
  type StatementResultingChanges,
} from 'node:sqlite'
import { parseDictionaryChangePageV2 } from '@woordenaar/domain'
import { requireFollowingValue } from '../dictionaryFollowingHydration'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getDatabase } from '../initDB'
import { createTestDatabase } from './sqlite.fixture'
import { dictionaryFollowingRepository as following } from '../dictionaryFollowingRepository'
import { reviewEventRepository } from '../reviewEventRepository'
import {
  AT,
  OWNER_A,
  WORD_A,
  WORD_A2,
  REVISION_1,
  REVISION_2,
  followingBatch,
  followingPage,
} from './dictionaryFollowing.fixture'

jest.mock('../initDB')
jest.mock('@/lib/sentry')

const noop = () => {}
const deferred = () => {
  let resolve = () => {}
  const promise = new Promise<void>(done => {
    resolve = done
  })
  return { promise, resolve }
}

type Bindings = (SQLInputValue | SQLInputValue[])[]
interface ConnectionAdapter {
  getAllAsync(
    sql: string,
    ...values: Bindings
  ): Promise<Record<string, SQLOutputValue>[]>
  getFirstAsync(
    sql: string,
    ...values: Bindings
  ): Promise<Record<string, SQLOutputValue> | null>
  runAsync(sql: string, ...values: Bindings): Promise<StatementResultingChanges>
  withExclusiveTransactionAsync(
    task: (tx: ConnectionAdapter) => Promise<void>
  ): Promise<void>
}

// Expo exclusive transactions open a separate connection. The ordinary fixture
// uses one connection and cannot expose read locks held across native awaits.
function connectionAdapter(
  db: DatabaseSync,
  path: string,
  afterRead = async () => {}
): ConnectionAdapter {
  const bindings = (values: (SQLInputValue | SQLInputValue[])[]) =>
    values.length === 1 && Array.isArray(values[0])
      ? values[0]
      : (values as SQLInputValue[])
  return {
    getAllAsync: async (
      sql: string,
      ...values: (SQLInputValue | SQLInputValue[])[]
    ) => {
      const rows = db.prepare(sql).all(...bindings(values))
      if (sql.includes('json_group_array')) await afterRead()
      return rows
    },
    getFirstAsync: async (
      sql: string,
      ...values: (SQLInputValue | SQLInputValue[])[]
    ) => db.prepare(sql).get(...bindings(values)) ?? null,
    runAsync: async (
      sql: string,
      ...values: (SQLInputValue | SQLInputValue[])[]
    ) => db.prepare(sql).run(...bindings(values)),
    withExclusiveTransactionAsync: async (
      task: (tx: ConnectionAdapter) => Promise<void>
    ) => {
      const tx = new DatabaseSync(path)
      tx.exec('PRAGMA busy_timeout = 0; BEGIN')
      try {
        await task(connectionAdapter(tx, path, afterRead))
        tx.exec('COMMIT')
      } catch (error) {
        tx.exec('ROLLBACK')
        throw error
      } finally {
        tx.close()
      }
    },
  }
}

let db: DatabaseSync
let directory: string
let path: string
const installConnections = (afterRead?: () => Promise<void>) => {
  jest
    .mocked(getDatabase)
    .mockResolvedValue(
      connectionAdapter(db, path, afterRead) as unknown as Awaited<
        ReturnType<typeof getDatabase>
      >
    )
}
const reopen = () => {
  db.close()
  db = new DatabaseSync(path)
  installConnections()
}
const learning = () => ({
  words: db.prepare('SELECT * FROM words ORDER BY word_id').all(),
  history: db.prepare('SELECT * FROM review_events ORDER BY event_id').all(),
  uploads: db
    .prepare('SELECT * FROM learning_commands ORDER BY sequence')
    .all(),
})
const downloads = () => ({
  queue: db
    .prepare(
      'SELECT * FROM dictionary_following_refresh_queue ORDER BY word_id'
    )
    .all(),
  cursor: db.prepare('SELECT * FROM dictionary_following_cursors').all(),
  cache: db
    .prepare('SELECT * FROM dictionary_effective_card_cache ORDER BY word_id')
    .all(),
})

beforeEach(async () => {
  jest.clearAllMocks()
  directory = mkdtempSync(join(tmpdir(), 'dictionary-contention-'))
  path = join(directory, 'fixture.sqlite')
  db = createTestDatabase(path)
  db.prepare(
    `INSERT INTO words(word_id,user_id,dutch_lemma,translations,
    next_review_date,created_at,updated_at,interval_days,repetition_count,
    easiness_factor,sync_status) VALUES (?,?,'huis','{}','2026-11-15',?,?,7,8,2.35,'synced')`
  ).run(WORD_A, OWNER_A, AT, AT)
  const request = await following.prepareHydration(OWNER_A, [WORD_A])
  await following.commitHydration(request, [followingBatch('9')], noop)
  await reviewEventRepository.recordAssessment({
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
      reviewed_at: '2026-11-13T12:00:00Z',
    },
    progress: {
      interval_days: 15,
      repetition_count: 9,
      easiness_factor: 2.35,
      next_review_date: '2026-11-28',
    },
  })
  installConnections()
})
afterEach(() => {
  db.close()
  rmSync(directory, { recursive: true, force: true })
})

it('reproduces rollback-journal commit failure under a retained read transaction without losing either queue', async () => {
  const request = await following.prepareHydration(OWNER_A, [WORD_A])
  const before = { learning: learning(), downloads: downloads() }
  const reader = new DatabaseSync(path)
  reader.exec('BEGIN')
  reader.prepare('SELECT * FROM dictionary_effective_card_cache').all()
  try {
    await expect(
      following.commitHydration(
        request,
        [followingBatch('10', REVISION_2)],
        noop,
        followingPage('0', '10', REVISION_2)
      )
    ).rejects.toThrow('database is locked')
  } finally {
    reader.exec('ROLLBACK')
    reader.close()
  }
  reopen()
  expect({ learning: learning(), downloads: downloads() }).toEqual(before)
  await following.commitHydration(
    request,
    [followingBatch('10', REVISION_2)],
    noop,
    followingPage('0', '10', REVISION_2)
  )
  reopen()
  expect(learning()).toEqual(before.learning)
  expect(await following.getPendingRefreshWordIds(OWNER_A)).toEqual([])
  expect(await following.getChangeCursor(OWNER_A)).toBe('10')
})

it('lets a sync commit while a display read is suspended, preserving coherent card/revision pairs and pending learning after restart', async () => {
  const request = await following.prepareHydration(OWNER_A, [WORD_A])
  const before = learning()
  const read = deferred()
  const resume = deferred()
  installConnections(async () => {
    read.resolve()
    await resume.promise
  })
  const display = following.getCachedCards(OWNER_A, [WORD_A])
  await read.promise
  try {
    await following.commitHydration(
      request,
      [followingBatch('10', REVISION_2)],
      noop,
      followingPage('0', '10', REVISION_2)
    )
  } finally {
    resume.resolve()
  }
  const old = (await display).get(WORD_A)
  expect(old?.card.reference?.revision_id).toBe(REVISION_1)
  expect(old?.revision?.revision_id).toBe(REVISION_1)
  reopen()
  expect(learning()).toEqual(before)
  expect(before.uploads).toHaveLength(1)
  expect(before.history).toHaveLength(1)
  expect(await following.getPendingRefreshWordIds(OWNER_A)).toEqual([])
  expect(await following.getChangeCursor(OWNER_A)).toBe('10')
  const current = (await following.getCachedCards(OWNER_A, [WORD_A])).get(
    WORD_A
  )
  expect(current?.card.reference?.revision_id).toBe(REVISION_2)
  expect(current?.revision?.revision_id).toBe(REVISION_2)
})

it('keeps learning, download debt, cursor and the old cache after a rejected concurrent hydration and restart', async () => {
  const request = await following.prepareHydration(OWNER_A, [WORD_A])
  const before = { learning: learning(), downloads: downloads() }
  const read = deferred()
  const resume = deferred()
  installConnections(async () => {
    read.resolve()
    await resume.promise
  })
  const display = following.getCachedCards(OWNER_A, [WORD_A])
  await read.promise
  let calls = 0
  try {
    await expect(
      following.commitHydration(
        request,
        [followingBatch('10', REVISION_2)],
        () => {
          if (++calls >= 3) throw new Error('Owner changed before commit')
        },
        followingPage('0', '10', REVISION_2)
      )
    ).rejects.toThrow('Owner changed before commit')
  } finally {
    resume.resolve()
  }
  await display
  reopen()
  expect({ learning: learning(), downloads: downloads() }).toEqual(before)
})

it('reads 500 cards across a concurrent publication without mixing a card with the wrong revision', async () => {
  const ids = Array.from(
    { length: 500 },
    (_, n) => `dddddddd-dddd-4ddd-8ddd-${n.toString(16).padStart(12, '0')}`
  )
  const insert =
    db.prepare(`INSERT INTO words(word_id,user_id,dutch_lemma,translations,
    next_review_date,created_at,updated_at,sync_status) VALUES (?, ?, ?, '{}', ?, ?, ?, 'synced')`)
  for (const id of ids) insert.run(id, OWNER_A, id, AT, AT, AT)
  let request = await following.prepareHydration(OWNER_A, ids)
  await following.commitHydration(
    request,
    [followingBatch('9', REVISION_1, ids)],
    noop
  )
  // The seeded learning card shares this entry and must also receive the page.
  const affected = [...ids, WORD_A]
  request = await following.prepareHydration(OWNER_A, affected)
  const before = learning()
  let reads = 0
  const first = deferred()
  const resume = deferred()
  installConnections(async () => {
    if (++reads === 1) {
      first.resolve()
      await resume.promise
    }
  })
  const display = following.getCachedCards(OWNER_A, ids)
  await first.promise
  try {
    await following.commitHydration(
      request,
      [followingBatch('10', REVISION_2, affected)],
      noop,
      followingPage('0', '10', REVISION_2)
    )
  } finally {
    resume.resolve()
  }
  const cards = await display
  expect(cards.size).toBe(500)
  expect(reads).toBeGreaterThan(1)
  const revisions = new Set<string>()
  for (const item of cards.values()) {
    expect(item.card.reference?.revision_id).toBe(item.revision?.revision_id)
    revisions.add(item.revision!.revision_id)
  }
  expect(revisions).toEqual(new Set([REVISION_1, REVISION_2]))
  // A mixed-time display snapshot must not be reused to acknowledge a page.
  expect(
    await following.reuseHydratedPage(
      request,
      cards,
      requireFollowingValue(
        parseDictionaryChangePageV2(followingPage('10', '11', REVISION_2))
      ),
      noop
    )
  ).toBe(false)
  expect(await following.getChangeCursor(OWNER_A)).toBe('10')
  reopen()
  expect(learning()).toEqual(before)
  expect(await following.getPendingRefreshWordIds(OWNER_A)).toEqual([])
  const timing: Record<string, number[]> = {
    retainedReadTransaction: [],
    statementSnapshot: [],
  }
  for (let round = 0; round < 12; round++) {
    for (const variant of Object.keys(timing)) {
      const start = performance.now()
      if (variant === 'retainedReadTransaction') db.exec('BEGIN')
      try {
        expect((await following.getCachedCards(OWNER_A, ids)).size).toBe(500)
      } finally {
        if (variant === 'retainedReadTransaction') db.exec('COMMIT')
      }
      if (round >= 2) timing[variant].push(performance.now() - start)
    }
  }
  if (process.env.D144_READ_TIMING_OUTPUT)
    writeFileSync(
      process.env.D144_READ_TIMING_OUTPUT,
      JSON.stringify(
        {
          scope: 'Host SQLite display read only, not native/full sync',
          cards: 500,
          timing,
        },
        null,
        2
      )
    )
})

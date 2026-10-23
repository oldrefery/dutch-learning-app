import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { dictionaryFollowingRepository as repository } from '../dictionaryFollowingRepository'
import { dictionaryContentRepository as legacy } from '../dictionaryContentRepository'
import { createTestDatabase } from './sqlite.fixture'
import { getDatabase } from '../initDB'
import {
  AT,
  ENTRY,
  OWNER_A,
  OWNER_B,
  WORD_A,
  WORD_A2,
  WORD_B,
  REVISION_1,
  REVISION_2,
  followingBatch,
  followingContent,
  followingPage,
} from './dictionaryFollowing.fixture'

jest.mock('../initDB')

const LEGACY_CARDS_QUERY = 'SELECT * FROM dictionary_card_content'
const AUTH_CHANGED = 'Authentication changed'
const WORDS_QUERY = 'SELECT * FROM words ORDER BY word_id'
const REVISIONS_QUERY =
  'SELECT * FROM dictionary_revision_cache ORDER BY revision_id'
const CARDS_QUERY =
  'SELECT * FROM dictionary_effective_card_cache ORDER BY word_id'
const assertOwner = () => {}

describe('protocol2 atomic hydration on file-backed SQLite', () => {
  let db: DatabaseSync
  let directory: string
  let path: string

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'dictionary-following-storage-'))
    path = join(directory, 'fixture.sqlite')
    db = createTestDatabase(path)
    for (const [id, owner] of [
      [WORD_A, OWNER_A],
      [WORD_A2, OWNER_A],
      [WORD_B, OWNER_B],
    ]) {
      db.prepare(
        `INSERT INTO words(word_id, user_id, dutch_lemma, translations,
        next_review_date, created_at, updated_at, interval_days, repetition_count,
        easiness_factor, sync_status) VALUES (?, ?, ?, '{}', '2026-10-11',
        ?, ?, 7, 8, 2.35, 'synced')`
      ).run(id, owner, id === WORD_A2 ? 'woning' : 'huis', AT, AT)
    }
  })

  afterEach(() => {
    db.close()
    rmSync(directory, { recursive: true, force: true })
  })

  const reopen = () => {
    db.close()
    db = createTestDatabase(path, false)
  }
  const hydrate = async (
    sequence = '9007199254740993',
    revisionId = REVISION_1,
    ids = [WORD_A]
  ) => {
    const request = await repository.prepareHydration(OWNER_A, ids)
    await repository.commitHydration(
      request,
      [followingBatch(sequence, revisionId, ids)],
      assertOwner,
      followingPage(
        await repository.getChangeCursor(OWNER_A),
        sequence,
        revisionId
      )
    )
    return request
  }

  it('commits references, deduplicated revisions and exact cursors together; no learning or v1 migration', async () => {
    const before = db.prepare(WORDS_QUERY).all()
    await legacy.advanceChangeCursor(OWNER_A, 9, AT)
    const request = await hydrate('9007199254740993', REVISION_1, [
      WORD_A,
      WORD_A2,
    ])
    expect(db.prepare(REVISIONS_QUERY).all()).toHaveLength(1)
    expect(db.prepare(CARDS_QUERY).all()).toHaveLength(2)
    expect(
      db
        .prepare(
          'SELECT typeof(committed_cursor) AS kind FROM dictionary_following_cursors'
        )
        .get()
    ).toEqual({ kind: 'text' })
    expect(await repository.getChangeCursor(OWNER_A)).toBe('9007199254740993')
    expect(await repository.getChangeCursor(OWNER_B)).toBe('0')
    expect(await legacy.getChangeCursor(OWNER_A)).toBe(9)
    expect(db.prepare(LEGACY_CARDS_QUERY).all()).toEqual([])
    expect(db.prepare(WORDS_QUERY).all()).toEqual(before)
    const batch = followingBatch('9007199254740993', REVISION_1, [
      WORD_A,
      WORD_A2,
    ])
    await repository.commitHydration(
      request,
      [batch],
      assertOwner,
      followingPage('0', batch.watermark)
    )
    reopen()
    expect(
      (await repository.getCachedCards(OWNER_A, [WORD_A, WORD_A2])).size
    ).toBe(2)
    expect(await repository.getMissingCardWordIds(OWNER_A)).toEqual([])
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
  })

  it('orders by the new sequence when rollback selects an older immutable revision', async () => {
    await hydrate('9')
    await hydrate('10', REVISION_2)
    const captured = (await repository.getCachedCards(OWNER_A, [WORD_A])).get(
      WORD_A
    )
    await hydrate('11', REVISION_1)
    reopen()
    const current = (await repository.getCachedCards(OWNER_A, [WORD_A])).get(
      WORD_A
    )
    expect(current?.card.reference?.revision_id).toBe(REVISION_1)
    expect(current?.revision?.content.translations?.en).toEqual(['house'])
    expect(current?.card.head_sequence).toBe('11')
    expect(captured?.revision?.content.translations?.en).toEqual(['home'])
    expect(db.prepare(REVISIONS_QUERY).all()).toHaveLength(2)
    expect(await repository.getChangeCursor(OWNER_A)).toBe('11')
  })

  it.each([
    'missing-revision',
    'corrupt-content',
    'unrequested-card',
    'duplicate-card',
    'missing-card',
    'older-snapshot',
  ])('%s keeps old state, cursor and durable refresh debt', async kind => {
    await hydrate('9')
    const before = db.prepare(CARDS_QUERY).all()
    const request = await repository.prepareHydration(OWNER_A, [WORD_A])
    const batch = followingBatch('10', REVISION_2)
    if (kind === 'missing-revision') batch.revisions = []
    if (kind === 'corrupt-content') batch.revisions[0].content.dutch_lemma = ''
    if (kind === 'unrequested-card') batch.cards[0].word_id = WORD_B
    if (kind === 'duplicate-card') batch.cards.push(batch.cards[0])
    if (kind === 'missing-card') {
      batch.cards = []
      batch.revisions = []
    }
    if (kind === 'older-snapshot') batch.watermark = '9'
    await expect(
      repository.commitHydration(
        request,
        [batch],
        assertOwner,
        followingPage('9', '10', REVISION_2)
      )
    ).rejects.toThrow()
    reopen()
    expect(db.prepare(CARDS_QUERY).all()).toEqual(before)
    expect(await repository.getChangeCursor(OWNER_A)).toBe('9')
    expect(await repository.getMissingCardWordIds(OWNER_A)).toEqual([
      WORD_A,
      WORD_A2,
    ])
    expect(
      (await repository.getCachedCards(OWNER_A, [WORD_A])).get(WORD_A)?.revision
        ?.revision_id
    ).toBe(REVISION_1)
  })

  it('rolls back references and new dependencies when the final cursor write fails', async () => {
    await hydrate('9')
    const before = db.prepare(CARDS_QUERY).all()
    db.exec(`CREATE TRIGGER reject_cursor BEFORE UPDATE ON dictionary_following_cursors
      BEGIN SELECT RAISE(ABORT, 'injected cursor failure'); END`)
    const request = await repository.prepareHydration(OWNER_A, [WORD_A])
    await expect(
      repository.commitHydration(
        request,
        [followingBatch('10', REVISION_2)],
        assertOwner,
        followingPage('9', '10', REVISION_2)
      )
    ).rejects.toThrow('injected cursor failure')
    reopen()
    expect(db.prepare(CARDS_QUERY).all()).toEqual(before)
    expect(db.prepare(REVISIONS_QUERY).all()).toHaveLength(1)
    expect(await repository.getChangeCursor(OWNER_A)).toBe('9')
    expect(await repository.getMissingCardWordIds(OWNER_A)).toContain(WORD_A)
    db.exec('DROP TRIGGER reject_cursor')
    await repository.commitHydration(
      request,
      [followingBatch('10', REVISION_2)],
      assertOwner,
      followingPage('9', '10', REVISION_2)
    )
    expect(await repository.getChangeCursor(OWNER_A)).toBe('10')
  })

  it('rejects altered content with an already cached revision ID, even with an unchanged digest', async () => {
    await hydrate('9')
    const before = db.prepare(REVISIONS_QUERY).all()
    const request = await repository.prepareHydration(OWNER_A, [WORD_A])
    const batch = followingBatch('10')
    batch.revisions[0].content.translations = { en: ['altered'], ru: [] }
    await expect(
      repository.commitHydration(
        request,
        [batch],
        assertOwner,
        followingPage('9', '10')
      )
    ).rejects.toThrow('identity conflict')
    expect(db.prepare(REVISIONS_QUERY).all()).toEqual(before)
    expect(await repository.getChangeCursor(OWNER_A)).toBe('9')
  })

  it('fences late refreshes without consuming the newer request', async () => {
    await hydrate('9')
    const stale = await repository.prepareHydration(OWNER_A, [WORD_A])
    const current = await repository.prepareHydration(OWNER_A, [WORD_A])
    await expect(
      repository.commitHydration(
        stale,
        [followingBatch('10', REVISION_2)],
        assertOwner,
        followingPage('9', '10', REVISION_2)
      )
    ).rejects.toThrow('refresh changed')
    expect(await repository.getChangeCursor(OWNER_A)).toBe('9')
    await repository.commitHydration(
      current,
      [followingBatch('10', REVISION_2)],
      assertOwner,
      followingPage('9', '10', REVISION_2)
    )
    expect(await repository.getMissingCardWordIds(OWNER_A)).toEqual([WORD_A2])
  })

  it('does not reuse refresh versions after successful hydration or restart', async () => {
    const completed = await hydrate('9')
    reopen()
    const current = await repository.prepareHydration(OWNER_A, [WORD_A])
    expect(current.refreshVersions.get(WORD_A)).toBeGreaterThan(
      completed.refreshVersions.get(WORD_A) ?? 0
    )
    await expect(
      repository.commitHydration(
        completed,
        [followingBatch('10', REVISION_2)],
        assertOwner,
        followingPage('9', '10', REVISION_2)
      )
    ).rejects.toThrow('refresh changed')
    expect(await repository.getMissingCardWordIds(OWNER_A)).toContain(WORD_A)
    expect(await repository.getChangeCursor(OWNER_A)).toBe('9')
  })

  it('requires matching CEFR across batches and all references when the CEFR changes without a new revision', async () => {
    await hydrate('9', REVISION_1, [WORD_A, WORD_A2])
    const request = await repository.prepareHydration(OWNER_A, [WORD_A])
    const updated = followingBatch('10')
    updated.cards[0].head_sequence = '9'
    updated.cards[0].cefr = {
      level: 'B1',
      status: 'estimated',
      confidence: 0.9,
    }
    const page = {
      ...followingPage('9', '10'),
      changes: [
        {
          cursor: '10',
          kind: 'cefr-head',
          entry_id: ENTRY,
          revision_id: null,
          assessment_id: REVISION_2,
        },
      ],
    }
    await expect(
      repository.commitHydration(request, [updated], assertOwner)
    ).rejects.toThrow('Incomplete dictionary entry')
    const complete = await repository.prepareHydration(OWNER_A, [
      WORD_A,
      WORD_A2,
    ])
    const unchanged = followingBatch('10', REVISION_1, [WORD_A2])
    unchanged.cards[0].head_sequence = '9'
    await expect(
      repository.commitHydration(
        complete,
        [updated, unchanged],
        assertOwner,
        page
      )
    ).rejects.toThrow('head changed')
    unchanged.cards[0].cefr = updated.cards[0].cefr
    await repository.commitHydration(
      complete,
      [updated, unchanged],
      assertOwner,
      page
    )
    const cached = await repository.getCachedCards(OWNER_A, [WORD_A, WORD_A2])
    expect([...cached.values()].map(row => row.card.cefr.level)).toEqual([
      'B1',
      'B1',
    ])
    expect(await repository.getChangeCursor(OWNER_A)).toBe('10')
  })

  it('rejects a shape-valid response whose head has not applied the page event', async () => {
    await hydrate('9')
    const request = await repository.prepareHydration(OWNER_A, [WORD_A])
    const batch = followingBatch('10')
    batch.cards[0].head_sequence = '9'
    await expect(
      repository.commitHydration(
        request,
        [batch],
        assertOwner,
        followingPage('9', '10', REVISION_2)
      )
    ).rejects.toThrow('head predates')
    expect(await repository.getChangeCursor(OWNER_A)).toBe('9')
  })

  it('isolates A → B → A cache/debt/cursors and rejects a switched account at the end of a transaction', async () => {
    await hydrate('9')
    const request = await repository.prepareHydration(OWNER_A, [WORD_A])
    let account = OWNER_A
    let calls = 0
    const guard = () => {
      if (++calls === 3) account = OWNER_B
      if (account !== request.userId) throw new Error(AUTH_CHANGED)
    }
    await expect(
      repository.commitHydration(
        request,
        [followingBatch('10', REVISION_2)],
        guard,
        followingPage('9', '10', REVISION_2)
      )
    ).rejects.toThrow(AUTH_CHANGED)
    const requestB = await repository.prepareHydration(OWNER_B, [WORD_B])
    await repository.commitHydration(
      requestB,
      [followingBatch('12', REVISION_2, [WORD_B])],
      assertOwner,
      followingPage('0', '12', REVISION_2)
    )
    expect(await repository.getCachedCards(OWNER_B, [WORD_A])).toEqual(
      new Map()
    )
    expect(await repository.getCachedCards(OWNER_A, [WORD_B])).toEqual(
      new Map()
    )
    expect(await repository.getChangeCursor(OWNER_A)).toBe('9')
    expect(await repository.getChangeCursor(OWNER_B)).toBe('12')
    reopen()
    expect(await repository.getMissingCardWordIds(OWNER_A)).toContain(WORD_A)
    account = OWNER_A
    await repository.commitHydration(
      request,
      [followingBatch('10', REVISION_2)],
      () => {
        if (account !== OWNER_A) throw new Error(AUTH_CHANGED)
      },
      followingPage('9', '10', REVISION_2)
    )
    expect(await repository.getChangeCursor(OWNER_A)).toBe('10')
    expect(await repository.getChangeCursor(OWNER_B)).toBe('12')
  })

  it('preserves pending v1 payloads and private originals instead of adopting their following response', async () => {
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
    await legacy.queueCommand(OWNER_A, {
      protocol_version: 1,
      operation_id: REVISION_1,
      word_id: WORD_A,
      expected_content_version: 1,
      kind: 'edit-private',
      overrides: {
        analysis_notes: { op: 'set', value: 'private saved edit' },
      },
    })
    const oldCards = db.prepare(LEGACY_CARDS_QUERY).all()
    const commands = db
      .prepare('SELECT * FROM dictionary_content_commands')
      .all()
    const words = db.prepare(WORDS_QUERY).all()
    const request = await repository.prepareHydration(OWNER_A, [WORD_A])
    await expect(
      repository.commitHydration(
        request,
        [followingBatch('9')],
        assertOwner,
        followingPage('0', '9')
      )
    ).rejects.toThrow('require reconciliation')
    reopen()
    expect(db.prepare(LEGACY_CARDS_QUERY).all()).toEqual(oldCards)
    expect(
      db.prepare('SELECT * FROM dictionary_content_commands').all()
    ).toEqual(commands)
    expect(db.prepare(WORDS_QUERY).all()).toEqual(words)
    expect(await repository.getChangeCursor(OWNER_A)).toBe('0')
    expect(db.prepare(CARDS_QUERY).all()).toEqual([])
    expect(db.prepare(REVISIONS_QUERY).all()).toEqual([])
  })

  it('rejects foreign owners and excludes tombstoned cache/debt without recreating a card', async () => {
    await expect(
      repository.prepareHydration(OWNER_B, [WORD_A])
    ).rejects.toThrow('owner mismatch')
    const request = await repository.prepareHydration(OWNER_A, [WORD_A])
    db.prepare('UPDATE words SET deleted_at = ? WHERE word_id = ?').run(
      AT,
      WORD_A
    )
    await expect(
      repository.commitHydration(
        request,
        [followingBatch('9')],
        assertOwner,
        followingPage('0', '9')
      )
    ).rejects.toThrow('owner mismatch')
    expect(await repository.getMissingCardWordIds(OWNER_A)).toEqual([WORD_A2])
    expect(await repository.getCachedCards(OWNER_A, [WORD_A])).toEqual(
      new Map()
    )
    expect(await repository.getChangeCursor(OWNER_A)).toBe('0')
  })

  it('requires every affected reference before acknowledging a page or changing a cached entry head', async () => {
    await hydrate('9', REVISION_1, [WORD_A, WORD_A2])
    const request = await repository.prepareHydration(OWNER_A, [WORD_A])
    const batch = followingBatch('10', REVISION_2)
    await expect(
      repository.commitHydration(
        request,
        [batch],
        assertOwner,
        followingPage('9', '10', REVISION_2)
      )
    ).rejects.toThrow('Incomplete dictionary change page')
    await expect(
      repository.commitHydration(request, [batch], assertOwner)
    ).rejects.toThrow('Incomplete dictionary entry')
    expect(await repository.getChangeCursor(OWNER_A)).toBe('9')
    expect(db.prepare(REVISIONS_QUERY).all()).toHaveLength(1)
  })

  it('rejects mixed entry heads across batches and old cursor replays after a newer page', async () => {
    const request = await repository.prepareHydration(OWNER_A, [
      WORD_A,
      WORD_A2,
    ])
    await expect(
      repository.commitHydration(
        request,
        [followingBatch('9'), followingBatch('10', REVISION_2, [WORD_A2])],
        assertOwner
      )
    ).rejects.toThrow('head changed')
    await hydrate('10')
    const next = await repository.prepareHydration(OWNER_A, [WORD_A])
    await expect(
      repository.commitHydration(
        next,
        [followingBatch('11')],
        assertOwner,
        followingPage('0', '9')
      )
    ).rejects.toThrow('cursor changed')
    expect(await repository.getChangeCursor(OWNER_A)).toBe('10')
  })

  it('reads legacy raw removals/private JSON without weakening revision validation or v1 state', async () => {
    const batch = followingBatch('9')
    batch.cards = [
      {
        word_id: WORD_A,
        mode: 'legacy',
        content_version: '1',
        reference: null,
        adopted_revision_id: null,
        head_sequence: null,
        legacy_content: {
          ...followingContent,
          dutch_original: '',
          translations: null,
          examples: [],
          usage_notes: null,
          conjugation: { custom: 'legacy structure' },
        },
        removed_fields: ['translations'],
        cefr: { level: null, status: 'unknown', confidence: null },
      },
    ]
    batch.revisions = []
    const request = await repository.prepareHydration(OWNER_A, [WORD_A])
    await repository.commitHydration(request, [batch], assertOwner)
    reopen()
    expect(
      (await repository.getCachedCards(OWNER_A, [WORD_A])).get(WORD_A)?.card
    ).toEqual(batch.cards[0])
    expect(await repository.getChangeCursor(OWNER_A)).toBe('0')
    expect(db.prepare(LEGACY_CARDS_QUERY).all()).toEqual([])
  })

  it('can acknowledge unrelated entries with no card hydration and rejects corrupt persisted cursors', async () => {
    const request = await repository.prepareHydration(OWNER_A, [])
    await repository.commitHydration(
      request,
      [],
      assertOwner,
      followingPage('0', '9223372036854775807')
    )
    expect(await repository.getChangeCursor(OWNER_A)).toBe(
      '9223372036854775807'
    )
    expect(db.prepare(REVISIONS_QUERY).all()).toEqual([])
    expect(() =>
      db
        .prepare('UPDATE dictionary_following_cursors SET committed_cursor = ?')
        .run('01')
    ).toThrow('CHECK constraint')
    await expect(
      repository.prepareHydration(OWNER_A, [WORD_A, WORD_A])
    ).rejects.toThrow('request size')
    await expect(
      repository.commitHydration(
        request,
        [
          followingBatch('9', REVISION_1, []),
          followingBatch('9', REVISION_1, []),
        ],
        assertOwner
      )
    ).rejects.toThrow('batch count')
  })

  it('hydrates and reads more than one SQL chunk in a single snapshot with bounded queries', async () => {
    const ids = Array.from(
      { length: 405 },
      (_, index) => `dddddddd-dddd-4ddd-8ddd-${String(index).padStart(12, '0')}`
    )
    const insert =
      db.prepare(`INSERT INTO words(word_id,user_id,dutch_lemma,translations,
      next_review_date,created_at,updated_at) VALUES (?,? ,?,'{}','2026-10-11',?,?)`)
    ids.forEach((id, index) =>
      insert.run(id, OWNER_A, `fixture-${index}`, AT, AT)
    )
    await hydrate('9', REVISION_1, ids)
    const adapter = await getDatabase()
    const transaction = jest.spyOn(adapter, 'withExclusiveTransactionAsync')
    const query = jest.spyOn(adapter, 'getAllAsync')
    const result = await repository.getCachedCards(OWNER_A, ids)
    expect(result.size).toBe(405)
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(query).toHaveBeenCalledTimes(2)
    expect(db.prepare(REVISIONS_QUERY).all()).toHaveLength(1)
    const first = result.get(ids[0])
    if (first?.revision)
      first.revision.content.translations = {
        en: ['mutated caller copy'],
        ru: [],
      }
    expect(result.get(ids[1])?.revision?.content.translations?.en).toEqual([
      'house',
    ])
    expect(
      (await repository.getCachedCards(OWNER_A, [ids[0]])).get(ids[0])?.revision
        ?.content.translations?.en
    ).toEqual(['house'])
  })

  it('round-trips escaped multilingual cached content through native row transport', async () => {
    const request = await repository.prepareHydration(OWNER_A, [WORD_A])
    const batch = followingBatch('9')
    const content = batch.revisions[0].content
    content.translations.en = ['a "quoted" phrase', 'line one\nline two']
    content.translations.ru = ['слово \"в кавычках\"', '😀']
    content.examples = [{ nl: 'één\nregel', en: 'one\nline', ru: null }]
    await repository.commitHydration(
      request,
      [batch],
      assertOwner,
      followingPage('0', '9')
    )
    const cached = (await repository.getCachedCards(OWNER_A, [WORD_A])).get(
      WORD_A
    )
    expect(cached?.revision?.content).toEqual(content)
    expect(cached?.watermark).toBe('9')
    expect(await repository.getCachedCards(OWNER_B, [WORD_A])).toEqual(
      new Map()
    )
  })

  it('preserves each cached card watermark when reading mixed acknowledgement boundaries', async () => {
    await hydrate('9', REVISION_1, [WORD_A, WORD_A2])
    db.prepare(
      'UPDATE dictionary_effective_card_cache SET watermark = ? WHERE word_id = ?'
    ).run('10', WORD_A2)
    const result = await repository.getCachedCards(OWNER_A, [WORD_A, WORD_A2])
    expect(result.get(WORD_A)?.watermark).toBe('9')
    expect(result.get(WORD_A2)?.watermark).toBe('10')
    const invalidCard = { ...followingBatch('9').cards[0], head_sequence: '10' }
    db.prepare(
      'UPDATE dictionary_effective_card_cache SET card_json = ?, head_sequence = ? WHERE word_id = ?'
    ).run(JSON.stringify(invalidCard), '10', WORD_A)
    await expect(
      repository.getCachedCards(OWNER_A, [WORD_A, WORD_A2])
    ).rejects.toThrow('Invalid dictionary following response')
  })

  it('includes v1 references in change-page coverage and rejects structurally corrupt cached metadata', async () => {
    const batch = followingBatch('9')
    await legacy.cacheDependencies([{ revision: batch.revisions[0] }])
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
    expect(await repository.getWordIdsByEntryIds(OWNER_A, [ENTRY])).toEqual([
      WORD_A2,
    ])
    const request = await repository.prepareHydration(OWNER_A, [WORD_A])
    await expect(
      repository.commitHydration(
        request,
        [batch],
        assertOwner,
        followingPage('0', '9')
      )
    ).rejects.toThrow('Incomplete dictionary change page')
    await repository.commitHydration(request, [batch], assertOwner)
    db.prepare(
      'UPDATE dictionary_effective_card_cache SET content_version = ? WHERE word_id = ?'
    ).run('10', WORD_A)
    await expect(repository.getCachedCards(OWNER_A, [WORD_A])).rejects.toThrow(
      'cached card identity'
    )
    expect(await repository.getChangeCursor(OWNER_A)).toBe('0')
  })

  it('rejects an initial account mismatch before any dependency or card writes', async () => {
    const request = await repository.prepareHydration(OWNER_A, [WORD_A])
    await expect(
      repository.commitHydration(
        request,
        [followingBatch('9')],
        () => {
          throw new Error(AUTH_CHANGED)
        },
        followingPage('0', '9')
      )
    ).rejects.toThrow(AUTH_CHANGED)
    expect(db.prepare(REVISIONS_QUERY).all()).toEqual([])
    expect(db.prepare(CARDS_QUERY).all()).toEqual([])
    expect(await repository.getMissingCardWordIds(OWNER_A)).toContain(WORD_A)
  })
})

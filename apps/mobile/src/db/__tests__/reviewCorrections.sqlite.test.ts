import type { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTestDatabase } from './sqlite.fixture'
import { reviewCorrectionRepository as corrections } from '../reviewCorrectionRepository'
import { reviewEventRepository } from '../reviewEventRepository'
import { reviewCorrectionRecoveryRepository as recovery } from '../reviewCorrectionRecoveryRepository'
import { getLearningQueueHealth } from '../learningQueueHealth'
import { MIGRATION_V10_REVIEW_CORRECTIONS } from '../reviewCorrectionSchema'
import type {
  ReviewCorrectionCommand,
  ReviewCorrectionReceipt,
} from '@/types/ReviewCorrection'

jest.mock('../initDB')
jest.mock('@/lib/sentry')

const at = '2026-09-06T12:00:00.000Z'
const selectCorrections = 'SELECT * FROM review_corrections'
const command: ReviewCorrectionCommand = {
  correction_id: 'correction-a',
  event_id: 'event',
  word_id: 'word',
  user_id: 'qa',
  expected_revision: 0,
  assessment: 'again',
}
const receipt: ReviewCorrectionReceipt = {
  ...command,
  revision: 1,
  next_interval_days: 0,
  next_repetition_count: 0,
  next_easiness_factor: 2.3,
  created_at: at,
}

describe('durable review corrections on SQLite', () => {
  let db: DatabaseSync
  let directory: string
  let databasePath: string
  const commands = () =>
    db.prepare('SELECT * FROM learning_commands ORDER BY sequence').all()
  const word = () => db.prepare('SELECT * FROM words').get()
  const events = () => db.prepare('SELECT * FROM review_events').all()
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(at))
    directory = mkdtempSync(join(tmpdir(), 'review-corrections-'))
    databasePath = join(directory, 'fixture.sqlite')
    db = createTestDatabase(databasePath)
    db.exec(`INSERT INTO words(word_id, user_id, dutch_lemma, translations,
      next_review_date, created_at, updated_at, repetition_count)
      VALUES ('word', 'qa', 'huis', '{}', '2026-09-07', '${at}', '${at}', 1);
      INSERT INTO review_events(event_id, word_id, user_id, assessment, review_mode,
      previous_interval_days, next_interval_days, previous_easiness_factor, next_easiness_factor, reviewed_at)
      VALUES ('event', 'word', 'qa', 'good', 'recognition', 0, 1, 2.5, 2.5, '${at}');`)
  })
  afterEach(() => {
    db.close()
    rmSync(directory, { recursive: true, force: true })
    jest.useRealTimers()
  })

  it('survives closing and reopening SQLite before and after the server acknowledgement', async () => {
    await corrections.enqueue(command)
    const queued = commands()
    db.close()
    db = createTestDatabase(databasePath, false)
    expect(commands()).toEqual(queued)
    expect(await corrections.getNext('qa')).toMatchObject(command)
    await corrections.saveRemote('qa', [receipt])
    db.close()
    db = createTestDatabase(databasePath, false)
    expect(await corrections.getNext('qa')).toBeNull()
    expect(
      (await reviewEventRepository.getRecentByWord('qa', 'word'))[0].assessment
    ).toBe('again')
    expect(events()[0].assessment).toBe('good')
  })

  it('queues once after review and blocks reset, preserving original events and SRS', async () => {
    const before = word()
    const original = events()
    await corrections.enqueue(command)
    await corrections.enqueue(command)
    expect(() =>
      db.exec(
        `INSERT INTO learning_commands(operation_id, kind, user_id, word_id) VALUES ('reset', 'reset', 'qa', 'word')`
      )
    ).toThrow('Finish synchronizing')
    expect(commands().map(row => row.kind)).toEqual(['review', 'correction'])
    expect(word()).toEqual(before)
    expect(events()).toEqual(original)
    expect(await corrections.getNext('qa')).toMatchObject({
      ...command,
      sequence: 2,
      status: 'pending',
    })
    expect(await corrections.getNext('other')).toBeNull()
    expect(
      await getLearningQueueHealth('qa', Date.parse(at) + 10000)
    ).toMatchObject({ count: 2, oldestAgeSeconds: 10 })
  })

  it('rolls back the edit when its queue insert fails', async () => {
    db.exec(`CREATE TRIGGER fail_correction BEFORE INSERT ON learning_commands
      WHEN NEW.kind = 'correction' BEGIN SELECT RAISE(ABORT, 'disk failure'); END;`)
    await expect(corrections.enqueue(command)).rejects.toThrow('disk failure')
    expect(db.prepare(selectCorrections).all()).toEqual([])
    expect(commands()).toHaveLength(1)
  })

  it('requires an owned event and refuses changed IDs, stale revisions and another unresolved edit', async () => {
    await expect(
      corrections.enqueue({ ...command, user_id: 'other' })
    ).rejects.toThrow('not found')
    await expect(
      corrections.enqueue({ ...command, event_id: 'missing' })
    ).rejects.toThrow('not found')
    await expect(
      corrections.enqueue({ ...command, expected_revision: 1 })
    ).rejects.toThrow('Stale')
    await corrections.enqueue(command)
    await expect(
      corrections.enqueue({ ...command, assessment: 'easy' })
    ).rejects.toThrow('different data')
    await expect(
      corrections.enqueue({ ...command, correction_id: 'second' })
    ).rejects.toThrow('pending correction')
    expect(commands()).toHaveLength(2)
  })

  it('acknowledges only matching intent and projects confirmed history without a second review', async () => {
    await corrections.enqueue(command)
    const original = events()
    await expect(
      corrections.saveRemote('qa', [{ ...receipt, assessment: 'hard' }])
    ).rejects.toThrow('conflicts')
    await expect(corrections.saveRemote('other', [receipt])).rejects.toThrow(
      'Foreign'
    )
    expect((await corrections.getNext('qa'))?.status).toBe('pending')
    await corrections.saveRemote('qa', [receipt])
    await corrections.saveRemote('qa', [receipt])
    expect(await corrections.getNext('qa')).toBeNull()
    expect(commands().map(row => row.operation_id)).toEqual(['event'])
    expect(events()).toEqual(original)
    expect(
      (await reviewEventRepository.getRecentByWord('qa', 'word'))[0]
    ).toMatchObject({
      assessment: 'again',
      next_interval_days: 0,
      next_easiness_factor: 2.3,
    })
    expect(
      (await reviewEventRepository.getPendingSyncEvents('qa'))[0].assessment
    ).toBe('good')
    db.exec(
      "UPDATE review_events SET sync_status = 'synced' WHERE event_id = 'event'"
    )
    await recovery.finish(command, {
      user_id: 'qa',
      word_id: 'word',
      interval_days: 0,
      repetition_count: 0,
      easiness_factor: 2.3,
      next_review_date: '2026-09-07',
      last_reviewed_at: at,
    })
    await corrections.enqueue({
      ...command,
      correction_id: 'second',
      expected_revision: 1,
      assessment: 'easy',
    })
    expect((await corrections.getNext('qa'))?.expected_revision).toBe(1)
  })

  it('keeps conflicts durable and never acknowledges them as successful', async () => {
    await corrections.enqueue(command)
    await corrections.markConflict(
      'other',
      command.correction_id,
      'wrong owner'
    )
    expect((await corrections.getNext('qa'))?.status).toBe('pending')
    await corrections.markConflict('qa', command.correction_id, 'Conflict')
    expect(await corrections.getNext('qa')).toMatchObject({
      status: 'conflict',
      error: 'Conflict',
    })
    db.exec(MIGRATION_V10_REVIEW_CORRECTIONS)
    expect(await corrections.getNext('qa')).toMatchObject({
      status: 'conflict',
      error: 'Conflict',
    })
    expect(
      (await reviewEventRepository.getRecentByUser('qa'))[0].assessment
    ).toBe('good')
  })

  it('retains newer effective revisions when an older transaction arrives late', async () => {
    await corrections.saveRemote('qa', [
      {
        ...receipt,
        correction_id: 'later',
        expected_revision: 1,
        revision: 2,
        assessment: 'easy',
        next_interval_days: 4,
      },
    ])
    await corrections.saveRemote('qa', [receipt])
    expect(
      (await reviewEventRepository.getRecentByWords('qa', ['word'])).word[0]
        .assessment
    ).toBe('easy')
    expect(
      await corrections.getMissingEventIds('qa', [
        'event',
        'missing',
        'missing',
      ])
    ).toEqual(['missing'])
  })

  it('rejects an altered immutable receipt and invalid confirmed SRS atomically', async () => {
    await corrections.saveRemote('qa', [receipt])
    await expect(
      corrections.saveRemote('qa', [{ ...receipt, next_interval_days: 9 }])
    ).rejects.toThrow('changed after acknowledgement')
    await expect(
      corrections.saveRemote('qa', [
        { ...receipt, correction_id: 'invalid', next_easiness_factor: 9 },
      ])
    ).rejects.toThrow('CHECK')
    expect(
      db.prepare('SELECT COUNT(*) AS count FROM review_corrections').get()
        ?.count
    ).toBe(1)
    expect(
      (await reviewEventRepository.getRecentByUser('qa'))[0].next_interval_days
    ).toBe(0)
  })

  it('removes corrections and queued edits when their word is tombstoned', async () => {
    await corrections.enqueue(command)
    db.exec(`UPDATE words SET deleted_at = '${at}' WHERE word_id = 'word'`)
    expect(await corrections.getNext('qa')).toBeNull()
    expect(db.prepare(selectCorrections).all()).toEqual([])
    expect(commands()).toEqual([])
    expect(
      await corrections.getTombstonedWordIds('qa', ['word', 'word'])
    ).toEqual(['word'])
    expect(await corrections.getTombstonedWordIds('other', ['word'])).toEqual(
      []
    )
    await corrections.saveRemote('qa', [receipt])
    expect(db.prepare(selectCorrections).all()).toEqual([])
    await expect(corrections.enqueue(command)).rejects.toThrow('not found')
  })

  it('preserves the sequence high-water mark when migrating an empty queue again', async () => {
    db.exec(`INSERT INTO learning_commands(sequence, operation_id, kind, user_id, word_id)
      VALUES (99, 'old-reset', 'reset', 'qa', 'word');
      UPDATE review_events SET sync_status = 'synced'; DELETE FROM learning_commands;`)
    db.exec(MIGRATION_V10_REVIEW_CORRECTIONS)
    await corrections.enqueue(command)
    expect(commands()[0].sequence).toBe(100)
  })
})

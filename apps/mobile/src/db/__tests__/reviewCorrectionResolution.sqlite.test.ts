import type { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTestDatabase } from './sqlite.fixture'
import { reviewCorrectionRepository as corrections } from '../reviewCorrectionRepository'
import { keepServerReviewCorrection } from '../reviewCorrectionResolutionRepository'
import { reviewEventRepository } from '../reviewEventRepository'
import type {
  ReviewCorrectionCommand,
  ReviewCorrectionProgress,
} from '@/types/ReviewCorrection'

jest.mock('../initDB')
jest.mock('@/lib/sentry')

const at = '2026-09-06T12:00:00.000Z'
const command: ReviewCorrectionCommand = {
  correction_id: 'correction',
  event_id: 'event',
  word_id: 'word',
  user_id: 'qa',
  expected_revision: 0,
  assessment: 'hard',
}
const progress: ReviewCorrectionProgress = {
  word_id: 'word',
  user_id: 'qa',
  interval_days: 8,
  repetition_count: 3,
  easiness_factor: 2.4,
  next_review_date: '2026-09-14',
  last_reviewed_at: at,
}

describe('explicit correction resolution on SQLite', () => {
  let db: DatabaseSync
  let directory: string
  let path: string
  const commands = () =>
    db.prepare('SELECT * FROM learning_commands ORDER BY sequence').all()
  const word = () =>
    db.prepare('SELECT * FROM words WHERE word_id = ?').get('word')
  const resolve = () => keepServerReviewCorrection(command, progress)
  const conflict = () =>
    corrections.markConflict('qa', 'correction', 'Conflict')

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date(at))
    directory = mkdtempSync(join(tmpdir(), 'correction-resolution-'))
    path = join(directory, 'fixture.sqlite')
    db = createTestDatabase(path)
    db.exec(`INSERT INTO words(word_id, user_id, dutch_lemma, translations,
      next_review_date, created_at, updated_at, repetition_count)
      VALUES ('word', 'qa', 'huis', '{}', '2026-09-07', '${at}', '${at}', 1);
      INSERT INTO review_events(event_id, word_id, user_id, assessment, review_mode,
      previous_interval_days, next_interval_days, previous_easiness_factor, next_easiness_factor, reviewed_at)
      VALUES ('event', 'word', 'qa', 'good', 'recognition', 0, 1, 2.5, 2.5, '${at}');
      UPDATE review_events SET sync_status = 'synced';`)
    await corrections.enqueue(command)
  })
  afterEach(() => {
    db.close()
    rmSync(directory, { recursive: true, force: true })
    jest.useRealTimers()
  })

  it('retains intent and original history while atomically applying canonical SRS and releasing the queue', async () => {
    await conflict()
    const before = word()
    await resolve()
    expect(await corrections.getById('qa', 'correction')).toMatchObject({
      ...command,
      status: 'conflict',
      error: 'Conflict',
      resolved_at: at,
    })
    expect(commands()).toEqual([])
    expect(word()).toEqual({ ...before, ...progress })
    expect(
      (await reviewEventRepository.getRecentByUser('qa'))[0].assessment
    ).toBe('good')
    db.close()
    db = createTestDatabase(path, false)
    expect(await corrections.getNext('qa')).toBeNull()
    expect((await corrections.getById('qa', 'correction'))?.resolved_at).toBe(
      at
    )
    await corrections.enqueue(command)
    expect(commands()).toEqual([])
  })

  it('never abandons an uncertain outcome or changes any local progress', async () => {
    const before = word()
    await expect(resolve()).rejects.toThrow('Retry the pending correction')
    expect(commands()).toHaveLength(1)
    expect(word()).toEqual(before)
    expect(
      (await corrections.getById('qa', 'correction'))?.resolved_at
    ).toBeNull()
  })

  it.each(['reset', 'review'])(
    'keeps subsequent %s commands and their provisional SRS untouched',
    async kind => {
      await conflict()
      db.prepare(
        'INSERT INTO learning_commands(operation_id, kind, user_id, word_id) VALUES (?, ?, ?, ?)'
      ).run('later', kind, 'qa', 'word')
      const later = commands()[1]
      const before = word()
      await resolve()
      expect(commands()).toEqual([later])
      expect(word()).toEqual(before)
    }
  )

  it('rolls back resolution and queue release when canonical SRS storage fails', async () => {
    await conflict()
    const before = word()
    const queue = commands()
    db.exec(`CREATE TRIGGER fail_resolution BEFORE UPDATE OF interval_days ON words
      BEGIN SELECT RAISE(ABORT, 'disk failure'); END;`)
    await expect(resolve()).rejects.toThrow('disk failure')
    expect(commands()).toEqual(queue)
    expect(word()).toEqual(before)
    expect(
      (await corrections.getById('qa', 'correction'))?.resolved_at
    ).toBeNull()
  })

  it('rolls back the resolution marker if releasing the queue fails', async () => {
    await conflict()
    db.exec(`CREATE TRIGGER fail_release BEFORE DELETE ON learning_commands
      BEGIN SELECT RAISE(ABORT, 'disk failure'); END;`)
    await expect(resolve()).rejects.toThrow('disk failure')
    expect(commands()).toHaveLength(1)
    expect(
      (await corrections.getById('qa', 'correction'))?.resolved_at
    ).toBeNull()
  })

  it('rejects changed intent and foreign account or word snapshots', async () => {
    await conflict()
    await expect(
      keepServerReviewCorrection({ ...command, assessment: 'easy' }, progress)
    ).rejects.toThrow('changed')
    await expect(
      keepServerReviewCorrection({ ...command, user_id: 'other' }, null)
    ).rejects.toThrow('changed')
    for (const fields of [{ user_id: 'other' }, { word_id: 'other' }]) {
      await expect(
        keepServerReviewCorrection(command, { ...progress, ...fields })
      ).rejects.toThrow('Foreign')
    }
    expect(await corrections.getById('other', 'correction')).toBeNull()
    expect(commands()).toHaveLength(1)
  })

  it('makes a duplicate resolution a no-op, even after a newer local review', async () => {
    await conflict()
    await resolve()
    db.exec('UPDATE words SET repetition_count = 99')
    const before = word()
    await resolve()
    expect(word()).toEqual(before)
    await corrections.enqueue({
      ...command,
      correction_id: 'next',
      assessment: 'easy',
    })
    expect((await corrections.getNext('qa'))?.correction_id).toBe('next')
  })

  it('preserves a receipt arriving during refresh and accepts a late receipt after resolution', async () => {
    await conflict()
    await resolve()
    await corrections.saveRemote('qa', [
      {
        ...command,
        revision: 1,
        next_interval_days: 1,
        next_repetition_count: 1,
        next_easiness_factor: 2.36,
        created_at: at,
      },
    ])
    expect(await corrections.getById('qa', 'correction')).toMatchObject({
      status: 'synced',
      resolved_at: at,
    })
    expect(
      (await reviewEventRepository.getRecentByUser('qa'))[0].assessment
    ).toBe('hard')
    expect(commands()).toEqual([])
  })

  it('does not invent progress for an inaccessible word or resurrect a local tombstone', async () => {
    await conflict()
    const before = word()
    await keepServerReviewCorrection(command, null)
    expect(word()).toEqual(before)
    expect(commands()).toEqual([])
    db.exec(`UPDATE words SET deleted_at = '${at}' WHERE word_id = 'word'`)
    await expect(resolve()).rejects.toThrow('changed')
    expect(word()?.deleted_at).toBe(at)
  })

  it('finishes resolution if refresh has already acknowledged the original command', async () => {
    await conflict()
    await corrections.saveRemote('qa', [
      {
        ...command,
        revision: 1,
        next_interval_days: 1,
        next_repetition_count: 1,
        next_easiness_factor: 2.36,
        created_at: at,
      },
    ])
    await resolve()
    expect(await corrections.getById('qa', 'correction')).toMatchObject({
      status: 'synced',
      resolved_at: at,
    })
    expect(word()).toMatchObject(progress)
  })
})

import type { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTestDatabase } from './sqlite.fixture'
import { reviewCorrectionRepository as corrections } from '../reviewCorrectionRepository'
import { reviewCorrectionRecoveryRepository as recovery } from '../reviewCorrectionRecoveryRepository'
import { keepServerReviewCorrection } from '../reviewCorrectionResolutionRepository'
import type { ReviewCorrectionCommand } from '@/types/ReviewCorrection'

jest.mock('../initDB')
const at = '2026-09-06T12:00:00Z'
const SELECT_WORDS = 'SELECT * FROM words'
const command: ReviewCorrectionCommand = {
  correction_id: 'edit',
  event_id: 'event',
  word_id: 'word',
  user_id: 'qa',
  expected_revision: 0,
  assessment: 'hard',
}
const receipt = {
  ...command,
  revision: 1,
  next_interval_days: 3,
  next_repetition_count: 1,
  next_easiness_factor: 2.3,
  created_at: at,
}
const progress = {
  word_id: 'word',
  user_id: 'qa',
  interval_days: 3,
  repetition_count: 1,
  easiness_factor: 2.3,
  next_review_date: '2026-09-09',
  last_reviewed_at: at,
}
let db: DatabaseSync
let directory: string
let path: string
const barrier = () =>
  db.prepare('SELECT * FROM review_correction_recovery').all()
const reset = () =>
  db.exec(
    "INSERT INTO learning_commands(operation_id, kind, user_id, word_id) VALUES ('reset', 'reset', 'qa', 'word')"
  )
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'correction-recovery-'))
  path = join(directory, 'fixture.sqlite')
  db = createTestDatabase(path)
  db.exec(`INSERT INTO words(word_id, user_id, dutch_lemma, translations, next_review_date, created_at, updated_at)
    VALUES ('word', 'qa', 'huis', '{}', '2026-09-07', '${at}', '${at}');
    INSERT INTO review_events(event_id, word_id, user_id, assessment, review_mode,
    previous_interval_days, next_interval_days, previous_easiness_factor, next_easiness_factor, reviewed_at, sync_status)
    VALUES ('event', 'word', 'qa', 'good', 'recognition', 0, 1, 2.5, 2.5, '${at}', 'synced');`)
})
afterEach(() => {
  db.close()
  rmSync(directory, { recursive: true, force: true })
})

it('retains its write barrier across receipt acknowledgement and restart, then applies SRS atomically', async () => {
  await corrections.enqueue(command)
  await corrections.saveRemote('qa', [receipt])
  expect(await corrections.getNext('qa')).toBeNull()
  db.close()
  db = createTestDatabase(path, false)
  expect(await recovery.pending('qa')).toEqual([
    expect.objectContaining({ ...command, status: 'synced' }),
  ])
  expect(reset).toThrow('Finish synchronizing')
  await expect(recovery.assertReady('qa')).rejects.toThrow(
    'Finish synchronizing'
  )
  await expect(recovery.assertReady('another-account')).resolves.toBeUndefined()
  await recovery.finish(command, progress)
  expect(barrier()).toEqual([])
  expect(db.prepare(SELECT_WORDS).get()).toMatchObject(progress)
  expect(await recovery.effective(command)).toEqual({
    eventId: 'event',
    wordId: 'word',
    assessment: 'hard',
    revision: 1,
  })
  expect(reset).not.toThrow()
})

it('rolls back canonical progress if releasing the barrier fails', async () => {
  await corrections.enqueue(command)
  await corrections.saveRemote('qa', [receipt])
  const before = db.prepare(SELECT_WORDS).get()
  db.exec(
    "CREATE TRIGGER fail_release BEFORE DELETE ON review_correction_recovery BEGIN SELECT RAISE(ABORT, 'disk failure'); END;"
  )
  await expect(recovery.finish(command, progress)).rejects.toThrow(
    'disk failure'
  )
  expect(db.prepare(SELECT_WORDS).get()).toEqual(before)
  expect(barrier()).toHaveLength(1)
})

it('keeps uncertain and conflicting commands blocked until explicit resolution', async () => {
  await corrections.enqueue(command)
  await expect(recovery.finish(command, progress)).rejects.toThrow(
    'not confirmed'
  )
  await corrections.markConflict('qa', 'edit', 'conflict')
  await expect(recovery.finish(command, progress)).rejects.toThrow(
    'not confirmed'
  )
  await keepServerReviewCorrection(command, progress)
  expect(barrier()).toHaveLength(1)
  await recovery.finish(command, progress)
  expect(barrier()).toEqual([])
})

it('does not overwrite older queued learning commands or accept foreign progress', async () => {
  reset()
  await corrections.enqueue(command)
  await corrections.saveRemote('qa', [receipt])
  await expect(recovery.finish(command, progress)).rejects.toThrow(
    'earlier learning commands'
  )
  await expect(
    recovery.finish(command, { ...progress, user_id: 'other' })
  ).rejects.toThrow('Foreign')
  expect(barrier()).toHaveLength(1)
})

it('retains a server-deleted word as a tombstone rather than permitting another review', async () => {
  await corrections.enqueue(command)
  await corrections.saveRemote('qa', [receipt])
  await recovery.finish(command, null)
  expect(barrier()).toEqual([])
  expect(db.prepare(SELECT_WORDS).get()?.deleted_at).toBeTruthy()
  expect(await recovery.effective(command)).toBeNull()
})

import type { DatabaseSync } from 'node:sqlite'
import { createTestDatabase } from './sqlite.fixture'
import { getLearningSyncStatusWordIds } from '../learningSyncStatus'

jest.mock('../initDB')

describe('read-only learning sync status', () => {
  let db: DatabaseSync
  const owner = 'owner'
  const otherOwner = 'other-owner'
  const word = (id: string, user = owner) =>
    db
      .prepare(
        `INSERT INTO words(word_id, user_id, dutch_lemma, translations,
      next_review_date, created_at, updated_at, sync_status)
      VALUES (?, ?, ?, '{}', '2026-10-25', '2026-10-25', '2026-10-25', 'synced')`
      )
      .run(id, user, id)
  const review = (id: string, wordId: string, user = owner) =>
    db
      .prepare(
        `INSERT INTO review_events(event_id, user_id, word_id, assessment,
      review_mode, previous_interval_days, next_interval_days,
      previous_easiness_factor, next_easiness_factor, reviewed_at)
      VALUES (?, ?, ?, 'good', 'recognition', 1, 6, 2.5, 2.5, '2026-10-25')`
      )
      .run(id, user, wordId)
  const correction = (status: 'pending' | 'conflict') => {
    word('corrected')
    review('original', 'corrected')
    db.exec("UPDATE review_events SET sync_status = 'synced'")
    db.prepare(
      `INSERT INTO review_corrections(correction_id, event_id, word_id,
      user_id, expected_revision, assessment, queued_at, status)
      VALUES ('correction', 'original', 'corrected', ?, 0, 'hard', '2026-10-25', ?)`
    ).run(owner, status)
  }

  beforeEach(() => {
    db = createTestDatabase()
  })
  afterEach(() => db.close())

  it('counts reviews and resets on synced words once, isolates owners and never changes queues', async () => {
    word('reviewed')
    word('reset')
    word('other', otherOwner)
    review('event-1', 'reviewed')
    review('event-2', 'reviewed')
    review('other-event', 'other', otherOwner)
    db.exec(`INSERT INTO learning_commands(operation_id, kind, user_id, word_id, reset_at)
      VALUES ('reset', 'reset', 'owner', 'reset', '2026-10-25')`)
    const changes = db.prepare('SELECT total_changes() AS count').get()
    db.exec('PRAGMA query_only = ON')
    expect(
      (await getLearningSyncStatusWordIds(owner)).uploadWordIds.sort()
    ).toEqual(['reset', 'reviewed'])
    expect(await getLearningSyncStatusWordIds(otherOwner)).toEqual({
      uploadWordIds: ['other'],
      downloadWordIds: [],
    })
    expect(await getLearningSyncStatusWordIds('empty')).toEqual({
      uploadWordIds: [],
      downloadWordIds: [],
    })
    expect(db.prepare('SELECT total_changes() AS count').get()).toEqual(changes)
  })

  it('keeps canonical recovery visible after the correction upload is acknowledged', async () => {
    correction('pending')
    expect(await getLearningSyncStatusWordIds(owner)).toEqual({
      uploadWordIds: ['corrected'],
      downloadWordIds: ['corrected'],
    })
    db.exec(`UPDATE review_corrections SET status = 'synced', revision = 1,
      next_interval_days = 1, next_repetition_count = 1,
      next_easiness_factor = 2.5, created_at = '2026-10-25'`)
    expect(await getLearningSyncStatusWordIds(owner)).toEqual({
      uploadWordIds: [],
      downloadWordIds: ['corrected'],
    })
    db.exec('DELETE FROM review_correction_recovery')
    expect(await getLearningSyncStatusWordIds(owner)).toEqual({
      uploadWordIds: [],
      downloadWordIds: [],
    })
  })

  it('retains unresolved conflicts without a command, but excludes resolved corrections', async () => {
    correction('conflict')
    expect(await getLearningSyncStatusWordIds(owner)).toEqual({
      uploadWordIds: ['corrected'],
      downloadWordIds: [],
    })
    db.exec("UPDATE review_corrections SET resolved_at = '2026-10-25'")
    expect(await getLearningSyncStatusWordIds(owner)).toEqual({
      uploadWordIds: [],
      downloadWordIds: [],
    })
  })

  it('exposes an unsent review without its command, but does not revive work cancelled by deletion', async () => {
    word('reviewed')
    review('event', 'reviewed')
    db.exec('DELETE FROM learning_commands')
    expect((await getLearningSyncStatusWordIds(owner)).uploadWordIds).toEqual([
      'reviewed',
    ])
    db.exec("UPDATE words SET deleted_at = '2026-10-25'")
    expect((await getLearningSyncStatusWordIds(owner)).uploadWordIds).toEqual(
      []
    )
  })

  it('counts beyond the upload batch limit', async () => {
    db.exec('BEGIN')
    for (let index = 0; index < 501; index++) {
      word(`word-${index}`)
      review(`event-${index}`, `word-${index}`)
    }
    db.exec('COMMIT')
    expect(
      (await getLearningSyncStatusWordIds(owner)).uploadWordIds
    ).toHaveLength(501)
  })
})

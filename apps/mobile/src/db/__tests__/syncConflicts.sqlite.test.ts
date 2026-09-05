import type { DatabaseSync } from 'node:sqlite'
import { createTestDatabase } from './sqlite.fixture'
import { wordRepository } from '../wordRepository'
import { progressRepository } from '../progressRepository'

jest.mock('../initDB')
jest.mock('@/lib/sentry')

const firstVersion = '2026-09-05T10:00:00.000Z'
const editedVersion = '2026-09-05T10:01:00.000Z'
const serverVersion = '2026-09-05T10:02:00.000Z'
const progressId = 'progress-1'

describe('sync conflicts against real in-memory SQLite', () => {
  let database: DatabaseSync

  beforeEach(() => {
    database = createTestDatabase()
    database
      .prepare(
        `INSERT INTO words
      (word_id, user_id, dutch_lemma, translations, next_review_date, created_at, updated_at, sync_status)
      VALUES ('word-1', 'qa-user', 'huis', '{"en":["house"]}', '2026-09-05', ?, ?, 'pending')`
      )
      .run(firstVersion, firstVersion)
    database
      .prepare(
        `INSERT INTO user_progress
      (progress_id, user_id, word_id, status, reviewed_count, created_at, updated_at, sync_status)
      VALUES ('progress-1', 'qa-user', 'word-1', 'learning', 1, ?, ?, 'pending')`
      )
      .run(firstVersion, firstVersion)
  })

  afterEach(() => database.close())

  const row = (table: 'words' | 'user_progress') =>
    database.prepare(`SELECT * FROM ${table}`).get()!
  const acknowledgeWord = (version: string) =>
    wordRepository.reconcilePushedWords(
      [{ word_id: 'word-1', updated_at: serverVersion, deleted_at: null }],
      new Map([['word-1', version]])
    )
  const acknowledgeProgress = (version: string) =>
    progressRepository.reconcilePushedProgress(
      [
        {
          progress_id: progressId,
          updated_at: serverVersion,
          deleted_at: null,
        },
      ],
      new Map([[progressId, version]])
    )

  const remoteWord = async () => {
    const local = await wordRepository.getWordByIdAndUserId('word-1', 'qa-user')
    if (!local) throw new Error('Missing fixture word')
    return {
      ...local,
      repetition_count: 3,
      interval_days: 15,
      updated_at: serverVersion,
    }
  }

  it.each(['pending', 'error', 'conflict', 'deleted'])(
    'preserves the local %s word during a conflicting remote pull',
    async status => {
      const incoming = await remoteWord()
      database.prepare('UPDATE words SET sync_status = ?').run(status)
      await wordRepository.saveWords([incoming], { preserveUnsynced: true })
      expect(row('words')).toMatchObject({
        repetition_count: 0,
        updated_at: firstVersion,
        sync_status: status,
      })
    }
  )

  it('applies remote word progress once its local edit has been acknowledged', async () => {
    const incoming = await remoteWord()
    await acknowledgeWord(firstVersion)
    await wordRepository.saveWords([incoming], { preserveUnsynced: true })
    expect(row('words')).toMatchObject({
      repetition_count: 3,
      interval_days: 15,
      updated_at: serverVersion,
      sync_status: 'synced',
    })
  })

  it('keeps a newer local word edit pending when an older push is acknowledged', async () => {
    database
      .prepare('UPDATE words SET repetition_count = 3, updated_at = ?')
      .run(editedVersion)
    await acknowledgeWord(firstVersion)
    expect(row('words')).toMatchObject({
      repetition_count: 3,
      updated_at: editedVersion,
      sync_status: 'pending',
      synced_at: null,
    })
    await acknowledgeWord(editedVersion)
    expect(row('words')).toMatchObject({
      repetition_count: 3,
      updated_at: serverVersion,
      sync_status: 'synced',
    })
  })

  it('keeps newer progress pending and accepts only the matching acknowledgement', async () => {
    database
      .prepare(
        "UPDATE user_progress SET reviewed_count = 3, status = 'mastered', updated_at = ?"
      )
      .run(editedVersion)
    await acknowledgeProgress(firstVersion)
    expect(row('user_progress')).toMatchObject({
      reviewed_count: 3,
      status: 'mastered',
      updated_at: editedVersion,
      sync_status: 'pending',
    })
    await acknowledgeProgress(editedVersion)
    expect(row('user_progress')).toMatchObject({
      reviewed_count: 3,
      status: 'mastered',
      updated_at: serverVersion,
      sync_status: 'synced',
    })
  })

  it('does not undo a local deletion after an in-flight active-word upload', async () => {
    database
      .prepare(
        "UPDATE words SET deleted_at = ?, updated_at = ?, sync_status = 'deleted'"
      )
      .run(editedVersion, editedVersion)
    await acknowledgeWord(firstVersion)
    expect(row('words')).toMatchObject({
      deleted_at: editedVersion,
      sync_status: 'deleted',
      updated_at: editedVersion,
    })
  })

  it.each(['pending', 'error', 'conflict', 'deleted'])(
    'preserves unsynced %s progress when pulling remote state',
    async status => {
      database.prepare('UPDATE user_progress SET sync_status = ?').run(status)
      await progressRepository.saveProgress(
        [
          {
            progress_id: progressId,
            user_id: 'qa-user',
            word_id: 'word-1',
            status: 'mastered',
            reviewed_count: 7,
            last_reviewed_at: serverVersion,
            created_at: firstVersion,
            updated_at: serverVersion,
          },
        ],
        { preserveUnsynced: true }
      )
      expect(row('user_progress')).toMatchObject({
        status: 'learning',
        reviewed_count: 1,
        sync_status: status,
        updated_at: firstVersion,
      })
    }
  )

  it('applies remote progress after the local version has been acknowledged', async () => {
    await acknowledgeProgress(firstVersion)
    await progressRepository.saveProgress(
      [
        {
          progress_id: progressId,
          user_id: 'qa-user',
          word_id: 'word-1',
          status: 'mastered',
          reviewed_count: 7,
          last_reviewed_at: serverVersion,
          created_at: firstVersion,
          updated_at: serverVersion,
        },
      ],
      { preserveUnsynced: true }
    )
    expect(row('user_progress')).toMatchObject({
      status: 'mastered',
      reviewed_count: 7,
      sync_status: 'synced',
    })
  })
})

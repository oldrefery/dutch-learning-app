import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTestDatabase } from '@/db/__tests__/sqlite.fixture'
import { syncStatusService } from '../syncStatusService'

jest.mock('@/db/initDB')
jest.mock('@/utils/network', () => ({
  getLastSyncTimestamp: jest.fn().mockResolvedValue(null),
  isNetworkAvailable: jest.fn().mockResolvedValue(false),
}))
jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryFollowingEnabled: () => false,
  isDictionaryContentEnabled: () => true,
}))

it('reads status after a competing SQLite transaction releases its lock without changing cards or queues', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'sync-status-lock-'))
  const path = join(directory, 'status.db')
  const database = createTestDatabase(path)
  const writer = new DatabaseSync(path)
  let unlock: ReturnType<typeof setTimeout> | undefined
  try {
    const insert = database.prepare(`
      INSERT INTO words (
        word_id, user_id, dutch_lemma, translations, next_review_date,
        created_at, updated_at, sync_status
      ) VALUES (?, ?, 'huis', '{}', '2026-10-10', '2026-10-10', '2026-10-10', 'pending')
    `)
    insert.run('own-word', 'owner')
    insert.run('other-word', 'other-owner')
    const before = database
      .prepare('SELECT * FROM words ORDER BY word_id')
      .all()
    const changesBefore = database
      .prepare('SELECT total_changes() AS count')
      .get()
    writer.exec('BEGIN EXCLUSIVE')
    expect(() => database.prepare('SELECT * FROM words').all()).toThrow(
      'database is locked'
    )
    unlock = setTimeout(() => writer.exec('COMMIT'), 20)

    const snapshot = await syncStatusService.getSnapshot('owner')

    expect(snapshot).toMatchObject({
      totalLocalWords: 1,
      pendingWords: 1,
      totalPending: 1,
      isOnline: false,
    })
    expect(
      database.prepare('SELECT * FROM words ORDER BY word_id').all()
    ).toEqual(before)
    expect(database.prepare('SELECT total_changes() AS count').get()).toEqual(
      changesBefore
    )
  } finally {
    clearTimeout(unlock)
    writer.close()
    database.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createMockCollection } from '@/__tests__/helpers/factories'
import { getDatabase } from '../initDB'
import { collectionRepository } from '../collectionRepository'
import { createTestDatabase } from './sqlite.fixture'

jest.mock('../initDB')
jest.mock('@sentry/react-native')

const BEGIN_WRITE = 'BEGIN IMMEDIATE'

describe('downloaded collections with a competing SQLite writer', () => {
  let directory: string
  let database: DatabaseSync
  let writer: DatabaseSync
  let unlock: ReturnType<typeof setTimeout> | undefined

  const collection = createMockCollection({
    collection_id: 'downloaded-collection',
    user_id: 'owner',
    name: 'Server collection',
  })
  const saved = () =>
    database
      .prepare('SELECT * FROM collections WHERE collection_id = ?')
      .get(collection.collection_id)

  beforeEach(async () => {
    jest.clearAllMocks()
    directory = mkdtempSync(join(tmpdir(), 'collection-write-lock-'))
    const path = join(directory, 'collections.db')
    database = createTestDatabase(path)
    writer = new DatabaseSync(path)
    const adapter = await getDatabase()
    // Match Expo's array and variadic parameter overloads on real SQLite.
    jest
      .spyOn(adapter, 'runAsync')
      .mockImplementation(async (sql, ...params) => {
        const values = (
          params.length === 1 && Array.isArray(params[0]) ? params[0] : params
        ) as SQLInputValue[]
        const result = database.prepare(sql).run(...values)
        return {
          changes: Number(result.changes),
          lastInsertRowId: Number(result.lastInsertRowid),
        }
      })
  })

  afterEach(() => {
    clearTimeout(unlock)
    writer.close()
    database.close()
    rmSync(directory, { recursive: true, force: true })
  })

  it('saves a downloaded row after a temporary writer lock is released', async () => {
    writer.exec(BEGIN_WRITE)
    unlock = setTimeout(() => writer.exec('COMMIT'), 20)

    await collectionRepository.saveCollections([collection])

    expect(saved()).toMatchObject({
      name: collection.name,
      sync_status: 'synced',
    })
    expect(
      database.prepare('SELECT count(*) AS count FROM collections').get()
    ).toEqual({ count: 1 })
  })

  it.each(['pending', 'deleted', 'error', 'conflict'])(
    'preserves a newer local %s row committed while the download waits',
    async status => {
      await collectionRepository.saveCollections([collection])
      writer.exec(BEGIN_WRITE)
      writer
        .prepare(
          'UPDATE collections SET name = ?, sync_status = ?, synced_at = NULL WHERE collection_id = ?'
        )
        .run('Local change', status, collection.collection_id)
      unlock = setTimeout(() => writer.exec('COMMIT'), 20)

      await collectionRepository.saveCollections([collection])

      expect(saved()).toMatchObject({
        name: 'Local change',
        sync_status: status,
        synced_at: null,
      })
    }
  )

  it('fails after bounded retries if the writer keeps the lock', async () => {
    const adapter = await getDatabase()
    const run = jest.spyOn(adapter, 'runAsync')
    writer.exec(BEGIN_WRITE)

    await expect(
      collectionRepository.saveCollections([collection])
    ).rejects.toThrow('database is locked')

    writer.exec('ROLLBACK')
    expect(run).toHaveBeenCalledTimes(4)
    expect(saved()).toBeUndefined()
  })

  it('does not retry a constraint violation', async () => {
    const adapter = await getDatabase()
    const run = jest.spyOn(adapter, 'runAsync')
    database.exec(`CREATE TRIGGER reject_collection BEFORE INSERT ON collections
      BEGIN SELECT RAISE(ABORT, 'Rejected collection'); END;`)

    await expect(
      collectionRepository.saveCollections([collection])
    ).rejects.toThrow('Rejected collection')
    expect(run).toHaveBeenCalledTimes(1)
    expect(saved()).toBeUndefined()
  })

  it('still applies an explicit local edit to an existing pending collection', async () => {
    await collectionRepository.saveCollections([collection], 'pending')
    await collectionRepository.saveCollections(
      [{ ...collection, name: 'Next local edit' }],
      'pending'
    )

    expect(saved()).toMatchObject({
      name: 'Next local edit',
      sync_status: 'pending',
    })
  })
})

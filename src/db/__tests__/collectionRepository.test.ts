/**
 * Tests for CollectionRepository
 *
 * SQLite repository for local collection storage with sync status tracking.
 * Uses the same mock pattern as wordRepository.test.ts.
 */

import { collectionRepository } from '../collectionRepository'
import * as initDB from '../initDB'
import { createMockCollection } from '@/__tests__/helpers/factories'

jest.mock('../initDB')

describe('CollectionRepository', () => {
  const USER_ID = 'test-user-id'
  const COLLECTION_ID = 'col-123'

  const mockFirst = jest.fn()
  const mockSql = jest.fn().mockReturnValue({ first: mockFirst })

  const mockDatabase = {
    runAsync: jest.fn(),
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    sql: mockSql,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockDatabase.runAsync.mockResolvedValue(undefined)
    mockDatabase.getAllAsync.mockResolvedValue([])
    mockDatabase.getFirstAsync.mockResolvedValue(null)
    mockFirst.mockResolvedValue(null)
    ;(initDB.getDatabase as jest.Mock).mockResolvedValue(mockDatabase)
  })

  describe('saveCollections', () => {
    it('should save a single collection with correct params', async () => {
      const collection = createMockCollection({
        collection_id: COLLECTION_ID,
        user_id: USER_ID,
        name: 'Dutch Basics',
      })

      await collectionRepository.saveCollections([collection])

      expect(mockDatabase.runAsync).toHaveBeenCalledTimes(1)
      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO collections'),
        expect.arrayContaining([COLLECTION_ID, USER_ID, 'Dutch Basics'])
      )
    })

    it('should save multiple collections', async () => {
      const collections = [
        createMockCollection({ collection_id: 'col-1' }),
        createMockCollection({ collection_id: 'col-2' }),
      ]

      await collectionRepository.saveCollections(collections)

      expect(mockDatabase.runAsync).toHaveBeenCalledTimes(2)
    })

    it('should default sync_status to synced', async () => {
      const collection = createMockCollection()

      await collectionRepository.saveCollections([collection])

      const params = mockDatabase.runAsync.mock.calls[0][1]
      expect(params[params.length - 1]).toBe('synced')
    })

    it('should use custom sync_status when provided', async () => {
      const collection = createMockCollection()

      await collectionRepository.saveCollections([collection], 'pending')

      const params = mockDatabase.runAsync.mock.calls[0][1]
      expect(params[params.length - 1]).toBe('pending')
    })

    it('should serialize shared_with as JSON', async () => {
      const collection = createMockCollection({
        shared_with: ['user-a', 'user-b'],
      })

      await collectionRepository.saveCollections([collection])

      const params = mockDatabase.runAsync.mock.calls[0][1]
      expect(params).toContain(JSON.stringify(['user-a', 'user-b']))
    })

    it('should propagate database errors', async () => {
      mockDatabase.runAsync.mockRejectedValue(new Error('DB error'))

      await expect(
        collectionRepository.saveCollections([createMockCollection()])
      ).rejects.toThrow('DB error')
    })
  })

  describe('getCollectionsByUserId', () => {
    it('should return collections for a user', async () => {
      const mockCollections = [
        createMockCollection({ user_id: USER_ID, name: 'A' }),
      ]
      mockDatabase.getAllAsync.mockResolvedValue(mockCollections)

      const result = await collectionRepository.getCollectionsByUserId(USER_ID)

      expect(result).toEqual(mockCollections)
      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('WHERE user_id = ?'),
        [USER_ID]
      )
    })

    it('should return empty array when none found', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([])

      const result = await collectionRepository.getCollectionsByUserId(USER_ID)

      expect(result).toEqual([])
    })

    it('should filter out deleted collections', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([])

      await collectionRepository.getCollectionsByUserId(USER_ID)

      const query = mockDatabase.getAllAsync.mock.calls[0][0]
      expect(query).toContain("!= 'deleted'")
    })
  })

  describe('getCollectionsByIds', () => {
    it('should return matching collections', async () => {
      const mockCollections = [createMockCollection()]
      mockDatabase.getAllAsync.mockResolvedValue(mockCollections)

      const result = await collectionRepository.getCollectionsByIds(
        ['col-1', 'col-2'],
        USER_ID
      )

      expect(result).toEqual(mockCollections)
      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('IN (?,?)'),
        [USER_ID, 'col-1', 'col-2']
      )
    })

    it('should return empty array for empty input', async () => {
      const result = await collectionRepository.getCollectionsByIds([], USER_ID)

      expect(result).toEqual([])
      expect(mockDatabase.getAllAsync).not.toHaveBeenCalled()
    })
  })

  describe('getCollectionById', () => {
    it('should return collection when found', async () => {
      const mockCollection = createMockCollection({
        collection_id: COLLECTION_ID,
      })
      mockFirst.mockResolvedValue(mockCollection)

      const result = await collectionRepository.getCollectionById(
        COLLECTION_ID,
        USER_ID
      )

      expect(result).toEqual(mockCollection)
    })

    it('should return null when not found', async () => {
      mockFirst.mockResolvedValue(null)

      const result = await collectionRepository.getCollectionById(
        COLLECTION_ID,
        USER_ID
      )

      expect(result).toBeNull()
    })
  })

  describe('deleteCollection', () => {
    it('should delete collection by ID', async () => {
      await collectionRepository.deleteCollection(COLLECTION_ID)

      expect(mockSql).toHaveBeenCalled()
      // Verify the tagged template received the correct collection ID
      const callArgs = mockSql.mock.calls[0]
      expect(
        callArgs[0].some((s: string) => s.includes('DELETE FROM collections'))
      ).toBe(true)
    })
  })

  describe('markCollectionDeleted', () => {
    it('should set sync_status to deleted and update timestamp', async () => {
      await collectionRepository.markCollectionDeleted(COLLECTION_ID)

      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("sync_status = 'deleted'"),
        expect.arrayContaining([COLLECTION_ID])
      )
    })
  })

  describe('updateCollection', () => {
    it('should update name field', async () => {
      await collectionRepository.updateCollection(COLLECTION_ID, {
        name: 'New Name',
      })

      const query = mockDatabase.runAsync.mock.calls[0][0]
      expect(query).toContain('name = ?')

      const params = mockDatabase.runAsync.mock.calls[0][1]
      expect(params).toContain('New Name')
    })

    it('should update description field', async () => {
      await collectionRepository.updateCollection(COLLECTION_ID, {
        description: 'New description',
      })

      const query = mockDatabase.runAsync.mock.calls[0][0]
      expect(query).toContain('description = ?')
    })

    it('should set sync_status to pending', async () => {
      await collectionRepository.updateCollection(COLLECTION_ID, {
        name: 'Test',
      })

      const query = mockDatabase.runAsync.mock.calls[0][0]
      expect(query).toContain('sync_status = ?')

      const params = mockDatabase.runAsync.mock.calls[0][1]
      expect(params).toContain('pending')
    })

    it('should handle partial updates with only specified fields', async () => {
      await collectionRepository.updateCollection(COLLECTION_ID, {
        name: 'Only Name',
      })

      const query = mockDatabase.runAsync.mock.calls[0][0]
      expect(query).toContain('name = ?')
      expect(query).not.toContain('description = ?')
    })
  })

  describe('getPendingSyncCollections', () => {
    it('should return only pending collections', async () => {
      const pendingCollections = [createMockCollection()]
      mockDatabase.getAllAsync.mockResolvedValue(pendingCollections)

      const result =
        await collectionRepository.getPendingSyncCollections(USER_ID)

      expect(result).toEqual(pendingCollections)
      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining("sync_status = 'pending'"),
        [USER_ID]
      )
    })
  })

  describe('markCollectionsSynced', () => {
    it('should update sync_status to synced for given IDs', async () => {
      await collectionRepository.markCollectionsSynced(['col-1', 'col-2'])

      expect(mockDatabase.runAsync).toHaveBeenCalledWith(
        expect.stringContaining("sync_status = 'synced'"),
        ['col-1', 'col-2']
      )
    })

    it('should no-op for empty array', async () => {
      await collectionRepository.markCollectionsSynced([])

      expect(mockDatabase.runAsync).not.toHaveBeenCalled()
    })
  })

  describe('getDeletedCollections', () => {
    it('should return only deleted collections', async () => {
      const deletedCollections = [createMockCollection()]
      mockDatabase.getAllAsync.mockResolvedValue(deletedCollections)

      const result = await collectionRepository.getDeletedCollections(USER_ID)

      expect(result).toEqual(deletedCollections)
      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining("sync_status = 'deleted'"),
        [USER_ID]
      )
    })
  })
})

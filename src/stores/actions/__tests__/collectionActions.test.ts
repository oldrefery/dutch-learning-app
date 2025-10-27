/**
 * Unit tests for collectionActions
 * Tests collection CRUD operations with offline-first repository
 */

import { collectionRepository } from '@/db/collectionRepository'
import {
  collectionSharingService,
  CollectionSharingError,
} from '@/services/collectionSharingService'
import { createCollectionActions } from '../collectionActions'
import type { Collection } from '@/types/database'
import type {
  StoreSetFunction,
  StoreGetFunction,
} from '@/types/ApplicationStoreTypes'

jest.mock('@/db/collectionRepository')
jest.mock('@/services/collectionSharingService')
jest.mock('@/lib/sentry')
jest.mock('@/utils/logger')
jest.mock('@/utils/network')

describe('collectionActions', () => {
  // Helper to generate random IDs
  const generateId = (prefix: string) =>
    `${prefix}_${Math.random().toString(36).substring(2, 9)}`

  const USER_ID = generateId('user')
  const COLLECTION_ID = generateId('collection')

  // Helper to create mock collections
  const createMockCollection = (
    overrides: Partial<Collection> = {}
  ): Collection => ({
    collection_id: generateId('collection'),
    user_id: USER_ID,
    name: 'Test Collection',
    description: null,
    is_shared: false,
    shared_with: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  })

  let mockSet: jest.Mock
  let mockGet: jest.Mock
  let actions: ReturnType<typeof createCollectionActions>

  beforeEach(() => {
    jest.clearAllMocks()

    mockSet = jest.fn()
    mockGet = jest.fn(() => ({
      currentUserId: USER_ID,
      userAccessLevel: 'owner',
      collections: [],
      collectionsLoading: false,
      error: null,
    }))

    actions = createCollectionActions(
      mockSet as unknown as StoreSetFunction,
      mockGet as unknown as StoreGetFunction
    )
  })

  describe('fetchCollections', () => {
    it('should fetch collections from repository by user ID', async () => {
      const mockCollections = [
        createMockCollection({ collection_id: 'col-1' }),
        createMockCollection({ collection_id: 'col-2' }),
      ]
      ;(
        collectionRepository.getCollectionsByUserId as jest.Mock
      ).mockResolvedValue(mockCollections)

      await actions.fetchCollections()

      expect(collectionRepository.getCollectionsByUserId).toHaveBeenCalledWith(
        USER_ID
      )
    })

    it('should handle fetch errors gracefully', async () => {
      const error = new Error('Fetch failed')
      ;(
        collectionRepository.getCollectionsByUserId as jest.Mock
      ).mockRejectedValue(error)

      await actions.fetchCollections()

      // Error should be handled without throwing
      expect(collectionRepository.getCollectionsByUserId).toHaveBeenCalled()
    })

    it('should skip fetch if no user ID', async () => {
      mockGet.mockReturnValueOnce({
        currentUserId: null,
        userAccessLevel: 'owner',
        collections: [],
        collectionsLoading: false,
        error: null,
      })

      await actions.fetchCollections()

      expect(collectionRepository.getCollectionsByUserId).not.toHaveBeenCalled()
    })

    it('should return early if no collections found', async () => {
      ;(
        collectionRepository.getCollectionsByUserId as jest.Mock
      ).mockResolvedValue(null)

      await actions.fetchCollections()

      expect(collectionRepository.getCollectionsByUserId).toHaveBeenCalledWith(
        USER_ID
      )
    })
  })

  describe('createNewCollection', () => {
    it('should create collection in repository with proper object structure', async () => {
      ;(collectionRepository.saveCollections as jest.Mock).mockResolvedValue(
        undefined
      )

      const result = await actions.createNewCollection('New Collection')

      expect(collectionRepository.saveCollections).toHaveBeenCalled()
      expect(result).not.toBeNull()
      expect(result?.name).toBe('New Collection')
      expect(result?.user_id).toBe(USER_ID)
      expect(result?.is_shared).toBe(false)
      expect(result?.collection_id).toBeTruthy()
    })

    it('should generate UUID for new collection', async () => {
      ;(collectionRepository.saveCollections as jest.Mock).mockResolvedValue(
        undefined
      )

      const col1 = await actions.createNewCollection('Col1')
      const col2 = await actions.createNewCollection('Col2')

      expect(col1?.collection_id).not.toBe(col2?.collection_id)
      // UUID format includes dashes
      expect(col1?.collection_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/)
      expect(col2?.collection_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/)
    })

    it('should skip if no user ID', async () => {
      mockGet.mockReturnValueOnce({
        currentUserId: null,
        userAccessLevel: 'owner',
        collections: [],
      })

      const result = await actions.createNewCollection('New Collection')

      expect(result).toBeNull()
      expect(collectionRepository.saveCollections).not.toHaveBeenCalled()
    })

    it('should handle repository save errors', async () => {
      const error = new Error('Save failed')
      ;(collectionRepository.saveCollections as jest.Mock).mockRejectedValue(
        error
      )

      const result = await actions.createNewCollection('New Collection')

      expect(result).toBeNull()
    })
  })

  describe('deleteCollection', () => {
    it('should delete collection from repository', async () => {
      ;(collectionRepository.deleteCollection as jest.Mock).mockResolvedValue(
        undefined
      )

      mockGet.mockReturnValueOnce({
        currentUserId: USER_ID,
        userAccessLevel: 'owner',
        collections: [createMockCollection({ collection_id: COLLECTION_ID })],
      })

      await actions.deleteCollection(COLLECTION_ID)

      expect(collectionRepository.deleteCollection).toHaveBeenCalledWith(
        COLLECTION_ID
      )
    })

    it('should prevent read-only users from deleting last collection', async () => {
      mockGet.mockReturnValue({
        currentUserId: USER_ID,
        userAccessLevel: 'read_only',
        collections: [createMockCollection({ collection_id: COLLECTION_ID })],
      })

      await actions.deleteCollection(COLLECTION_ID)

      expect(collectionRepository.deleteCollection).not.toHaveBeenCalled()
    })

    it('should skip if no user ID', async () => {
      mockGet.mockReturnValueOnce({
        currentUserId: null,
        userAccessLevel: 'owner',
        collections: [],
      })

      await actions.deleteCollection(COLLECTION_ID)

      expect(collectionRepository.deleteCollection).not.toHaveBeenCalled()
    })

    it('should handle delete errors', async () => {
      const error = new Error('Delete failed')
      ;(collectionRepository.deleteCollection as jest.Mock).mockRejectedValue(
        error
      )

      mockGet.mockReturnValueOnce({
        currentUserId: USER_ID,
        userAccessLevel: 'owner',
        collections: [createMockCollection({ collection_id: COLLECTION_ID })],
      })

      await actions.deleteCollection(COLLECTION_ID)

      expect(collectionRepository.deleteCollection).toHaveBeenCalled()
    })
  })

  describe('renameCollection', () => {
    it('should update collection name in repository', async () => {
      ;(collectionRepository.updateCollection as jest.Mock).mockResolvedValue(
        undefined
      )

      await actions.renameCollection(COLLECTION_ID, 'New Name')

      expect(collectionRepository.updateCollection).toHaveBeenCalledWith(
        COLLECTION_ID,
        expect.objectContaining({
          name: 'New Name',
        })
      )
    })

    it('should skip if no user ID', async () => {
      mockGet.mockReturnValueOnce({
        currentUserId: null,
        userAccessLevel: 'owner',
        collections: [],
      })

      await actions.renameCollection(COLLECTION_ID, 'New Name')

      expect(collectionRepository.updateCollection).not.toHaveBeenCalled()
    })

    it('should handle update errors', async () => {
      const error = new Error('Update failed')
      ;(collectionRepository.updateCollection as jest.Mock).mockRejectedValue(
        error
      )

      await actions.renameCollection(COLLECTION_ID, 'New Name')

      expect(collectionRepository.updateCollection).toHaveBeenCalled()
    })
  })

  describe('shareCollection', () => {
    it('should call collectionSharingService for sharing', async () => {
      ;(
        collectionSharingService.shareCollection as jest.Mock
      ).mockResolvedValue({
        success: true,
        data: 'share-token-123',
      })

      const result = await actions.shareCollection(COLLECTION_ID)

      expect(collectionSharingService.shareCollection).toHaveBeenCalledWith(
        COLLECTION_ID,
        USER_ID
      )
      expect(result).toBe('share-token-123')
    })

    it('should handle sharing errors', async () => {
      ;(
        collectionSharingService.shareCollection as jest.Mock
      ).mockResolvedValue({
        success: false,
        error: CollectionSharingError.UNKNOWN_ERROR,
      })

      const result = await actions.shareCollection(COLLECTION_ID)

      expect(result).toBeNull()
    })

    it('should skip if no user ID', async () => {
      mockGet.mockReturnValueOnce({
        currentUserId: null,
        userAccessLevel: 'owner',
        collections: [],
      })

      const result = await actions.shareCollection(COLLECTION_ID)

      expect(result).toBeNull()
      expect(collectionSharingService.shareCollection).not.toHaveBeenCalled()
    })

    it('should handle service exceptions', async () => {
      const error = new Error('Service error')
      ;(
        collectionSharingService.shareCollection as jest.Mock
      ).mockRejectedValue(error)

      const result = await actions.shareCollection(COLLECTION_ID)

      expect(result).toBeNull()
    })
  })

  describe('unshareCollection', () => {
    it('should call collectionSharingService for unsharing', async () => {
      ;(
        collectionSharingService.unshareCollection as jest.Mock
      ).mockResolvedValue({
        success: true,
      })

      const result = await actions.unshareCollection(COLLECTION_ID)

      expect(collectionSharingService.unshareCollection).toHaveBeenCalledWith(
        COLLECTION_ID,
        USER_ID
      )
      expect(result).toBe(true)
    })

    it('should return false on sharing error', async () => {
      ;(
        collectionSharingService.unshareCollection as jest.Mock
      ).mockResolvedValue({
        success: false,
        error: CollectionSharingError.NOT_SHARED,
      })

      const result = await actions.unshareCollection(COLLECTION_ID)

      expect(result).toBe(false)
    })

    it('should skip if no user ID', async () => {
      mockGet.mockReturnValueOnce({
        currentUserId: null,
        userAccessLevel: 'owner',
        collections: [],
      })

      const result = await actions.unshareCollection(COLLECTION_ID)

      expect(result).toBe(false)
      expect(collectionSharingService.unshareCollection).not.toHaveBeenCalled()
    })

    it('should handle service exceptions', async () => {
      const error = new Error('Service error')
      ;(
        collectionSharingService.unshareCollection as jest.Mock
      ).mockRejectedValue(error)

      const result = await actions.unshareCollection(COLLECTION_ID)

      expect(result).toBe(false)
    })
  })

  describe('getCollectionShareStatus', () => {
    it('should call collectionSharingService to get share status', async () => {
      const mockStatus = { isShared: true, shareToken: 'token-123' }
      ;(
        collectionSharingService.getCollectionShareStatus as jest.Mock
      ).mockResolvedValue({
        success: true,
        data: mockStatus,
      })

      const result = await actions.getCollectionShareStatus(COLLECTION_ID)

      expect(
        collectionSharingService.getCollectionShareStatus
      ).toHaveBeenCalledWith(COLLECTION_ID, USER_ID)
      expect(result).toEqual(mockStatus)
    })

    it('should return null if not shared', async () => {
      ;(
        collectionSharingService.getCollectionShareStatus as jest.Mock
      ).mockResolvedValue({
        success: false,
        error: CollectionSharingError.NOT_SHARED,
      })

      const result = await actions.getCollectionShareStatus(COLLECTION_ID)

      expect(result).toBeNull()
    })

    it('should skip if no user ID', async () => {
      mockGet.mockReturnValueOnce({
        currentUserId: null,
        userAccessLevel: 'owner',
        collections: [],
      })

      const result = await actions.getCollectionShareStatus(COLLECTION_ID)

      expect(result).toBeNull()
      expect(
        collectionSharingService.getCollectionShareStatus
      ).not.toHaveBeenCalled()
    })

    it('should handle service exceptions', async () => {
      const error = new Error('Service error')
      ;(
        collectionSharingService.getCollectionShareStatus as jest.Mock
      ).mockRejectedValue(error)

      const result = await actions.getCollectionShareStatus(COLLECTION_ID)

      expect(result).toBeNull()
    })
  })

  describe('offline-first behavior', () => {
    it('should use repository for local storage first', async () => {
      const mockCollections = [createMockCollection()]
      ;(
        collectionRepository.getCollectionsByUserId as jest.Mock
      ).mockResolvedValue(mockCollections)

      await actions.fetchCollections()

      expect(collectionRepository.getCollectionsByUserId).toHaveBeenCalledWith(
        USER_ID
      )
    })

    it('should save new collections to repository immediately', async () => {
      ;(collectionRepository.saveCollections as jest.Mock).mockResolvedValue(
        undefined
      )

      await actions.createNewCollection('Offline Collection')

      expect(collectionRepository.saveCollections).toHaveBeenCalled()
    })

    it('should update repository on collection rename', async () => {
      ;(collectionRepository.updateCollection as jest.Mock).mockResolvedValue(
        undefined
      )

      await actions.renameCollection(COLLECTION_ID, 'Updated Name')

      expect(collectionRepository.updateCollection).toHaveBeenCalled()
    })

    it('should delete from repository immediately', async () => {
      ;(collectionRepository.deleteCollection as jest.Mock).mockResolvedValue(
        undefined
      )

      mockGet.mockReturnValueOnce({
        currentUserId: USER_ID,
        userAccessLevel: 'owner',
        collections: [createMockCollection({ collection_id: COLLECTION_ID })],
      })

      await actions.deleteCollection(COLLECTION_ID)

      expect(collectionRepository.deleteCollection).toHaveBeenCalledWith(
        COLLECTION_ID
      )
    })
  })
})

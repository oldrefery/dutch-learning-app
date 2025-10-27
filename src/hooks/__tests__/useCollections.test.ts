/**
 * Unit tests for useCollections hook
 * Tests collection management and store integration
 */

import { renderHook, act } from '@testing-library/react-native'
import { useCollections } from '../useCollections'
import { useApplicationStore } from '@/stores/useApplicationStore'
import type { Collection } from '@/types/database'

jest.mock('@/stores/useApplicationStore')
jest.mock('@/lib/supabaseClient')

describe('useCollections', () => {
  // Helper functions to generate random test data
  const generateId = (prefix: string) =>
    `${prefix}_${Math.random().toString(36).substring(2, 9)}`

  const NEW_COLLECTION_NAME = 'New Collection'
  const TEST_COLLECTION_NAME = 'Test Collection'
  const SPECIAL_COLLECTION_NAME = 'Dutch "Advanced" & Complex'

  // Helper to create mock collection
  const createMockCollection = (
    overrides: Partial<Collection> = {}
  ): Collection => ({
    collection_id: generateId('collection'),
    user_id: generateId('user'),
    name: 'Dutch Verbs',
    description: 'Common Dutch verbs',
    color: '#FF5733',
    icon: 'book',
    word_count: 10,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_default: false,
    sync_status: 'synced',
    ...overrides,
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('collections state', () => {
    it('should return collections from store', () => {
      const mockCollections = [
        createMockCollection({ collection_id: 'coll-1', name: 'Verbs' }),
        createMockCollection({ collection_id: 'coll-2', name: 'Nouns' }),
      ]

      ;(useApplicationStore as jest.Mock).mockReturnValue({
        collections: mockCollections,
        collectionsLoading: false,
        fetchCollections: jest.fn(),
        createNewCollection: jest.fn(),
      })

      const { result } = renderHook(() => useCollections())

      expect(result.current.collections).toEqual(mockCollections)
    })

    it('should return empty collections array initially', () => {
      ;(useApplicationStore as jest.Mock).mockReturnValue({
        collections: [],
        collectionsLoading: false,
        fetchCollections: jest.fn(),
        createNewCollection: jest.fn(),
      })

      const { result } = renderHook(() => useCollections())

      expect(result.current.collections).toEqual([])
      expect(Array.isArray(result.current.collections)).toBe(true)
    })

    it('should handle collections with different properties', () => {
      const mockCollections = [
        createMockCollection({ name: 'Verbs', word_count: 25 }),
        createMockCollection({ name: 'Nouns', word_count: 50 }),
        createMockCollection({ name: 'Adjectives', word_count: 30 }),
      ]

      ;(useApplicationStore as jest.Mock).mockReturnValue({
        collections: mockCollections,
        collectionsLoading: false,
        fetchCollections: jest.fn(),
        createNewCollection: jest.fn(),
      })

      const { result } = renderHook(() => useCollections())

      expect(result.current.collections.length).toBe(3)
      expect(result.current.collections[0].name).toBe('Verbs')
      expect(result.current.collections[1].word_count).toBe(50)
    })
  })

  describe('collectionsLoading state', () => {
    it('should return loading state from store', () => {
      ;(useApplicationStore as jest.Mock).mockReturnValue({
        collections: [],
        collectionsLoading: true,
        fetchCollections: jest.fn(),
        createNewCollection: jest.fn(),
      })

      const { result } = renderHook(() => useCollections())

      expect(result.current.collectionsLoading).toBe(true)
    })

    it('should return false when not loading', () => {
      ;(useApplicationStore as jest.Mock).mockReturnValue({
        collections: [createMockCollection()],
        collectionsLoading: false,
        fetchCollections: jest.fn(),
        createNewCollection: jest.fn(),
      })

      const { result } = renderHook(() => useCollections())

      expect(result.current.collectionsLoading).toBe(false)
    })

    it('should handle loading state changes', () => {
      const { rerender } = renderHook(() => useCollections(), {
        initialProps: undefined,
      })

      ;(useApplicationStore as jest.Mock).mockReturnValue({
        collections: [],
        collectionsLoading: true,
        fetchCollections: jest.fn(),
        createNewCollection: jest.fn(),
      })

      rerender()

      const { result } = renderHook(() => useCollections())
      expect(result.current.collectionsLoading).toBe(true)
    })
  })

  describe('fetchCollections', () => {
    it('should call store fetchCollections function', async () => {
      const fetchCollectionsFn = jest.fn().mockResolvedValue(undefined)

      ;(useApplicationStore as jest.Mock).mockReturnValue({
        collections: [],
        collectionsLoading: false,
        fetchCollections: fetchCollectionsFn,
        createNewCollection: jest.fn(),
      })

      const { result } = renderHook(() => useCollections())

      await act(async () => {
        await result.current.fetchCollections()
      })

      expect(fetchCollectionsFn).toHaveBeenCalledTimes(1)
    })

    it('should return the promise from store function', async () => {
      const mockPromise = Promise.resolve(undefined)
      const fetchCollectionsFn = jest.fn().mockReturnValue(mockPromise)

      ;(useApplicationStore as jest.Mock).mockReturnValue({
        collections: [],
        collectionsLoading: false,
        fetchCollections: fetchCollectionsFn,
        createNewCollection: jest.fn(),
      })

      const { result } = renderHook(() => useCollections())

      const returnedPromise = result.current.fetchCollections()

      expect(returnedPromise).toBe(mockPromise)
    })

    it('should handle fetch errors from store', async () => {
      const error = new Error('Fetch failed')
      const fetchCollectionsFn = jest.fn().mockRejectedValue(error)

      ;(useApplicationStore as jest.Mock).mockReturnValue({
        collections: [],
        collectionsLoading: false,
        fetchCollections: fetchCollectionsFn,
        createNewCollection: jest.fn(),
      })

      const { result } = renderHook(() => useCollections())

      await expect(
        act(async () => {
          await result.current.fetchCollections()
        })
      ).rejects.toThrow('Fetch failed')
    })
  })

  describe('createNewCollection', () => {
    it('should call store createNewCollection with name', async () => {
      const newCollection = createMockCollection({
        collection_id: 'new-coll',
        name: NEW_COLLECTION_NAME,
      })
      const createFn = jest.fn().mockResolvedValue(newCollection)

      ;(useApplicationStore as jest.Mock).mockReturnValue({
        collections: [],
        collectionsLoading: false,
        fetchCollections: jest.fn(),
        createNewCollection: createFn,
      })

      const { result } = renderHook(() => useCollections())

      let createdCollection: Collection | undefined

      await act(async () => {
        createdCollection =
          await result.current.createNewCollection(NEW_COLLECTION_NAME)
      })

      expect(createFn).toHaveBeenCalledWith(NEW_COLLECTION_NAME)
      expect(createdCollection).toEqual(newCollection)
    })

    it('should return created collection from store', async () => {
      const newCollection = createMockCollection({
        name: TEST_COLLECTION_NAME,
      })
      const createFn = jest.fn().mockResolvedValue(newCollection)

      ;(useApplicationStore as jest.Mock).mockReturnValue({
        collections: [],
        collectionsLoading: false,
        fetchCollections: jest.fn(),
        createNewCollection: createFn,
      })

      const { result } = renderHook(() => useCollections())

      let createdCollection: Collection | undefined

      await act(async () => {
        createdCollection =
          await result.current.createNewCollection(TEST_COLLECTION_NAME)
      })

      expect(createdCollection?.name).toBe(TEST_COLLECTION_NAME)
      expect(createdCollection?.collection_id).toBe(newCollection.collection_id)
    })

    it('should handle create errors from store', async () => {
      const error = new Error('Create failed')
      const createFn = jest.fn().mockRejectedValue(error)

      ;(useApplicationStore as jest.Mock).mockReturnValue({
        collections: [],
        collectionsLoading: false,
        fetchCollections: jest.fn(),
        createNewCollection: createFn,
      })

      const { result } = renderHook(() => useCollections())

      await expect(
        act(async () => {
          await result.current.createNewCollection('New Collection')
        })
      ).rejects.toThrow('Create failed')
    })

    it('should handle creating collection with special characters', async () => {
      const newCollection = createMockCollection({
        name: SPECIAL_COLLECTION_NAME,
      })
      const createFn = jest.fn().mockResolvedValue(newCollection)

      ;(useApplicationStore as jest.Mock).mockReturnValue({
        collections: [],
        collectionsLoading: false,
        fetchCollections: jest.fn(),
        createNewCollection: createFn,
      })

      const { result } = renderHook(() => useCollections())

      await act(async () => {
        await result.current.createNewCollection(SPECIAL_COLLECTION_NAME)
      })

      expect(createFn).toHaveBeenCalledWith(SPECIAL_COLLECTION_NAME)
    })

    it('should handle creating collection with empty name', async () => {
      const createFn = jest.fn()

      ;(useApplicationStore as jest.Mock).mockReturnValue({
        collections: [],
        collectionsLoading: false,
        fetchCollections: jest.fn(),
        createNewCollection: createFn,
      })

      const { result } = renderHook(() => useCollections())

      await act(async () => {
        await result.current.createNewCollection('')
      })

      expect(createFn).toHaveBeenCalledWith('')
    })
  })

  describe('hook integration', () => {
    it('should provide all expected properties', () => {
      ;(useApplicationStore as jest.Mock).mockReturnValue({
        collections: [],
        collectionsLoading: false,
        fetchCollections: jest.fn(),
        createNewCollection: jest.fn(),
      })

      const { result } = renderHook(() => useCollections())

      expect(result.current).toHaveProperty('collections')
      expect(result.current).toHaveProperty('collectionsLoading')
      expect(result.current).toHaveProperty('fetchCollections')
      expect(result.current).toHaveProperty('createNewCollection')
    })

    it('should maintain referential stability for functions', () => {
      const fetchFn = jest.fn()
      const createFn = jest.fn()

      ;(useApplicationStore as jest.Mock).mockReturnValue({
        collections: [],
        collectionsLoading: false,
        fetchCollections: fetchFn,
        createNewCollection: createFn,
      })

      const { result: result1 } = renderHook(() => useCollections())
      const { result: result2 } = renderHook(() => useCollections())

      expect(result1.current.fetchCollections).toBe(fetchFn)
      expect(result2.current.fetchCollections).toBe(fetchFn)
    })

    it('should work with multiple concurrent calls', async () => {
      const fetchFn = jest.fn().mockResolvedValue(undefined)
      const createFn = jest.fn().mockResolvedValue(createMockCollection())

      ;(useApplicationStore as jest.Mock).mockReturnValue({
        collections: [],
        collectionsLoading: false,
        fetchCollections: fetchFn,
        createNewCollection: createFn,
      })

      const { result } = renderHook(() => useCollections())

      await act(async () => {
        await Promise.all([
          result.current.fetchCollections(),
          result.current.createNewCollection('Collection 1'),
          result.current.createNewCollection('Collection 2'),
        ])
      })

      expect(fetchFn).toHaveBeenCalledTimes(1)
      expect(createFn).toHaveBeenCalledTimes(2)
    })
  })

  describe('store integration', () => {
    it('should directly return store values', () => {
      const storeData = {
        collections: [createMockCollection({ name: 'Verbs' })],
        collectionsLoading: true,
        fetchCollections: jest.fn(),
        createNewCollection: jest.fn(),
      }

      ;(useApplicationStore as jest.Mock).mockReturnValue(storeData)

      const { result } = renderHook(() => useCollections())

      expect(result.current.collections).toBe(storeData.collections)
      expect(result.current.collectionsLoading).toBe(
        storeData.collectionsLoading
      )
      expect(result.current.fetchCollections).toBe(storeData.fetchCollections)
      expect(result.current.createNewCollection).toBe(
        storeData.createNewCollection
      )
    })

    it('should use correct store selector', () => {
      const storeData = {
        collections: [createMockCollection()],
        collectionsLoading: false,
        fetchCollections: jest.fn(),
        createNewCollection: jest.fn(),
      }

      ;(useApplicationStore as jest.Mock).mockReturnValue(storeData)

      renderHook(() => useCollections())

      expect(useApplicationStore).toHaveBeenCalled()
    })
  })

  describe('type safety', () => {
    it('should return correct types for all properties', () => {
      const mockCollections = [createMockCollection()]

      ;(useApplicationStore as jest.Mock).mockReturnValue({
        collections: mockCollections,
        collectionsLoading: false,
        fetchCollections: jest.fn(),
        createNewCollection: jest.fn(),
      })

      const { result } = renderHook(() => useCollections())

      expect(Array.isArray(result.current.collections)).toBe(true)
      expect(typeof result.current.collectionsLoading).toBe('boolean')
      expect(typeof result.current.fetchCollections).toBe('function')
      expect(typeof result.current.createNewCollection).toBe('function')
    })
  })

  describe('edge cases', () => {
    it('should handle undefined collections gracefully', () => {
      ;(useApplicationStore as jest.Mock).mockReturnValue({
        collections: undefined as any,
        collectionsLoading: false,
        fetchCollections: jest.fn(),
        createNewCollection: jest.fn(),
      })

      const { result } = renderHook(() => useCollections())

      expect(result.current.collections).toBeUndefined()
    })

    it('should handle large collections list', () => {
      const largeCollectionsList = Array.from({ length: 100 }, (_, i) =>
        createMockCollection({
          collection_id: `coll-${i}`,
          name: `Collection ${i}`,
        })
      )

      ;(useApplicationStore as jest.Mock).mockReturnValue({
        collections: largeCollectionsList,
        collectionsLoading: false,
        fetchCollections: jest.fn(),
        createNewCollection: jest.fn(),
      })

      const { result } = renderHook(() => useCollections())

      expect(result.current.collections.length).toBe(100)
    })

    it('should handle collections with all optional fields', () => {
      const mockCollections = [
        createMockCollection({
          description: null,
          icon: null,
          color: '#000000',
        }),
      ]

      ;(useApplicationStore as jest.Mock).mockReturnValue({
        collections: mockCollections,
        collectionsLoading: false,
        fetchCollections: jest.fn(),
        createNewCollection: jest.fn(),
      })

      const { result } = renderHook(() => useCollections())

      expect(result.current.collections[0].description).toBeNull()
    })
  })
})

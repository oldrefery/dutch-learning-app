/**
 * Unit tests for useLocalProgress hook
 * Tests progress tracking and updates
 */

import { renderHook, act, waitFor } from '@testing-library/react-native'
import { useLocalProgress } from '../useLocalProgress'
import { progressRepository } from '@/db/progressRepository'
import { useApplicationStore } from '@/stores/useApplicationStore'
import type { UserProgress } from '@/db/progressRepository'

jest.mock('@/db/progressRepository')
jest.mock('@/stores/useApplicationStore')
jest.mock('@/lib/supabaseClient')

describe('useLocalProgress', () => {
  // Helper functions to generate random test data
  const generateId = (prefix: string) =>
    `${prefix}_${Math.random().toString(36).substring(2, 9)}`

  const USER_ID = generateId('user')
  const WORD_ID = generateId('word')
  const PROGRESS_ID = generateId('progress')

  // Helper to create mock progress
  const createMockProgress = (
    overrides: Partial<UserProgress> = {}
  ): UserProgress => ({
    progress_id: generateId('progress'),
    user_id: USER_ID,
    word_id: generateId('word'),
    last_reviewed_at: new Date().toISOString(),
    interval_days: 1,
    repetition_count: 0,
    easiness_factor: 2.5,
    next_review_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    sync_status: 'synced',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  })

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useApplicationStore as jest.Mock).mockReturnValue({
      currentUserId: USER_ID,
    })
  })

  describe('fetchProgress', () => {
    it('should fetch progress by user ID', async () => {
      const mockProgress = [
        createMockProgress({ progress_id: 'progress-1' }),
        createMockProgress({ progress_id: 'progress-2' }),
      ]
      ;(progressRepository.getProgressByUserId as jest.Mock).mockResolvedValue(
        mockProgress
      )

      const { result } = renderHook(() => useLocalProgress())

      await act(async () => {
        await result.current.fetchProgress()
      })

      expect(result.current.progress).toEqual(mockProgress)
      expect(progressRepository.getProgressByUserId).toHaveBeenCalledWith(
        USER_ID
      )
    })

    it('should set isLoading during fetch', async () => {
      ;(progressRepository.getProgressByUserId as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve([]), 100))
      )

      const { result } = renderHook(() => useLocalProgress())

      act(() => {
        result.current.fetchProgress()
      })

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('should handle fetch errors gracefully', async () => {
      const error = new Error('Fetch failed')
      ;(progressRepository.getProgressByUserId as jest.Mock).mockRejectedValue(
        error
      )

      const { result } = renderHook(() => useLocalProgress())

      await act(async () => {
        await result.current.fetchProgress()
      })

      expect(result.current.progress).toEqual([])
      expect(result.current.isLoading).toBe(false)
    })

    it('should skip fetch if no user ID', async () => {
      ;(useApplicationStore as jest.Mock).mockReturnValue({
        currentUserId: null,
      })

      const { result } = renderHook(() => useLocalProgress())

      await act(async () => {
        await result.current.fetchProgress()
      })

      expect(progressRepository.getProgressByUserId).not.toHaveBeenCalled()
    })

    it('should auto-fetch on mount when user ID exists', async () => {
      const mockProgress = [createMockProgress()]
      ;(progressRepository.getProgressByUserId as jest.Mock).mockResolvedValue(
        mockProgress
      )

      const { result } = renderHook(() => useLocalProgress())

      await waitFor(() => {
        expect(result.current.progress).toEqual(mockProgress)
      })
    })

    it('should not auto-fetch on mount when user ID is null', async () => {
      ;(useApplicationStore as jest.Mock).mockReturnValue({
        currentUserId: null,
      })

      renderHook(() => useLocalProgress())

      await waitFor(() => {
        expect(progressRepository.getProgressByUserId).not.toHaveBeenCalled()
      })
    })
  })

  describe('getProgressForWord', () => {
    it('should get progress for specific word', async () => {
      const mockProgress = [
        createMockProgress({ word_id: WORD_ID, progress_id: 'progress-1' }),
        createMockProgress({ word_id: WORD_ID, progress_id: 'progress-2' }),
      ]
      ;(progressRepository.getProgressByWordId as jest.Mock).mockResolvedValue(
        mockProgress
      )

      const { result } = renderHook(() => useLocalProgress())

      let fetchedProgress: UserProgress[] = []
      await act(async () => {
        fetchedProgress = await result.current.getProgressForWord(WORD_ID)
      })

      expect(fetchedProgress).toEqual(mockProgress)
      expect(progressRepository.getProgressByWordId).toHaveBeenCalledWith(
        WORD_ID
      )
    })

    it('should return empty array if no progress found', async () => {
      ;(progressRepository.getProgressByWordId as jest.Mock).mockResolvedValue(
        []
      )

      const { result } = renderHook(() => useLocalProgress())

      let fetchedProgress: UserProgress[] = []
      await act(async () => {
        fetchedProgress = await result.current.getProgressForWord(WORD_ID)
      })

      expect(fetchedProgress).toEqual([])
    })

    it('should handle get progress errors', async () => {
      const error = new Error('Get progress failed')
      ;(progressRepository.getProgressByWordId as jest.Mock).mockRejectedValue(
        error
      )

      const { result } = renderHook(() => useLocalProgress())

      let fetchedProgress: UserProgress[] = [createMockProgress()]
      await act(async () => {
        fetchedProgress = await result.current.getProgressForWord(WORD_ID)
      })

      expect(fetchedProgress).toEqual([])
    })

    it('should work without user context', async () => {
      const mockProgress = [createMockProgress()]
      ;(progressRepository.getProgressByWordId as jest.Mock).mockResolvedValue(
        mockProgress
      )

      const { result } = renderHook(() => useLocalProgress())

      let fetchedProgress: UserProgress[] = []
      await act(async () => {
        fetchedProgress = await result.current.getProgressForWord(WORD_ID)
      })

      expect(fetchedProgress).toEqual(mockProgress)
    })
  })

  describe('updateProgress', () => {
    it('should update progress and refresh state', async () => {
      const mockProgress = [
        createMockProgress({ repetition_count: 1, interval_days: 3 }),
      ]
      ;(progressRepository.getProgressByUserId as jest.Mock).mockResolvedValue(
        mockProgress
      )
      ;(progressRepository.updateProgress as jest.Mock).mockResolvedValue(
        undefined
      )

      const { result } = renderHook(() => useLocalProgress())

      const updates = { repetition_count: 1, interval_days: 3 }

      await act(async () => {
        await result.current.updateProgress(PROGRESS_ID, updates)
      })

      expect(progressRepository.updateProgress).toHaveBeenCalledWith(
        PROGRESS_ID,
        USER_ID,
        updates
      )
      expect(progressRepository.getProgressByUserId).toHaveBeenCalled()
    })

    it('should not update if no user ID', async () => {
      ;(useApplicationStore as jest.Mock).mockReturnValue({
        currentUserId: null,
      })

      const { result } = renderHook(() => useLocalProgress())

      const updates = { repetition_count: 1 }

      await act(async () => {
        await result.current.updateProgress(PROGRESS_ID, updates)
      })

      expect(progressRepository.updateProgress).not.toHaveBeenCalled()
    })

    it('should throw error on update failure', async () => {
      const updateError = new Error('Update failed')
      ;(progressRepository.updateProgress as jest.Mock).mockRejectedValue(
        updateError
      )

      const { result } = renderHook(() => useLocalProgress())

      const updates = { repetition_count: 1 }

      await expect(
        act(async () => {
          await result.current.updateProgress(PROGRESS_ID, updates)
        })
      ).rejects.toThrow('Update failed')
    })

    it('should handle partial updates', async () => {
      const mockProgress = [createMockProgress()]
      ;(progressRepository.getProgressByUserId as jest.Mock).mockResolvedValue(
        mockProgress
      )
      ;(progressRepository.updateProgress as jest.Mock).mockResolvedValue(
        undefined
      )

      const { result } = renderHook(() => useLocalProgress())

      // Only update some fields
      const partialUpdates = { repetition_count: 2 }

      await act(async () => {
        await result.current.updateProgress(PROGRESS_ID, partialUpdates)
      })

      expect(progressRepository.updateProgress).toHaveBeenCalledWith(
        PROGRESS_ID,
        USER_ID,
        partialUpdates
      )
    })

    it('should handle multiple sequential updates', async () => {
      const mockProgress = [createMockProgress()]
      ;(progressRepository.getProgressByUserId as jest.Mock).mockResolvedValue(
        mockProgress
      )
      ;(progressRepository.updateProgress as jest.Mock).mockResolvedValue(
        undefined
      )

      const { result } = renderHook(() => useLocalProgress())

      const updates = [
        { repetition_count: 1 },
        { repetition_count: 2 },
        { repetition_count: 3 },
      ]

      for (const update of updates) {
        await act(async () => {
          await result.current.updateProgress(PROGRESS_ID, update)
        })
      }

      expect(progressRepository.updateProgress).toHaveBeenCalledTimes(3)
    })

    it('should handle update with multiple fields', async () => {
      const mockProgress = [createMockProgress()]
      ;(progressRepository.getProgressByUserId as jest.Mock).mockResolvedValue(
        mockProgress
      )
      ;(progressRepository.updateProgress as jest.Mock).mockResolvedValue(
        undefined
      )

      const { result } = renderHook(() => useLocalProgress())

      const multiFieldUpdate = {
        repetition_count: 2,
        interval_days: 3,
        easiness_factor: 2.8,
      }

      await act(async () => {
        await result.current.updateProgress(PROGRESS_ID, multiFieldUpdate)
      })

      expect(progressRepository.updateProgress).toHaveBeenCalledWith(
        PROGRESS_ID,
        USER_ID,
        multiFieldUpdate
      )
    })
  })

  describe('hook integration', () => {
    it('should provide all expected methods', async () => {
      ;(progressRepository.getProgressByUserId as jest.Mock).mockResolvedValue(
        []
      )

      const { result } = renderHook(() => useLocalProgress())

      expect(result.current).toHaveProperty('progress')
      expect(result.current).toHaveProperty('isLoading')
      expect(result.current).toHaveProperty('fetchProgress')
      expect(result.current).toHaveProperty('getProgressForWord')
      expect(result.current).toHaveProperty('updateProgress')
    })

    it('should initialize with empty progress and false loading', async () => {
      ;(progressRepository.getProgressByUserId as jest.Mock).mockResolvedValue(
        []
      )

      const { result } = renderHook(() => useLocalProgress())

      expect(Array.isArray(result.current.progress)).toBe(true)
      expect(typeof result.current.isLoading).toBe('boolean')
    })

    it('should handle refetch after manual update', async () => {
      const initialProgress = [createMockProgress({ repetition_count: 0 })]
      const updatedProgress = [createMockProgress({ repetition_count: 1 })]

      ;(
        progressRepository.getProgressByUserId as jest.Mock
      ).mockResolvedValueOnce(initialProgress)
      ;(progressRepository.updateProgress as jest.Mock).mockResolvedValue(
        undefined
      )
      ;(
        progressRepository.getProgressByUserId as jest.Mock
      ).mockResolvedValueOnce(updatedProgress)

      const { result } = renderHook(() => useLocalProgress())

      await waitFor(() => {
        expect(result.current.progress).toEqual(initialProgress)
      })

      await act(async () => {
        await result.current.updateProgress(PROGRESS_ID, {
          repetition_count: 1,
        })
      })

      await waitFor(() => {
        expect(result.current.progress).toEqual(updatedProgress)
      })
    })
  })

  describe('edge cases', () => {
    it('should handle empty progress list', async () => {
      ;(progressRepository.getProgressByUserId as jest.Mock).mockResolvedValue(
        []
      )

      const { result } = renderHook(() => useLocalProgress())

      await waitFor(() => {
        expect(result.current.progress).toEqual([])
      })
    })

    it('should maintain progress state after failed update', async () => {
      const mockProgress = [createMockProgress()]
      ;(progressRepository.getProgressByUserId as jest.Mock).mockResolvedValue(
        mockProgress
      )
      ;(progressRepository.updateProgress as jest.Mock).mockRejectedValueOnce(
        new Error('Update failed')
      )

      const { result } = renderHook(() => useLocalProgress())

      await waitFor(() => {
        expect(result.current.progress).toEqual(mockProgress)
      })

      try {
        await act(async () => {
          await result.current.updateProgress(PROGRESS_ID, {
            repetition_count: 1,
          })
        })
      } catch {
        // Expected error
      }

      expect(result.current.progress).toEqual(mockProgress)
    })

    it('should handle progress data with various sync statuses', async () => {
      const mockProgress = [
        createMockProgress({ sync_status: 'synced' }),
        createMockProgress({ sync_status: 'pending' }),
        createMockProgress({ sync_status: 'failed' }),
      ]
      ;(progressRepository.getProgressByUserId as jest.Mock).mockResolvedValue(
        mockProgress
      )

      const { result } = renderHook(() => useLocalProgress())

      await waitFor(() => {
        expect(result.current.progress.length).toBe(3)
      })
    })

    it('should handle progress with null last_reviewed_at', async () => {
      const mockProgress = [
        createMockProgress({ last_reviewed_at: null as any }),
      ]
      ;(progressRepository.getProgressByUserId as jest.Mock).mockResolvedValue(
        mockProgress
      )

      const { result } = renderHook(() => useLocalProgress())

      await waitFor(() => {
        expect(result.current.progress.length).toBeGreaterThan(0)
      })
    })
  })
})

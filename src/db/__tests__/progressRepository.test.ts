/**
 * Tests for ProgressRepository
 *
 * SQLite repository for user review progress tracking with sync status.
 * Uses prepared statements with try/finally cleanup pattern.
 */

import { progressRepository } from '../progressRepository'
import * as initDB from '../initDB'
import { createMockProgress } from '@/__tests__/helpers/factories'

jest.mock('../initDB')

describe('ProgressRepository', () => {
  const USER_ID = 'test-user-id'
  const PROGRESS_ID = 'prog-123'
  const WORD_ID = 'word-456'

  const mockExecuteAsync = jest.fn()
  const mockFinalizeAsync = jest.fn()
  const mockStatement = {
    executeAsync: mockExecuteAsync,
    finalizeAsync: mockFinalizeAsync,
  }

  const mockDatabase = {
    prepareAsync: jest.fn().mockResolvedValue(mockStatement),
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockExecuteAsync.mockResolvedValue(undefined)
    mockFinalizeAsync.mockResolvedValue(undefined)
    mockDatabase.prepareAsync.mockResolvedValue(mockStatement)
    mockDatabase.getAllAsync.mockResolvedValue([])
    mockDatabase.getFirstAsync.mockResolvedValue(null)
    ;(initDB.getDatabase as jest.Mock).mockResolvedValue(mockDatabase)
  })

  describe('saveProgress', () => {
    it('should save progress records using prepared statement', async () => {
      const record = createMockProgress({
        progress_id: PROGRESS_ID,
        user_id: USER_ID,
        word_id: WORD_ID,
      })
      const { sync_status: _sync_status, ...recordWithoutSync } = record

      await progressRepository.saveProgress([recordWithoutSync])

      expect(mockDatabase.prepareAsync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT OR REPLACE INTO user_progress')
      )
      expect(mockExecuteAsync).toHaveBeenCalledTimes(1)
    })

    it('should call finalizeAsync after success', async () => {
      const record = createMockProgress()
      const { sync_status: _sync_status, ...recordWithoutSync } = record

      await progressRepository.saveProgress([recordWithoutSync])

      expect(mockFinalizeAsync).toHaveBeenCalledTimes(1)
    })

    it('should call finalizeAsync even on error', async () => {
      mockExecuteAsync.mockRejectedValue(new Error('Execute failed'))
      const record = createMockProgress()
      const { sync_status: _sync_status, ...recordWithoutSync } = record

      await expect(
        progressRepository.saveProgress([recordWithoutSync])
      ).rejects.toThrow('Execute failed')

      expect(mockFinalizeAsync).toHaveBeenCalledTimes(1)
    })
  })

  describe('updateProgress', () => {
    it('should update status field', async () => {
      await progressRepository.updateProgress(PROGRESS_ID, USER_ID, {
        status: 'mastered',
      })

      expect(mockDatabase.prepareAsync).toHaveBeenCalledWith(
        expect.stringContaining('status = ?')
      )
      expect(mockExecuteAsync).toHaveBeenCalled()
    })

    it('should update reviewed_count field', async () => {
      await progressRepository.updateProgress(PROGRESS_ID, USER_ID, {
        reviewed_count: 5,
      })

      expect(mockDatabase.prepareAsync).toHaveBeenCalledWith(
        expect.stringContaining('reviewed_count = ?')
      )
    })

    it('should update last_reviewed_at field', async () => {
      const timestamp = '2025-10-01T00:00:00Z'
      await progressRepository.updateProgress(PROGRESS_ID, USER_ID, {
        last_reviewed_at: timestamp,
      })

      expect(mockDatabase.prepareAsync).toHaveBeenCalledWith(
        expect.stringContaining('last_reviewed_at = ?')
      )
    })

    it('should no-op when no fields to update', async () => {
      await progressRepository.updateProgress(PROGRESS_ID, USER_ID, {})

      expect(mockDatabase.prepareAsync).not.toHaveBeenCalled()
    })

    it('should set sync_status to pending', async () => {
      await progressRepository.updateProgress(PROGRESS_ID, USER_ID, {
        status: 'learning',
      })

      expect(mockDatabase.prepareAsync).toHaveBeenCalledWith(
        expect.stringContaining('sync_status = ?')
      )
    })

    it('should always call finalizeAsync', async () => {
      await progressRepository.updateProgress(PROGRESS_ID, USER_ID, {
        status: 'mastered',
      })

      expect(mockFinalizeAsync).toHaveBeenCalled()
    })
  })

  describe('getProgressByUserId', () => {
    it('should return parsed progress records', async () => {
      const rawRow = {
        progress_id: PROGRESS_ID,
        user_id: USER_ID,
        word_id: WORD_ID,
        status: 'learning',
        reviewed_count: 3,
        last_reviewed_at: '2025-10-01T00:00:00Z',
        created_at: '2025-09-01T00:00:00Z',
        updated_at: '2025-10-01T00:00:00Z',
        sync_status: 'synced',
      }
      mockDatabase.getAllAsync.mockResolvedValue([rawRow])

      const result = await progressRepository.getProgressByUserId(USER_ID)

      expect(result).toHaveLength(1)
      expect(result[0].progress_id).toBe(PROGRESS_ID)
      expect(result[0].reviewed_count).toBe(3)
    })

    it('should return empty array when no records', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([])

      const result = await progressRepository.getProgressByUserId(USER_ID)

      expect(result).toEqual([])
    })
  })

  describe('getProgressByWordId', () => {
    it('should return progress for a specific word', async () => {
      const rawRow = {
        progress_id: PROGRESS_ID,
        user_id: USER_ID,
        word_id: WORD_ID,
        status: 'learning',
        reviewed_count: 1,
        last_reviewed_at: null,
        created_at: '2025-09-01T00:00:00Z',
        updated_at: '2025-09-01T00:00:00Z',
        sync_status: 'synced',
      }
      mockDatabase.getAllAsync.mockResolvedValue([rawRow])

      const result = await progressRepository.getProgressByWordId(WORD_ID)

      expect(result).toHaveLength(1)
      expect(result[0].word_id).toBe(WORD_ID)
    })
  })

  describe('getProgressByIdAndUserId', () => {
    it('should return single progress record', async () => {
      const rawRow = {
        progress_id: PROGRESS_ID,
        user_id: USER_ID,
        word_id: WORD_ID,
        status: 'learning',
        reviewed_count: 2,
        last_reviewed_at: null,
        created_at: '2025-09-01T00:00:00Z',
        updated_at: '2025-09-01T00:00:00Z',
        sync_status: 'synced',
      }
      mockDatabase.getFirstAsync.mockResolvedValue(rawRow)

      const result = await progressRepository.getProgressByIdAndUserId(
        PROGRESS_ID,
        USER_ID
      )

      expect(result).not.toBeNull()
      expect(result!.progress_id).toBe(PROGRESS_ID)
    })

    it('should return null when not found', async () => {
      mockDatabase.getFirstAsync.mockResolvedValue(null)

      const result = await progressRepository.getProgressByIdAndUserId(
        PROGRESS_ID,
        USER_ID
      )

      expect(result).toBeNull()
    })
  })

  describe('getPendingSyncProgress', () => {
    it('should return only pending records', async () => {
      mockDatabase.getAllAsync.mockResolvedValue([])

      await progressRepository.getPendingSyncProgress(USER_ID)

      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining("sync_status = 'pending'"),
        [USER_ID]
      )
    })
  })

  describe('getUpdatedSince', () => {
    it('should return records updated after timestamp', async () => {
      const timestamp = '2025-09-15T00:00:00Z'
      mockDatabase.getAllAsync.mockResolvedValue([])

      await progressRepository.getUpdatedSince(timestamp, USER_ID)

      expect(mockDatabase.getAllAsync).toHaveBeenCalledWith(
        expect.stringContaining('updated_at > ?'),
        [USER_ID, timestamp]
      )
    })
  })

  describe('markProgressSynced', () => {
    it('should update sync_status to synced for given IDs', async () => {
      await progressRepository.markProgressSynced(['prog-1', 'prog-2'])

      expect(mockDatabase.prepareAsync).toHaveBeenCalledWith(
        expect.stringContaining("sync_status = 'synced'")
      )
      expect(mockExecuteAsync).toHaveBeenCalled()
      expect(mockFinalizeAsync).toHaveBeenCalled()
    })

    it('should no-op for empty array', async () => {
      await progressRepository.markProgressSynced([])

      expect(mockDatabase.prepareAsync).not.toHaveBeenCalled()
    })
  })

  describe('deleteProgress', () => {
    it('should delete by progressId and userId', async () => {
      await progressRepository.deleteProgress(PROGRESS_ID, USER_ID)

      expect(mockDatabase.prepareAsync).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM user_progress')
      )
      expect(mockExecuteAsync).toHaveBeenCalledWith(PROGRESS_ID, USER_ID)
      expect(mockFinalizeAsync).toHaveBeenCalled()
    })
  })
})

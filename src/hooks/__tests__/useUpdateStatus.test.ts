/**
 * Tests for useUpdateStatus hook
 *
 * Manages EAS Update checking and downloading.
 * Provides status, checkForUpdate, and downloadAndApplyUpdate.
 */

import { renderHook, act } from '@testing-library/react-native'
import * as Updates from 'expo-updates'
import { useUpdateStatus } from '../useUpdateStatus'

jest.mock('expo-updates', () => ({
  isEnabled: true,
  updateId: 'update-123',
  channel: 'production',
  runtimeVersion: '1.0.0',
  createdAt: new Date('2025-01-01'),
  manifest: null,
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}))

describe('useUpdateStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(Updates as Record<string, unknown>).isEnabled = true
  })

  describe('initial state', () => {
    it('should reflect Updates constants in initial status', () => {
      const { result } = renderHook(() => useUpdateStatus())

      expect(result.current.status.isEnabled).toBe(true)
      expect(result.current.status.currentUpdateId).toBe('update-123')
      expect(result.current.status.channel).toBe('production')
      expect(result.current.status.runtimeVersion).toBe('1.0.0')
      expect(result.current.status.isChecking).toBe(false)
      expect(result.current.status.isDownloading).toBe(false)
      expect(result.current.status.updateAvailable).toBe(false)
      expect(result.current.status.error).toBeNull()
    })
  })

  describe('checkForUpdate', () => {
    it('should return true when update is available', async () => {
      ;(Updates.checkForUpdateAsync as jest.Mock).mockResolvedValue({
        isAvailable: true,
      })

      const { result } = renderHook(() => useUpdateStatus())
      let isAvailable: boolean | undefined

      await act(async () => {
        isAvailable = await result.current.checkForUpdate()
      })

      expect(isAvailable).toBe(true)
      expect(result.current.status.updateAvailable).toBe(true)
      expect(result.current.status.isChecking).toBe(false)
      expect(result.current.status.lastCheckTime).toBeInstanceOf(Date)
    })

    it('should return false when no update available', async () => {
      ;(Updates.checkForUpdateAsync as jest.Mock).mockResolvedValue({
        isAvailable: false,
      })

      const { result } = renderHook(() => useUpdateStatus())
      let isAvailable: boolean | undefined

      await act(async () => {
        isAvailable = await result.current.checkForUpdate()
      })

      expect(isAvailable).toBe(false)
      expect(result.current.status.updateAvailable).toBe(false)
    })

    it('should return false and set error on failure', async () => {
      ;(Updates.checkForUpdateAsync as jest.Mock).mockRejectedValue(
        new Error('Network error')
      )

      const { result } = renderHook(() => useUpdateStatus())
      let isAvailable: boolean | undefined

      await act(async () => {
        isAvailable = await result.current.checkForUpdate()
      })

      expect(isAvailable).toBe(false)
      expect(result.current.status.error).toBe('Network error')
      expect(result.current.status.isChecking).toBe(false)
    })

    it('should set generic error message for non-Error exceptions', async () => {
      ;(Updates.checkForUpdateAsync as jest.Mock).mockRejectedValue(
        'string error'
      )

      const { result } = renderHook(() => useUpdateStatus())

      await act(async () => {
        await result.current.checkForUpdate()
      })

      expect(result.current.status.error).toBe('Check failed')
    })

    it('should no-op when updates are disabled', async () => {
      ;(Updates as Record<string, unknown>).isEnabled = false

      const { result } = renderHook(() => useUpdateStatus())

      await act(async () => {
        await result.current.checkForUpdate()
      })

      expect(Updates.checkForUpdateAsync).not.toHaveBeenCalled()
    })
  })

  describe('downloadAndApplyUpdate', () => {
    it('should download and reload when update is new', async () => {
      ;(Updates.fetchUpdateAsync as jest.Mock).mockResolvedValue({
        isNew: true,
      })

      const { result } = renderHook(() => useUpdateStatus())
      let applied: boolean | undefined

      await act(async () => {
        applied = await result.current.downloadAndApplyUpdate()
      })

      expect(applied).toBe(true)
      expect(Updates.reloadAsync).toHaveBeenCalled()
    })

    it('should return false when fetched update is not new', async () => {
      ;(Updates.fetchUpdateAsync as jest.Mock).mockResolvedValue({
        isNew: false,
      })

      const { result } = renderHook(() => useUpdateStatus())
      let applied: boolean | undefined

      await act(async () => {
        applied = await result.current.downloadAndApplyUpdate()
      })

      expect(applied).toBe(false)
      expect(Updates.reloadAsync).not.toHaveBeenCalled()
      expect(result.current.status.isDownloading).toBe(false)
    })

    it('should return false and set error on failure', async () => {
      ;(Updates.fetchUpdateAsync as jest.Mock).mockRejectedValue(
        new Error('Download error')
      )

      const { result } = renderHook(() => useUpdateStatus())
      let applied: boolean | undefined

      await act(async () => {
        applied = await result.current.downloadAndApplyUpdate()
      })

      expect(applied).toBe(false)
      expect(result.current.status.error).toBe('Download error')
      expect(result.current.status.isDownloading).toBe(false)
    })

    it('should no-op when updates are disabled', async () => {
      ;(Updates as Record<string, unknown>).isEnabled = false

      const { result } = renderHook(() => useUpdateStatus())
      let applied: boolean | undefined

      await act(async () => {
        applied = await result.current.downloadAndApplyUpdate()
      })

      expect(applied).toBe(false)
      expect(Updates.fetchUpdateAsync).not.toHaveBeenCalled()
    })
  })
})

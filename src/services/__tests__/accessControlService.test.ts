/**
 * Tests for accessControlService
 *
 * Service for managing user access levels (full_access / read_only).
 * Uses Supabase for data, Sentry for error tracking, and a Result type
 * for explicit success/failure handling.
 */

import {
  accessControlService,
  AccessControlError,
} from '../accessControlService'
import { supabase } from '@/lib/supabase'
import { Sentry } from '@/lib/sentry'
import { logSupabaseError } from '@/utils/logger'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}))

jest.mock('@/lib/sentry', () => ({
  Sentry: {
    captureException: jest.fn(),
    addBreadcrumb: jest.fn(),
  },
}))

jest.mock('@/utils/logger', () => ({
  logSupabaseError: jest.fn(),
}))

const TEST_USER_ID = 'test-user-123'

describe('accessControlService', () => {
  // Supabase chain mock helpers
  let mockMaybeSingle: jest.Mock
  let mockEq: jest.Mock
  let mockSelect: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()

    mockMaybeSingle = jest.fn()
    mockEq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle })
    mockSelect = jest.fn().mockReturnValue({ eq: mockEq })
    ;(supabase.from as jest.Mock).mockReturnValue({ select: mockSelect })
  })

  describe('getUserAccessLevel', () => {
    it('should return full_access when user has full access', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { access_level: 'full_access' },
        error: null,
      })

      const result = await accessControlService.getUserAccessLevel(TEST_USER_ID)

      expect(result).toEqual({ success: true, data: 'full_access' })
      expect(supabase.from).toHaveBeenCalledWith('user_access_levels')
      expect(mockSelect).toHaveBeenCalledWith('access_level')
      expect(mockEq).toHaveBeenCalledWith('user_id', TEST_USER_ID)
    })

    it('should return read_only when user has read-only access', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { access_level: 'read_only' },
        error: null,
      })

      const result = await accessControlService.getUserAccessLevel(TEST_USER_ID)

      expect(result).toEqual({ success: true, data: 'read_only' })
    })

    it('should default to read_only when user not found', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: null,
      })

      const result = await accessControlService.getUserAccessLevel(TEST_USER_ID)

      expect(result).toEqual({ success: true, data: 'read_only' })
    })

    it('should add Sentry breadcrumb when user not found', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: null,
      })

      await accessControlService.getUserAccessLevel(TEST_USER_ID)

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'access_control',
          level: 'warning',
          data: { userId: TEST_USER_ID },
        })
      )
    })

    it('should return DATABASE_ERROR on Supabase error', async () => {
      const supabaseError = {
        message: 'Database error',
        code: '42P01',
        details: '',
        hint: '',
      }
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: supabaseError,
      })

      const result = await accessControlService.getUserAccessLevel(TEST_USER_ID)

      expect(result).toEqual({
        success: false,
        error: AccessControlError.DATABASE_ERROR,
      })
    })

    it('should call logSupabaseError on Supabase error', async () => {
      const supabaseError = {
        message: 'Database error',
        code: '42P01',
        details: '',
        hint: '',
      }
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: supabaseError,
      })

      await accessControlService.getUserAccessLevel(TEST_USER_ID)

      expect(logSupabaseError).toHaveBeenCalledWith(
        'Failed to fetch user access level',
        supabaseError,
        expect.objectContaining({
          operation: 'getUserAccessLevel',
          userId: TEST_USER_ID,
        })
      )
    })

    it('should return UNKNOWN_ERROR on unexpected exception', async () => {
      mockMaybeSingle.mockRejectedValue(new Error('Unexpected'))

      const result = await accessControlService.getUserAccessLevel(TEST_USER_ID)

      expect(result).toEqual({
        success: false,
        error: AccessControlError.UNKNOWN_ERROR,
      })
    })

    it('should capture Sentry exception on unexpected error', async () => {
      const unexpectedError = new Error('Unexpected')
      mockMaybeSingle.mockRejectedValue(unexpectedError)

      await accessControlService.getUserAccessLevel(TEST_USER_ID)

      expect(Sentry.captureException).toHaveBeenCalledWith(
        unexpectedError,
        expect.objectContaining({
          tags: { operation: 'getUserAccessLevel' },
          extra: { userId: TEST_USER_ID },
        })
      )
    })
  })

  describe('hasFullAccess', () => {
    it('should return true when access level is full_access', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { access_level: 'full_access' },
        error: null,
      })

      expect(await accessControlService.hasFullAccess(TEST_USER_ID)).toBe(true)
    })

    it('should return false when access level is read_only', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { access_level: 'read_only' },
        error: null,
      })

      expect(await accessControlService.hasFullAccess(TEST_USER_ID)).toBe(false)
    })

    it('should return false on error (fail-safe)', async () => {
      mockMaybeSingle.mockRejectedValue(new Error('Unexpected'))

      expect(await accessControlService.hasFullAccess(TEST_USER_ID)).toBe(false)
    })
  })

  describe('isReadOnly', () => {
    it('should return true when access level is read_only', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { access_level: 'read_only' },
        error: null,
      })

      expect(await accessControlService.isReadOnly(TEST_USER_ID)).toBe(true)
    })

    it('should return false when access level is full_access', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { access_level: 'full_access' },
        error: null,
      })

      expect(await accessControlService.isReadOnly(TEST_USER_ID)).toBe(false)
    })
  })

  describe('getUserAccessDetails', () => {
    const mockAccessDetails = {
      id: 'access-1',
      user_id: TEST_USER_ID,
      access_level: 'full_access',
      created_at: '2025-01-01T00:00:00Z',
      updated_at: null,
    }

    it('should return full user access record on success', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: mockAccessDetails,
        error: null,
      })

      const result =
        await accessControlService.getUserAccessDetails(TEST_USER_ID)

      expect(result).toEqual({ success: true, data: mockAccessDetails })
      expect(mockSelect).toHaveBeenCalledWith('*')
    })

    it('should return NOT_FOUND when user not in DB', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: null,
      })

      const result =
        await accessControlService.getUserAccessDetails(TEST_USER_ID)

      expect(result).toEqual({
        success: false,
        error: AccessControlError.NOT_FOUND,
      })
    })

    it('should return DATABASE_ERROR on Supabase error', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: { message: 'DB error', code: '500', details: '', hint: '' },
      })

      const result =
        await accessControlService.getUserAccessDetails(TEST_USER_ID)

      expect(result).toEqual({
        success: false,
        error: AccessControlError.DATABASE_ERROR,
      })
    })

    it('should return UNKNOWN_ERROR on unexpected exception', async () => {
      mockMaybeSingle.mockRejectedValue(new Error('Unexpected'))

      const result =
        await accessControlService.getUserAccessDetails(TEST_USER_ID)

      expect(result).toEqual({
        success: false,
        error: AccessControlError.UNKNOWN_ERROR,
      })
      expect(Sentry.captureException).toHaveBeenCalled()
    })
  })
})

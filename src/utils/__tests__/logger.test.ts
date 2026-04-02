/**
 * Tests for logger utility
 *
 * Centralized logging with Sentry breadcrumbs and error capturing.
 * Handles network error detection, Supabase error formatting,
 * and dev-only console output.
 */

import { Sentry } from '@/lib/sentry'
import {
  isNetworkError,
  logDebug,
  logInfo,
  logWarning,
  logError,
  logSupabaseError,
  logger,
} from '../logger'

jest.mock('@/lib/sentry', () => ({
  Sentry: {
    addBreadcrumb: jest.fn(),
    captureException: jest.fn(),
    captureMessage: jest.fn(),
  },
}))

describe('logger', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('isNetworkError', () => {
    it('should return true for "network request failed"', () => {
      expect(isNetworkError('network request failed')).toBe(true)
    })

    it('should return true for "Network error"', () => {
      expect(isNetworkError('Network error')).toBe(true)
    })

    it('should return true for "fetch failed"', () => {
      expect(isNetworkError('fetch failed')).toBe(true)
    })

    it('should return true for "timeout"', () => {
      expect(isNetworkError('Connection timeout')).toBe(true)
    })

    it('should return true for "ECONNREFUSED"', () => {
      expect(isNetworkError('ECONNREFUSED')).toBe(true)
    })

    it('should return true for "ENOTFOUND"', () => {
      expect(isNetworkError('ENOTFOUND')).toBe(true)
    })

    it('should return true for "ENETUNREACH"', () => {
      expect(isNetworkError('ENETUNREACH')).toBe(true)
    })

    it('should return false for "Database error"', () => {
      expect(isNetworkError('Database error')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(isNetworkError('')).toBe(false)
    })

    it('should be case insensitive', () => {
      expect(isNetworkError('NETWORK REQUEST FAILED')).toBe(true)
      expect(isNetworkError('Fetch Failed')).toBe(true)
    })
  })

  describe('logDebug', () => {
    it('should add Sentry breadcrumb with debug level', () => {
      logDebug('Debug message')

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'debug',
          message: 'Debug message',
        })
      )
    })

    it('should use default category "app" when not specified', () => {
      logDebug('Test')

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'app',
        })
      )
    })

    it('should use custom category when specified', () => {
      logDebug('Test', undefined, 'sync')

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'sync',
        })
      )
    })
  })

  describe('logInfo', () => {
    it('should add Sentry breadcrumb with info level', () => {
      logInfo('Info message', { key: 'value' })

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          message: 'Info message',
          data: { key: 'value' },
        })
      )
    })
  })

  describe('logWarning', () => {
    it('should add Sentry breadcrumb with warning level', () => {
      logWarning('Warning message')

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'warning',
          message: 'Warning message',
        })
      )
    })
  })

  describe('logError', () => {
    it('should add breadcrumb with error level', () => {
      logError('Error occurred')

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'error',
          message: 'Error occurred',
        })
      )
    })

    it('should capture Sentry exception when captureEvent is true', () => {
      const error = new Error('Critical failure')
      logError('Error', error, undefined, 'app', true)

      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          tags: { category: 'app' },
        })
      )
    })

    it('should NOT capture Sentry exception when captureEvent is false', () => {
      logError('Error', new Error('Non-critical'))

      expect(Sentry.captureException).not.toHaveBeenCalled()
    })

    it('should include error message in breadcrumb context', () => {
      const error = new Error('Something broke')
      logError('Error happened', error, { extra: 'data' })

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            error: 'Something broke',
            extra: 'data',
          }),
        })
      )
    })
  })

  describe('logSupabaseError', () => {
    const baseContext = { operation: 'fetchData', userId: 'user-1' }

    it('should add Sentry breadcrumb with supabase category', () => {
      const error = {
        name: 'PostgrestError',
        message: 'Table not found',
        code: '42P01',
        details: 'Some details',
        hint: 'Check table name',
      }

      logSupabaseError('Query failed', error, baseContext)

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'supabase',
          level: 'error',
        })
      )
    })

    it('should format error with message, code, details, and hint', () => {
      const error = {
        name: 'PostgrestError',
        message: 'Permission denied',
        code: '42501',
        details: 'Row level security',
        hint: 'Check RLS policies',
      }

      logSupabaseError('Access error', error, baseContext)

      const breadcrumbMessage = (Sentry.addBreadcrumb as jest.Mock).mock
        .calls[0][0].message
      expect(breadcrumbMessage).toContain('Permission denied')
      expect(breadcrumbMessage).toContain('42501')
      expect(breadcrumbMessage).toContain('Row level security')
      expect(breadcrumbMessage).toContain('Check RLS policies')
    })

    it('should capture as warning (captureMessage) for network errors', () => {
      const error = {
        name: 'PostgrestError',
        message: 'network request failed',
        code: '',
        details: '',
        hint: '',
      }

      logSupabaseError('Sync failed', error, baseContext)

      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        expect.stringContaining('Sync failed'),
        expect.objectContaining({
          level: 'warning',
          fingerprint: ['supabase-network-error', 'fetchData'],
        })
      )
      expect(Sentry.captureException).not.toHaveBeenCalled()
    })

    it('should capture as exception for non-network errors', () => {
      const error = {
        name: 'PostgrestError',
        message: 'Constraint violation',
        code: '23505',
        details: 'Duplicate key',
        hint: '',
      }

      logSupabaseError('Insert failed', error, baseContext)

      expect(Sentry.captureException).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          tags: expect.objectContaining({
            operation: 'fetchData',
            errorCode: '23505',
          }),
          fingerprint: ['supabase-error', 'fetchData', '23505'],
        })
      )
      expect(Sentry.captureMessage).not.toHaveBeenCalled()
    })

    it('should handle missing fields gracefully', () => {
      const error = {
        name: 'PostgrestError',
        message: '',
        code: '',
        details: '',
        hint: '',
      }

      expect(() => logSupabaseError('Error', error, baseContext)).not.toThrow()
    })
  })

  describe('logger object', () => {
    it('should have all expected methods', () => {
      expect(logger.debug).toBe(logDebug)
      expect(logger.info).toBe(logInfo)
      expect(logger.log).toBe(logInfo)
      expect(logger.warn).toBe(logWarning)
      expect(logger.error).toBe(logError)
      expect(logger.supabaseError).toBe(logSupabaseError)
    })
  })
})

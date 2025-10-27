/**
 * Unit tests for retryUtils
 * Tests retry logic, exponential backoff, and error handling
 */

import {
  isRetryableError,
  calculateBackoffDelay,
  delay,
  retryWithBackoff,
  DEFAULT_RETRY_CONFIG,
  type RetryConfig,
} from '../retryUtils'
import { NetworkError } from '@/types/ErrorTypes'

jest.mock('@sentry/react-native')
jest.mock('@/constants/AppConfig', () => ({
  API_CONFIG: {
    EDGE_FUNCTION_TIMEOUT_MS: 30000,
  },
}))

describe('retryUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  describe('isRetryableError', () => {
    describe('network errors', () => {
      it('should identify "network request failed" as retryable', () => {
        const error = new TypeError('Network request failed')
        expect(isRetryableError(error)).toBe(true)
      })

      it('should identify "network error" as retryable', () => {
        const error = new TypeError('Network error occurred')
        expect(isRetryableError(error)).toBe(true)
      })

      it('should identify "fetch failed" as retryable', () => {
        const error = new TypeError('Fetch failed to connect')
        expect(isRetryableError(error)).toBe(true)
      })

      it('should identify "failed to fetch" as retryable', () => {
        const error = new TypeError('Failed to fetch resource')
        expect(isRetryableError(error)).toBe(true)
      })

      it('should be case-insensitive for network errors', () => {
        const error = new TypeError('NETWORK REQUEST FAILED')
        expect(isRetryableError(error)).toBe(true)
      })
    })

    describe('timeout errors', () => {
      it('should identify "timeout" error as retryable', () => {
        const error = new Error('Request timeout')
        expect(isRetryableError(error)).toBe(true)
      })

      it('should identify "ECONNREFUSED" error as retryable', () => {
        const error = new Error('ECONNREFUSED: Connection refused')
        expect(isRetryableError(error)).toBe(true)
      })

      it('should identify "connection refused" as retryable', () => {
        const error = new Error('Connection refused')
        expect(isRetryableError(error)).toBe(true)
      })
    })

    describe('Supabase errors', () => {
      it('should identify FunctionsFetchError as retryable', () => {
        const error = new Error('Function execution failed')
        error.name = 'FunctionsFetchError'
        expect(isRetryableError(error)).toBe(true)
      })
    })

    describe('NetworkError type', () => {
      it('should identify NetworkError as retryable', () => {
        const error = new NetworkError('Network failed', 'Please try again')
        expect(isRetryableError(error)).toBe(true)
      })
    })

    describe('server errors', () => {
      it('should identify 503 status as retryable', () => {
        const error = { status: 503, message: 'Service Unavailable' }
        expect(isRetryableError(error)).toBe(true)
      })

      it('should identify 504 status as retryable', () => {
        const error = { status: 504, message: 'Gateway Timeout' }
        expect(isRetryableError(error)).toBe(true)
      })

      it('should not retry 400 status codes', () => {
        const error = { status: 400, message: 'Bad Request' }
        expect(isRetryableError(error)).toBe(false)
      })

      it('should not retry 401 status codes', () => {
        const error = { status: 401, message: 'Unauthorized' }
        expect(isRetryableError(error)).toBe(false)
      })

      it('should not retry 404 status codes', () => {
        const error = { status: 404, message: 'Not Found' }
        expect(isRetryableError(error)).toBe(false)
      })

      it('should not retry 500 status codes', () => {
        const error = { status: 500, message: 'Internal Server Error' }
        expect(isRetryableError(error)).toBe(false)
      })
    })

    describe('non-retryable errors', () => {
      it('should not retry generic Error', () => {
        const error = new Error('Some other error')
        expect(isRetryableError(error)).toBe(false)
      })

      it('should not retry unknown error types', () => {
        expect(isRetryableError('string error')).toBe(false)
      })

      it('should not retry null', () => {
        expect(isRetryableError(null)).toBe(false)
      })

      it('should not retry undefined', () => {
        expect(isRetryableError(undefined)).toBe(false)
      })
    })
  })

  describe('calculateBackoffDelay', () => {
    it('should return initial delay for first attempt', () => {
      const delay = calculateBackoffDelay(0, 1000, 30000)
      expect(delay).toBe(1000) // 1000 * 2^0 = 1000
    })

    it('should double delay with each attempt', () => {
      const delay0 = calculateBackoffDelay(0, 1000, 30000)
      const delay1 = calculateBackoffDelay(1, 1000, 30000)
      const delay2 = calculateBackoffDelay(2, 1000, 30000)

      expect(delay1).toBe(2000) // 1000 * 2^1 = 2000
      expect(delay2).toBe(4000) // 1000 * 2^2 = 4000
    })

    it('should cap delay at maxDelayMs', () => {
      const delay = calculateBackoffDelay(10, 1000, 30000)
      expect(delay).toBeLessThanOrEqual(30000)
    })

    it('should follow exponential formula: min(initialDelay * 2^attempt, maxDelay)', () => {
      // 1000 * 2^5 = 32000, capped at 30000
      const delay = calculateBackoffDelay(5, 1000, 30000)
      expect(delay).toBe(30000)
    })

    it('should respect custom initialDelayMs', () => {
      const delay = calculateBackoffDelay(1, 500, 30000)
      expect(delay).toBe(1000) // 500 * 2^1 = 1000
    })

    it('should respect custom maxDelayMs', () => {
      const delay = calculateBackoffDelay(10, 1000, 5000)
      expect(delay).toBe(5000)
    })
  })

  describe('delay', () => {
    it('should resolve after specified milliseconds', async () => {
      const promise = delay(1000)
      jest.advanceTimersByTime(999)
      await expect(
        Promise.race([promise, Promise.reject('timeout')])
      ).rejects.toBe('timeout')

      jest.advanceTimersByTime(1)
      await expect(promise).resolves.toBeUndefined()
    })

    it('should handle 0 delay', async () => {
      const promise = delay(0)
      jest.advanceTimersByTime(0)
      await expect(promise).resolves.toBeUndefined()
    })

    it('should handle multiple delays in sequence', async () => {
      const p1 = delay(100)
      const p2 = delay(200)

      jest.advanceTimersByTime(100)
      await expect(p1).resolves.toBeUndefined()

      jest.advanceTimersByTime(100)
      await expect(p2).resolves.toBeUndefined()
    })
  })

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      jest.useRealTimers()
      const fn = jest.fn().mockResolvedValueOnce('success')

      const result = await retryWithBackoff(fn)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)

      jest.useFakeTimers()
    })

    it('should retry on failure and succeed', async () => {
      jest.useRealTimers()
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new TypeError('Network request failed'))
        .mockResolvedValueOnce('success')

      const result = await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelayMs: 10,
        maxDelayMs: 100,
      })

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(2)

      jest.useFakeTimers()
    })

    it('should respect maxRetries limit', async () => {
      jest.useRealTimers()
      const fn = jest
        .fn()
        .mockRejectedValue(new TypeError('Network request failed'))

      try {
        await retryWithBackoff(fn, {
          maxRetries: 2,
          initialDelayMs: 10,
          maxDelayMs: 100,
        })
      } catch (error) {
        // Expected to throw
      }

      // Initial attempt + 2 retries = 3 total
      expect(fn).toHaveBeenCalledTimes(3)

      jest.useFakeTimers()
    })

    it('should stop retrying on non-retryable error', async () => {
      jest.useRealTimers()
      const fn = jest.fn().mockRejectedValue(new Error('Some error'))

      try {
        await retryWithBackoff(fn, {
          maxRetries: 3,
          initialDelayMs: 10,
          maxDelayMs: 100,
        })
      } catch (error) {
        // Expected to throw
      }

      // Should fail immediately without retries
      expect(fn).toHaveBeenCalledTimes(1)

      jest.useFakeTimers()
    })

    it('should use custom shouldRetry function', async () => {
      jest.useRealTimers()
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('Custom error'))
        .mockResolvedValueOnce('success')

      const result = await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelayMs: 10,
        maxDelayMs: 100,
        shouldRetry: () => true, // Retry all errors
      })

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(2)

      jest.useFakeTimers()
    })

    it('should use custom shouldRetry to prevent retry', async () => {
      jest.useRealTimers()
      const fn = jest
        .fn()
        .mockRejectedValue(new TypeError('Network request failed'))

      try {
        await retryWithBackoff(fn, {
          maxRetries: 3,
          initialDelayMs: 10,
          maxDelayMs: 100,
          shouldRetry: () => false, // Never retry
        })
      } catch (error) {
        // Expected to throw
      }

      expect(fn).toHaveBeenCalledTimes(1)

      jest.useFakeTimers()
    })

    it('should throw last error after all retries fail', async () => {
      jest.useRealTimers()
      const testError = new TypeError('Network request failed')
      const fn = jest.fn().mockRejectedValue(testError)

      try {
        await retryWithBackoff(fn, {
          maxRetries: 1,
          initialDelayMs: 10,
          maxDelayMs: 100,
        })
        fail('Should have thrown')
      } catch (error) {
        expect(error).toBe(testError)
      }

      jest.useFakeTimers()
    })

    it('should handle successful response after multiple failures', async () => {
      jest.useRealTimers()
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new TypeError('Network request failed'))
        .mockRejectedValueOnce(new TypeError('Network request failed'))
        .mockResolvedValueOnce('success')

      const result = await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelayMs: 10,
        maxDelayMs: 100,
      })

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(3)

      jest.useFakeTimers()
    })

    it('should use default config when not provided', async () => {
      jest.useRealTimers()
      const fn = jest.fn().mockResolvedValueOnce('success')

      const result = await retryWithBackoff(fn)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)

      jest.useFakeTimers()
    })

    it('should merge custom config with defaults', async () => {
      jest.useRealTimers()
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new TypeError('Network request failed'))
        .mockResolvedValueOnce('success')

      // Only override maxRetries, should keep other defaults
      const result = await retryWithBackoff(fn, { maxRetries: 5 })

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(2)

      jest.useFakeTimers()
    })
  })

  describe('integration scenarios', () => {
    it('should retry network failure with exponential backoff', async () => {
      jest.useRealTimers()
      let attempt = 0
      const fn = jest.fn(async () => {
        attempt++
        if (attempt < 3) {
          throw new TypeError('Network request failed')
        }
        return 'success'
      })

      const result = await retryWithBackoff(fn, {
        maxRetries: 3,
        initialDelayMs: 10,
        maxDelayMs: 100,
      })

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(3)

      jest.useFakeTimers()
    })

    it('should give up after max retries exceeded', async () => {
      jest.useRealTimers()
      const fn = jest
        .fn()
        .mockRejectedValue(new TypeError('Network request failed'))

      try {
        await retryWithBackoff(fn, {
          maxRetries: 2,
          initialDelayMs: 10,
          maxDelayMs: 100,
        })
        fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(TypeError)
      }

      // Initial + 2 retries
      expect(fn).toHaveBeenCalledTimes(3)

      jest.useFakeTimers()
    })

    it('should handle mixed error types', async () => {
      jest.useRealTimers()
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new TypeError('Network error'))
        .mockRejectedValueOnce(new Error('Not retryable'))

      try {
        await retryWithBackoff(fn, { maxRetries: 3 })
        fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
      }

      // Should stop after non-retryable error
      expect(fn).toHaveBeenCalledTimes(2)

      jest.useFakeTimers()
    })
  })
})

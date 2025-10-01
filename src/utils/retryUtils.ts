/**
 * Retry Utility with Exponential Backoff
 * Following React Native and Expo best practices for 2025
 *
 * Implements exponential backoff strategy:
 * - 1st retry: 1 second
 * - 2nd retry: 2 seconds
 * - 3rd retry: 4 seconds
 * - Max delay: 30 seconds
 */

import { NetworkError } from '@/types/ErrorTypes'
import * as Sentry from '@sentry/react-native'
import { API_CONFIG } from '@/constants/AppConfig'

export interface RetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  shouldRetry?: (error: unknown, attempt: number) => boolean
}

// Default retry configuration
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 30000, // 30 seconds
}

/**
 * Check if error is retryable (network errors only)
 */
export function isRetryableError(error: unknown): boolean {
  // Network errors from fetch
  if (error instanceof TypeError) {
    const message = error.message.toLowerCase()
    return (
      message.includes('network request failed') ||
      message.includes('network error') ||
      message.includes('fetch failed') ||
      message.includes('failed to fetch')
    )
  }

  // Supabase FunctionsFetchError
  if (error instanceof Error && error.name === 'FunctionsFetchError') {
    return true
  }

  // Generic network errors
  if (error instanceof NetworkError) {
    return true
  }

  // Check for timeout errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return (
      message.includes('timeout') ||
      message.includes('econnrefused') ||
      message.includes('connection refused')
    )
  }

  // Server errors 503/504 are retryable
  if (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    typeof error.status === 'number'
  ) {
    return error.status === 503 || error.status === 504
  }

  return false
}

/**
 * Calculate delay with exponential backoff
 * Formula: min(initialDelay * 2^attempt, maxDelay)
 */
export function calculateBackoffDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number
): number {
  const exponentialDelay = initialDelayMs * Math.pow(2, attempt)
  return Math.min(exponentialDelay, maxDelayMs)
}

/**
 * Delay execution for specified milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Wrap a promise with timeout using Promise.race
 * This works even when the underlying API doesn't support AbortSignal
 */
export function withTimeout<T>(
  promiseFactory: () => Promise<T>,
  timeoutMs: number,
  errorMessage: string = 'Operation timed out'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(
        new NetworkError(errorMessage, 'Request timeout. Please try again.')
      )
    }, timeoutMs)
  })

  return Promise.race([promiseFactory(), timeoutPromise])
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn - Function to retry
 * @param config - Retry configuration
 * @returns Promise with function result
 * @throws Last error if all retries fail
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  let lastError: unknown

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      // Add Sentry breadcrumb for retry attempts
      if (attempt > 0) {
        Sentry.addBreadcrumb({
          category: 'retry',
          message: `Retry attempt ${attempt}/${finalConfig.maxRetries}`,
          level: 'info',
          data: {
            attempt,
            maxRetries: finalConfig.maxRetries,
          },
        })
      }

      return await fn()
    } catch (error) {
      lastError = error

      // Check if we should retry
      const shouldRetry =
        finalConfig.shouldRetry?.(error, attempt) ?? isRetryableError(error)

      // Don't retry if:
      // 1. It's the last attempt
      // 2. Error is not retryable
      if (attempt >= finalConfig.maxRetries || !shouldRetry) {
        break
      }

      // Calculate delay with exponential backoff
      const delayMs = calculateBackoffDelay(
        attempt,
        finalConfig.initialDelayMs,
        finalConfig.maxDelayMs
      )

      // Add breadcrumb before delay
      Sentry.addBreadcrumb({
        category: 'retry',
        message: `Waiting ${delayMs}ms before retry`,
        level: 'info',
        data: {
          attempt,
          delayMs,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
        },
      })

      // Wait before next retry
      await delay(delayMs)
    }
  }

  // All retries failed, throw last error
  throw lastError
}

/**
 * Wrapper for Supabase function invocations with retry logic
 * Specifically designed for Edge Function calls
 */
export async function retrySupabaseFunction<T>(
  fn: () => Promise<T>,
  context?: {
    functionName?: string
    operation?: string
  }
): Promise<T> {
  const isRetryable = (error: unknown, attempt: number) => {
    const retryable = isRetryableError(error)

    // Add Sentry breadcrumb with context
    Sentry.addBreadcrumb({
      category: 'supabase.retry',
      message: `Supabase function ${context?.functionName || 'unknown'} ${retryable ? 'will retry' : 'will not retry'}`,
      level: retryable ? 'info' : 'warning',
      data: {
        functionName: context?.functionName,
        operation: context?.operation,
        attempt,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        isRetryable: retryable,
      },
    })

    return retryable
  }

  // Wrap function with timeout using Promise.race
  const fnWithTimeout = () =>
    withTimeout(
      fn,
      API_CONFIG.EDGE_FUNCTION_TIMEOUT_MS,
      `Edge Function ${context?.functionName || 'call'} timed out after ${API_CONFIG.EDGE_FUNCTION_TIMEOUT_MS}ms`
    )

  return retryWithBackoff(fnWithTimeout, {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    shouldRetry: isRetryable,
  })
}

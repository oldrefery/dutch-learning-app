import { supabase } from '@/lib/supabase'
import { Sentry } from '@/lib/sentry'
import type { AccessLevel, UserAccessLevel } from '@/types/database'

type Result<T, E = string> =
  | { success: true; data: T }
  | { success: false; error: E }

export enum AccessControlError {
  NOT_FOUND = 'ACCESS_LEVEL_NOT_FOUND',
  DATABASE_ERROR = 'DATABASE_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

class AccessControlService {
  /**
   * Get access level for the current user
   */
  async getUserAccessLevel(
    userId: string
  ): Promise<Result<AccessLevel, AccessControlError>> {
    try {
      const { data, error } = await supabase
        .from('user_access_levels')
        .select('access_level')
        .eq('user_id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // User not found - return read_only as default
          Sentry.addBreadcrumb({
            category: 'access_control',
            message: 'User access level not found, defaulting to read_only',
            data: { userId },
            level: 'warning',
          })

          return { success: true, data: 'read_only' }
        }

        Sentry.captureException(
          new Error(`Failed to fetch user access level: ${error.message}`),
          {
            tags: {
              operation: 'getUserAccessLevel',
              errorCode: error.code,
            },
            extra: {
              userId,
              supabaseError: error,
            },
          }
        )

        return { success: false, error: AccessControlError.DATABASE_ERROR }
      }

      return { success: true, data: data.access_level }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'getUserAccessLevel' },
        extra: { userId },
      })

      return { success: false, error: AccessControlError.UNKNOWN_ERROR }
    }
  }

  /**
   * Check if user has full access
   */
  async hasFullAccess(userId: string): Promise<boolean> {
    const result = await this.getUserAccessLevel(userId)

    if (!result.success) {
      // Default to read-only on error
      return false
    }

    return result.data === 'full_access'
  }

  /**
   * Check if user has read-only access
   */
  async isReadOnly(userId: string): Promise<boolean> {
    const hasFullAccessResult = await this.hasFullAccess(userId)
    return !hasFullAccessResult
  }

  /**
   * Get full user access level details
   */
  async getUserAccessDetails(
    userId: string
  ): Promise<Result<UserAccessLevel, AccessControlError>> {
    try {
      const { data, error } = await supabase
        .from('user_access_levels')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return { success: false, error: AccessControlError.NOT_FOUND }
        }

        Sentry.captureException(
          new Error(`Failed to fetch user access details: ${error.message}`),
          {
            tags: {
              operation: 'getUserAccessDetails',
              errorCode: error.code,
            },
            extra: {
              userId,
              supabaseError: error,
            },
          }
        )

        return { success: false, error: AccessControlError.DATABASE_ERROR }
      }

      return { success: true, data }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'getUserAccessDetails' },
        extra: { userId },
      })

      return { success: false, error: AccessControlError.UNKNOWN_ERROR }
    }
  }
}

export const accessControlService = new AccessControlService()

export default accessControlService

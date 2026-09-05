/**
 * Toast Notification Constants
 *
 * Simplified toast system following UX best practices.
 * Uses minimal types for better user experience and easier maintenance.
 */

// Simplified toast types enum
export enum ToastType {
  SUCCESS = 'success',
  ERROR = 'error',
  INFO = 'info',
}

// Toast configuration with timing based on UX best practices
export const TOAST_CONFIG = {
  [ToastType.SUCCESS]: {
    type: 'success' as const,
    visibilityTime: 3000, // 3 seconds for positive feedback
  },
  [ToastType.ERROR]: {
    type: 'error' as const,
    visibilityTime: 4000, // 4 seconds for errors (need more time to read)
  },
  [ToastType.INFO]: {
    type: 'info' as const,
    visibilityTime: 2500, // 2.5 seconds for neutral info
  },
}

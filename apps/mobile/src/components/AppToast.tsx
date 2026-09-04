/**
 * App Toast Component
 *
 * Centralized toast component with predefined message templates and configurations.
 * This component provides a consistent interface for showing toast notifications
 * throughout the app with predefined messages and styling.
 */

import React from 'react'
import { useColorScheme } from 'react-native'
import Toast, {
  BaseToast,
  ErrorToast,
  type ToastConfigParams,
} from 'react-native-toast-message'
import { ToastType, TOAST_CONFIG } from '@/constants/ToastConstants'
import { Colors } from '@/constants/Colors'
import { useHistoryStore } from '@/stores/useHistoryStore'

interface AppToastProps {
  // Optional custom configuration
  position?: 'top' | 'bottom'
  topOffset?: number
  bottomOffset?: number
  visibilityTime?: number
}

/**
 * Centralized toast component with predefined messages
 * Custom configuration following Apple HIG guidelines for both themes
 */
export const AppToast: React.FC<AppToastProps> = ({
  position = 'top',
  topOffset = 60,
  bottomOffset = 60,
  visibilityTime = 3000,
}) => {
  const colorScheme = useColorScheme() ?? 'light'
  const isDark = colorScheme === 'dark'

  const toastConfig = {
    success: (props: ToastConfigParams<unknown>) => (
      <BaseToast
        {...props}
        style={{
          borderLeftColor: isDark
            ? Colors.success.dark
            : Colors.success.DEFAULT,
          backgroundColor: isDark
            ? Colors.dark.backgroundElevated
            : Colors.light.backgroundElevated,
        }}
        contentContainerStyle={{
          paddingHorizontal: 15,
        }}
        text1Style={{
          fontSize: 15,
          fontWeight: '600',
          color: isDark ? Colors.dark.text : Colors.light.text,
        }}
        text2Style={{
          fontSize: 13,
          color: isDark
            ? Colors.dark.textSecondary
            : Colors.light.textSecondary,
        }}
      />
    ),
    error: (props: ToastConfigParams<unknown>) => (
      <ErrorToast
        {...props}
        style={{
          borderLeftColor: isDark
            ? Colors.error.darkMode
            : Colors.error.DEFAULT,
          backgroundColor: isDark
            ? Colors.dark.backgroundElevated
            : Colors.light.backgroundElevated,
        }}
        text1Style={{
          fontSize: 15,
          fontWeight: '600',
          color: isDark ? Colors.dark.text : Colors.light.text,
        }}
        text2Style={{
          fontSize: 13,
          color: isDark
            ? Colors.dark.textSecondary
            : Colors.light.textSecondary,
        }}
      />
    ),
    info: (props: ToastConfigParams<unknown>) => (
      <BaseToast
        {...props}
        style={{
          borderLeftColor: isDark
            ? Colors.primary.darkMode
            : Colors.primary.DEFAULT,
          backgroundColor: isDark
            ? Colors.dark.backgroundElevated
            : Colors.light.backgroundElevated,
        }}
        contentContainerStyle={{
          paddingHorizontal: 15,
        }}
        text1Style={{
          fontSize: 15,
          fontWeight: '600',
          color: isDark ? Colors.dark.text : Colors.light.text,
        }}
        text2Style={{
          fontSize: 13,
          color: isDark
            ? Colors.dark.textSecondary
            : Colors.light.textSecondary,
        }}
      />
    ),
  }

  return (
    <Toast
      config={toastConfig}
      position={position}
      topOffset={topOffset}
      bottomOffset={bottomOffset}
      visibilityTime={visibilityTime}
    />
  )
}

/**
 * Simplified toast service following UX best practices
 * One method for all toast notifications with minimal types
 */
export class ToastService {
  /**
   * Show a toast notification
   * @param message - The message to display
   * @param type - Type of notification (success, error, info)
   */
  static show = (message: string, type: ToastType = ToastType.INFO) => {
    const config = TOAST_CONFIG[type]

    // Add to history
    useHistoryStore.getState().addNotification(message, type)

    Toast.show({
      type: config.type,
      text1: message,
      visibilityTime: config.visibilityTime,
      position: 'top',
    })
  }
}

// Export the service as default for easier importing
export default ToastService

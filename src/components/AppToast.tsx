/**
 * App Toast Component
 *
 * Centralized toast component with predefined message templates and configurations.
 * This component provides a consistent interface for showing toast notifications
 * throughout the app with predefined messages and styling.
 */

import React from 'react'
import Toast from 'react-native-toast-message'
import {
  TOAST_MESSAGES,
  TOAST_CONFIGS,
  ToastType,
  ToastMessageType,
  ToastConfigType,
} from '@/constants/ToastConstants'

interface AppToastProps {
  // Optional custom configuration
  position?: 'top' | 'bottom'
  topOffset?: number
  bottomOffset?: number
  visibilityTime?: number
}

/**
 * Centralized toast component with predefined messages
 */
export const AppToast: React.FC<AppToastProps> = ({
  position = 'top',
  topOffset = 60,
  bottomOffset = 60,
  visibilityTime = 3000,
}) => {
  return (
    <Toast
      position={position}
      topOffset={topOffset}
      bottomOffset={bottomOffset}
      visibilityTime={visibilityTime}
    />
  )
}

/**
 * Toast service with predefined message methods
 * This provides a clean API for showing common toast messages
 */
export class ToastService {
  /**
   * Show a success toast with predefined message
   */
  static showSuccess = (
    messageType: ToastMessageType,
    customText2?: string
  ) => {
    const message = TOAST_MESSAGES[messageType]
    Toast.show({
      ...TOAST_CONFIGS[ToastConfigType.SUCCESS],
      text1: message.text1,
      text2: customText2 || message.text2,
    })
  }

  /**
   * Show an error toast with predefined message
   */
  static showError = (messageType: ToastMessageType, customText2?: string) => {
    const message = TOAST_MESSAGES[messageType]
    Toast.show({
      ...TOAST_CONFIGS[ToastConfigType.ERROR],
      text1: message.text1,
      text2: customText2 || message.text2,
    })
  }

  /**
   * Show an info toast with predefined message
   */
  static showInfo = (messageType: ToastMessageType, customText2?: string) => {
    const message = TOAST_MESSAGES[messageType]
    Toast.show({
      ...TOAST_CONFIGS[ToastConfigType.INFO],
      text1: message.text1,
      text2: customText2 || message.text2,
    })
  }

  /**
   * Show a warning toast with predefined message
   */
  static showWarning = (
    messageType: ToastMessageType,
    customText2?: string
  ) => {
    const message = TOAST_MESSAGES[messageType]
    Toast.show({
      ...TOAST_CONFIGS[ToastConfigType.WARNING],
      text1: message.text1,
      text2: customText2 || message.text2,
    })
  }

  /**
   * Show a custom toast with full control over content
   */
  static showCustom = (
    type: ToastType,
    text1: string,
    text2?: string,
    duration?: number
  ) => {
    Toast.show({
      type,
      text1,
      text2,
      visibilityTime: duration,
    })
  }

  /**
   * Show a success toast for word operations
   */
  static showWordAdded = (word: string, collection: string) => {
    Toast.show({
      ...TOAST_CONFIGS[ToastConfigType.SUCCESS],
      text1: TOAST_MESSAGES[ToastMessageType.WORD_ADDED].text1,
      text2: `"${word}" has been added to "${collection}"`,
    })
  }

  /**
   * Show an error toast for word operations
   */
  static showWordError = (error: string) => {
    Toast.show({
      ...TOAST_CONFIGS[ToastConfigType.ERROR],
      text1: TOAST_MESSAGES[ToastMessageType.ADD_WORD_FAILED].text1,
      text2: error || TOAST_MESSAGES[ToastMessageType.ADD_WORD_FAILED].text2,
    })
  }

  /**
   * Show a collection operation success toast
   */
  static showCollectionSuccess = (
    operation: 'created' | 'deleted',
    collectionName?: string
  ) => {
    if (operation === 'created') {
      Toast.show({
        ...TOAST_CONFIGS[ToastConfigType.SUCCESS],
        text1: TOAST_MESSAGES[ToastMessageType.COLLECTION_CREATED].text1,
        text2: collectionName
          ? `"${collectionName}" has been created successfully`
          : TOAST_MESSAGES[ToastMessageType.COLLECTION_CREATED].text2,
      })
    } else {
      Toast.show({
        ...TOAST_CONFIGS[ToastConfigType.SUCCESS],
        text1: TOAST_MESSAGES[ToastMessageType.COLLECTION_DELETED].text1,
        text2: collectionName
          ? `"${collectionName}" has been deleted`
          : TOAST_MESSAGES[ToastMessageType.COLLECTION_DELETED].text2,
      })
    }
  }

  /**
   * Show a collection operation error toast
   */
  static showCollectionError = (
    operation: 'create' | 'delete',
    error?: string
  ) => {
    const messageType =
      operation === 'create'
        ? ToastMessageType.CREATE_COLLECTION_FAILED
        : ToastMessageType.DELETE_FAILED
    const message = TOAST_MESSAGES[messageType]

    Toast.show({
      ...TOAST_CONFIGS[ToastConfigType.ERROR],
      text1: message.text1,
      text2: error || message.text2,
    })
  }

  /**
   * Show a review session related toast
   */
  static showReviewMessage = (type: 'complete' | 'incorrect' | 'no_words') => {
    switch (type) {
      case 'complete':
        Toast.show({
          ...TOAST_CONFIGS[ToastConfigType.SUCCESS],
          ...TOAST_MESSAGES[ToastMessageType.SESSION_COMPLETE],
        })
        break
      case 'incorrect':
        Toast.show({
          ...TOAST_CONFIGS[ToastConfigType.INFO],
          ...TOAST_MESSAGES[ToastMessageType.INCORRECT_ANSWER],
        })
        break
      case 'no_words':
        Toast.show({
          ...TOAST_CONFIGS[ToastConfigType.INFO],
          ...TOAST_MESSAGES[ToastMessageType.NO_WORDS_FOR_REVIEW],
        })
        break
    }
  }
}

// Export the service as default for easier importing
export default ToastService

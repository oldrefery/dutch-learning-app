/**
 * Toast Notification Constants
 *
 * Centralized constants for all toast messages used throughout the app.
 * This ensures consistency and makes it easy to update messages in one place.
 */

// Enums for type safety
export enum ToastMessageType {
  // Success messages
  WORD_ADDED = 'WORD_ADDED',
  COLLECTION_DELETED = 'COLLECTION_DELETED',
  WORD_DELETED = 'WORD_DELETED',
  SESSION_COMPLETE = 'SESSION_COMPLETE',
  IMAGE_UPDATED = 'IMAGE_UPDATED',
  COLLECTION_CREATED = 'COLLECTION_CREATED',

  // Error messages
  NO_COLLECTION_SELECTED = 'NO_COLLECTION_SELECTED',
  DELETE_FAILED = 'DELETE_FAILED',
  ADD_WORD_FAILED = 'ADD_WORD_FAILED',
  DELETE_WORD_FAILED = 'DELETE_WORD_FAILED',
  UPDATE_IMAGE_FAILED = 'UPDATE_IMAGE_FAILED',
  MARK_INCORRECT_FAILED = 'MARK_INCORRECT_FAILED',
  CREATE_COLLECTION_FAILED = 'CREATE_COLLECTION_FAILED',
  ANALYSIS_FAILED = 'ANALYSIS_FAILED',
  AUDIO_PLAYBACK_FAILED = 'AUDIO_PLAYBACK_FAILED',

  // Info messages
  NO_WORDS_FOR_REVIEW = 'NO_WORDS_FOR_REVIEW',
  INCORRECT_ANSWER = 'INCORRECT_ANSWER',
  RESTART_SESSION = 'RESTART_SESSION',
  COLLECTION_NAME_REQUIRED = 'COLLECTION_NAME_REQUIRED',

  // Warning messages
  NETWORK_ERROR = 'NETWORK_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
}

export enum ToastConfigType {
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR',
  INFO = 'INFO',
  WARNING = 'WARNING',
}

export const TOAST_MESSAGES: Record<ToastMessageType, ToastMessage> = {
  // Success messages
  [ToastMessageType.WORD_ADDED]: {
    text1: 'Word Added!',
    text2: 'Word has been successfully added to collection',
  },
  [ToastMessageType.COLLECTION_DELETED]: {
    text1: 'Collection Deleted',
    text2: 'Collection and all its words have been deleted',
  },
  [ToastMessageType.WORD_DELETED]: {
    text1: 'Word Deleted',
    text2: 'Word has been removed from collection',
  },
  [ToastMessageType.SESSION_COMPLETE]: {
    text1: 'Session Complete',
    text2: 'Great job! Review session finished.',
  },
  [ToastMessageType.IMAGE_UPDATED]: {
    text1: 'Image Updated',
    text2: 'Word image has been changed',
  },
  [ToastMessageType.COLLECTION_CREATED]: {
    text1: 'Collection Created',
    text2: 'New collection has been created successfully',
  },

  // Error messages
  [ToastMessageType.NO_COLLECTION_SELECTED]: {
    text1: 'No Collection Selected',
    text2: 'Please select a collection to add the word to',
  },
  [ToastMessageType.DELETE_FAILED]: {
    text1: 'Delete Failed',
    text2: 'Failed to delete collection. Please try again.',
  },
  [ToastMessageType.ADD_WORD_FAILED]: {
    text1: 'Error Adding Word',
    text2: 'Could not add word. Please try again.',
  },
  [ToastMessageType.DELETE_WORD_FAILED]: {
    text1: 'Error',
    text2: 'Failed to delete word',
  },
  [ToastMessageType.UPDATE_IMAGE_FAILED]: {
    text1: 'Error',
    text2: 'Failed to update image',
  },
  [ToastMessageType.MARK_INCORRECT_FAILED]: {
    text1: 'Error',
    text2: 'Failed to mark as incorrect',
  },
  [ToastMessageType.CREATE_COLLECTION_FAILED]: {
    text1: 'Error',
    text2: 'Failed to create collection. Please try again.',
  },
  [ToastMessageType.ANALYSIS_FAILED]: {
    text1: 'Analysis Failed',
    text2: 'Could not analyze word. Please try again.',
  },
  [ToastMessageType.AUDIO_PLAYBACK_FAILED]: {
    text1: 'Audio Error',
    text2: 'Could not play pronunciation',
  },

  // Info messages
  [ToastMessageType.NO_WORDS_FOR_REVIEW]: {
    text1: 'No Words',
    text2: 'No words are due for review right now!',
  },
  [ToastMessageType.INCORRECT_ANSWER]: {
    text1: 'Incorrect',
    text2: 'Keep practicing!',
  },
  [ToastMessageType.RESTART_SESSION]: {
    text1: 'Restart',
    text2: 'Session restart functionality coming soon',
  },
  [ToastMessageType.COLLECTION_NAME_REQUIRED]: {
    text1: 'Name Required',
    text2: 'Please enter a collection name',
  },

  // Warning messages
  [ToastMessageType.NETWORK_ERROR]: {
    text1: 'Network Error',
    text2: 'Please check your internet connection',
  },
  [ToastMessageType.RATE_LIMIT]: {
    text1: 'Rate Limit',
    text2: 'Please wait before trying again',
  },
}

// Toast types for type safety
export type ToastType = 'success' | 'error' | 'info' | 'warning'

// Helper type for toast message structure
export type ToastMessage = {
  text1: string
  text2: string
}

// Helper function to get toast message by enum
export const getToastMessage = (
  messageType: ToastMessageType
): ToastMessage => {
  return TOAST_MESSAGES[messageType]
}

// Predefined toast configurations with common settings
export const TOAST_CONFIGS: Record<
  ToastConfigType,
  { type: ToastType; duration: number }
> = {
  [ToastConfigType.SUCCESS]: {
    type: 'success',
    duration: 3000,
  },
  [ToastConfigType.ERROR]: {
    type: 'error',
    duration: 4000,
  },
  [ToastConfigType.INFO]: {
    type: 'info',
    duration: 2500,
  },
  [ToastConfigType.WARNING]: {
    type: 'warning',
    duration: 3500,
  },
}

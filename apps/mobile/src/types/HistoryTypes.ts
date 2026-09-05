/**
 * History Types for Notification and Word Analysis History
 */

import { ToastType } from '@/constants/ToastConstants'

// Notification History Entry
export interface NotificationHistoryEntry {
  id: string
  message: string
  type: ToastType
  timestamp: Date
}

// Word Analysis History Entry
export interface WordAnalysisHistoryEntry {
  id: string
  word: string
  dutchLemma: string
  addedToCollection?: string // Collection name if added
  timestamp: Date
  wasAdded: boolean
}

// History Store State
export interface HistoryState {
  notifications: NotificationHistoryEntry[]
  analyzedWords: WordAnalysisHistoryEntry[]
}

// History Actions
export interface HistoryActions {
  addNotification: (message: string, type: ToastType) => void
  addAnalyzedWord: (
    word: string,
    dutchLemma: string,
    addedToCollection?: string
  ) => void
  clearNotificationHistory: () => void
  clearWordHistory: () => void
  getNotificationHistory: () => NotificationHistoryEntry[]
  getWordHistory: () => WordAnalysisHistoryEntry[]
}

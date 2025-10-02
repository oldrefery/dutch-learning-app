/**
 * History Store
 * Tracks notification and word analysis history
 */

import { create } from 'zustand'
import type {
  HistoryState,
  HistoryActions,
  NotificationHistoryEntry,
  WordAnalysisHistoryEntry,
} from '@/types/HistoryTypes'
import { ToastType } from '@/constants/ToastConstants'

// Maximum number of items to keep in history
const MAX_NOTIFICATIONS = 20
const MAX_ANALYZED_WORDS = 3

interface HistoryStore extends HistoryState, HistoryActions {}

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  // Initial state
  notifications: [],
  analyzedWords: [],

  // Add notification to history
  addNotification: (message: string, type: ToastType) => {
    const newNotification: NotificationHistoryEntry = {
      id: `${Date.now()}-${Math.random()}`,
      message,
      type,
      timestamp: new Date(),
    }

    set(state => ({
      notifications: [newNotification, ...state.notifications].slice(
        0,
        MAX_NOTIFICATIONS
      ),
    }))
  },

  // Add analyzed word to history
  addAnalyzedWord: (
    word: string,
    dutchLemma: string,
    addedToCollection?: string
  ) => {
    const newEntry: WordAnalysisHistoryEntry = {
      id: `${Date.now()}-${Math.random()}`,
      word,
      dutchLemma,
      addedToCollection,
      timestamp: new Date(),
      wasAdded: !!addedToCollection,
    }

    set(state => ({
      analyzedWords: [newEntry, ...state.analyzedWords].slice(
        0,
        MAX_ANALYZED_WORDS
      ),
    }))
  },

  // Clear notification history
  clearNotificationHistory: () => {
    set({ notifications: [] })
  },

  // Clear word history
  clearWordHistory: () => {
    set({ analyzedWords: [] })
  },

  // Get notification history
  getNotificationHistory: () => {
    return get().notifications
  },

  // Get word history
  getWordHistory: () => {
    return get().analyzedWords
  },
}))

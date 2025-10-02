/**
 * History Store
 * Tracks notification and word analysis history
 * - Notifications: ephemeral (cleared on app restart)
 * - Analyzed words: persisted to AsyncStorage
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
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

export const useHistoryStore = create<HistoryStore>()(
  persist(
    (set, get) => ({
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
        set(state => {
          const existingIndex = state.analyzedWords.findIndex(
            entry => entry.dutchLemma === dutchLemma
          )

          if (existingIndex !== -1) {
            // Update existing entry
            const updatedWords = [...state.analyzedWords]
            updatedWords[existingIndex] = {
              ...updatedWords[existingIndex],
              addedToCollection,
              wasAdded: !!addedToCollection,
            }

            return { analyzedWords: updatedWords }
          } else {
            const newEntry: WordAnalysisHistoryEntry = {
              id: `${Date.now()}-${Math.random()}`,
              word,
              dutchLemma,
              addedToCollection,
              timestamp: new Date(),
              wasAdded: !!addedToCollection,
            }

            return {
              analyzedWords: [newEntry, ...state.analyzedWords].slice(
                0,
                MAX_ANALYZED_WORDS
              ),
            }
          }
        })
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
    }),
    {
      name: 'history-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist analyzedWords, not notifications
      partialize: state => ({ analyzedWords: state.analyzedWords }),
    }
  )
)

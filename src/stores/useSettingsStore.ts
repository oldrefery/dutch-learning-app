/**
 * Settings Store
 * Persisted user preferences using AsyncStorage
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { REVIEW_MODE } from '@/constants/ReviewConstants'
import type { ReviewMode } from '@/types/ReviewTypes'

interface SettingsState {
  autoPlayPronunciation: boolean
  lastSelectedCollectionId: string | null
  lastSelectedReviewMode: ReviewMode
}

interface SettingsActions {
  setAutoPlayPronunciation: (enabled: boolean) => void
  setLastSelectedCollectionId: (id: string | null) => void
  setLastSelectedReviewMode: (mode: ReviewMode) => void
}

interface SettingsStore extends SettingsState, SettingsActions {}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    set => ({
      // Initial state
      autoPlayPronunciation: false,
      lastSelectedCollectionId: null,
      lastSelectedReviewMode: REVIEW_MODE.MEANING_RECALL,

      // Actions
      setAutoPlayPronunciation: (enabled: boolean) => {
        set({ autoPlayPronunciation: enabled })
      },
      setLastSelectedCollectionId: (id: string | null) => {
        set({ lastSelectedCollectionId: id })
      },
      setLastSelectedReviewMode: (mode: ReviewMode) => {
        set({ lastSelectedReviewMode: mode })
      },
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

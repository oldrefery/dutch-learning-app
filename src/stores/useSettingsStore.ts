/**
 * Settings Store
 * Persisted user preferences using AsyncStorage
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { REVIEW_MODE, REVIEW_SESSION_MODE } from '@/constants/ReviewConstants'
import type { ReviewSessionMode } from '@/types/ReviewTypes'

interface SettingsState {
  autoPlayPronunciation: boolean
  adaptiveReviewEnabled: boolean
  lastSelectedCollectionId: string | null
  lastSelectedReviewMode: ReviewSessionMode
}

interface SettingsActions {
  setAutoPlayPronunciation: (enabled: boolean) => void
  setAdaptiveReviewEnabled: (enabled: boolean) => void
  setLastSelectedCollectionId: (id: string | null) => void
  setLastSelectedReviewMode: (mode: ReviewSessionMode) => void
}

interface SettingsStore extends SettingsState, SettingsActions {}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    set => ({
      // Initial state
      autoPlayPronunciation: false,
      adaptiveReviewEnabled: true,
      lastSelectedCollectionId: null,
      lastSelectedReviewMode: REVIEW_SESSION_MODE.ADAPTIVE,

      // Actions
      setAutoPlayPronunciation: (enabled: boolean) => {
        set({ autoPlayPronunciation: enabled })
      },
      setAdaptiveReviewEnabled: (enabled: boolean) => {
        set(state => ({
          adaptiveReviewEnabled: enabled,
          lastSelectedReviewMode:
            !enabled &&
            state.lastSelectedReviewMode === REVIEW_SESSION_MODE.ADAPTIVE
              ? REVIEW_MODE.MEANING_RECALL
              : state.lastSelectedReviewMode,
        }))
      },
      setLastSelectedCollectionId: (id: string | null) => {
        set({ lastSelectedCollectionId: id })
      },
      setLastSelectedReviewMode: (mode: ReviewSessionMode) => {
        set({ lastSelectedReviewMode: mode })
      },
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

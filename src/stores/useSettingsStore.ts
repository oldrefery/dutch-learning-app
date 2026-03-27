/**
 * Settings Store
 * Persisted user preferences using AsyncStorage
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface SettingsState {
  autoPlayPronunciation: boolean
  lastSelectedCollectionId: string | null
}

interface SettingsActions {
  setAutoPlayPronunciation: (enabled: boolean) => void
  setLastSelectedCollectionId: (id: string | null) => void
}

interface SettingsStore extends SettingsState, SettingsActions {}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    set => ({
      // Initial state
      autoPlayPronunciation: false,
      lastSelectedCollectionId: null,

      // Actions
      setAutoPlayPronunciation: (enabled: boolean) => {
        set({ autoPlayPronunciation: enabled })
      },
      setLastSelectedCollectionId: (id: string | null) => {
        set({ lastSelectedCollectionId: id })
      },
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

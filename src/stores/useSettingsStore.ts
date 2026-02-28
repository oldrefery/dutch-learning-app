/**
 * Settings Store
 * Persisted user preferences using AsyncStorage
 */

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

interface SettingsState {
  autoPlayPronunciation: boolean
}

interface SettingsActions {
  setAutoPlayPronunciation: (enabled: boolean) => void
}

interface SettingsStore extends SettingsState, SettingsActions {}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    set => ({
      // Initial state
      autoPlayPronunciation: false,

      // Actions
      setAutoPlayPronunciation: (enabled: boolean) => {
        set({ autoPlayPronunciation: enabled })
      },
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
)

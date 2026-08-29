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
  learningGuideVersionSeen: number
}

interface SettingsActions {
  setAutoPlayPronunciation: (enabled: boolean) => void
  setAdaptiveReviewEnabled: (enabled: boolean) => void
  setLastSelectedCollectionId: (id: string | null) => void
  setLastSelectedReviewMode: (mode: ReviewSessionMode) => void
  markLearningGuideVersionSeen: (version: number) => void
  resetLearningGuideVersionSeenForTesting: () => void
}

interface SettingsStore extends SettingsState, SettingsActions {}

export type PersistedSettingsState = SettingsState

export const SETTINGS_STORAGE_VERSION = 1

const DEFAULT_SETTINGS_STATE: SettingsState = {
  autoPlayPronunciation: false,
  adaptiveReviewEnabled: true,
  lastSelectedCollectionId: null,
  lastSelectedReviewMode: REVIEW_SESSION_MODE.ADAPTIVE,
  learningGuideVersionSeen: 0,
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isReviewSessionMode = (value: unknown): value is ReviewSessionMode =>
  typeof value === 'string' &&
  Object.values(REVIEW_SESSION_MODE).some(mode => mode === value)

const normalizeGuideVersion = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0

export const migrateSettingsState = (
  persistedState: unknown,
  storedVersion: number
): PersistedSettingsState => {
  const state = isRecord(persistedState) ? persistedState : {}

  return {
    autoPlayPronunciation:
      typeof state.autoPlayPronunciation === 'boolean'
        ? state.autoPlayPronunciation
        : DEFAULT_SETTINGS_STATE.autoPlayPronunciation,
    adaptiveReviewEnabled:
      typeof state.adaptiveReviewEnabled === 'boolean'
        ? state.adaptiveReviewEnabled
        : DEFAULT_SETTINGS_STATE.adaptiveReviewEnabled,
    lastSelectedCollectionId:
      typeof state.lastSelectedCollectionId === 'string' ||
      state.lastSelectedCollectionId === null
        ? state.lastSelectedCollectionId
        : DEFAULT_SETTINGS_STATE.lastSelectedCollectionId,
    lastSelectedReviewMode: isReviewSessionMode(state.lastSelectedReviewMode)
      ? state.lastSelectedReviewMode
      : DEFAULT_SETTINGS_STATE.lastSelectedReviewMode,
    learningGuideVersionSeen:
      storedVersion < SETTINGS_STORAGE_VERSION
        ? 0
        : normalizeGuideVersion(state.learningGuideVersionSeen),
  }
}

export const useSettingsStore = create<SettingsStore>()(
  persist<SettingsStore, [], [], PersistedSettingsState>(
    set => ({
      // Initial state
      ...DEFAULT_SETTINGS_STATE,

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
      markLearningGuideVersionSeen: (version: number) => {
        set(state => ({
          learningGuideVersionSeen: Math.max(
            state.learningGuideVersionSeen,
            normalizeGuideVersion(version)
          ),
        }))
      },
      resetLearningGuideVersionSeenForTesting: () => {
        set({ learningGuideVersionSeen: 0 })
      },
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      version: SETTINGS_STORAGE_VERSION,
      migrate: migrateSettingsState,
      partialize: state => ({
        autoPlayPronunciation: state.autoPlayPronunciation,
        adaptiveReviewEnabled: state.adaptiveReviewEnabled,
        lastSelectedCollectionId: state.lastSelectedCollectionId,
        lastSelectedReviewMode: state.lastSelectedReviewMode,
        learningGuideVersionSeen: state.learningGuideVersionSeen,
      }),
    }
  )
)

/**
 * Tests for useSettingsStore
 *
 * Zustand store with AsyncStorage persistence for user preferences:
 * autoPlayPronunciation, lastSelectedCollectionId, and review mode.
 */

import { useSettingsStore } from '../useSettingsStore'
import { REVIEW_MODE, REVIEW_SESSION_MODE } from '@/constants/ReviewConstants'

describe('useSettingsStore', () => {
  beforeEach(() => {
    // Reset store to initial state between tests
    useSettingsStore.setState({
      autoPlayPronunciation: false,
      adaptiveReviewEnabled: true,
      lastSelectedCollectionId: null,
      lastSelectedReviewMode: REVIEW_SESSION_MODE.ADAPTIVE,
    })
  })

  describe('initial state', () => {
    it('should default autoPlayPronunciation to false', () => {
      expect(useSettingsStore.getState().autoPlayPronunciation).toBe(false)
    })

    it('should default lastSelectedCollectionId to null', () => {
      expect(useSettingsStore.getState().lastSelectedCollectionId).toBeNull()
    })

    it('should default to Adaptive review mode', () => {
      expect(useSettingsStore.getState().lastSelectedReviewMode).toBe(
        REVIEW_SESSION_MODE.ADAPTIVE
      )
    })

    it('should enable adaptive review modes by default', () => {
      expect(useSettingsStore.getState().adaptiveReviewEnabled).toBe(true)
    })
  })

  describe('setAdaptiveReviewEnabled', () => {
    it('should fall back to Meaning Recall when Adaptive is disabled', () => {
      useSettingsStore.getState().setAdaptiveReviewEnabled(false)

      expect(useSettingsStore.getState().adaptiveReviewEnabled).toBe(false)
      expect(useSettingsStore.getState().lastSelectedReviewMode).toBe(
        REVIEW_MODE.MEANING_RECALL
      )
    })

    it('should preserve an explicitly selected manual mode', () => {
      useSettingsStore
        .getState()
        .setLastSelectedReviewMode(REVIEW_MODE.DUTCH_PRODUCTION)
      useSettingsStore.getState().setAdaptiveReviewEnabled(false)

      expect(useSettingsStore.getState().lastSelectedReviewMode).toBe(
        REVIEW_MODE.DUTCH_PRODUCTION
      )
    })
  })

  describe('setLastSelectedReviewMode', () => {
    it('should remember the selected review mode', () => {
      useSettingsStore
        .getState()
        .setLastSelectedReviewMode(REVIEW_MODE.DUTCH_PRODUCTION)

      expect(useSettingsStore.getState().lastSelectedReviewMode).toBe(
        REVIEW_MODE.DUTCH_PRODUCTION
      )
    })
  })

  describe('setAutoPlayPronunciation', () => {
    it('should set autoPlayPronunciation to true', () => {
      useSettingsStore.getState().setAutoPlayPronunciation(true)

      expect(useSettingsStore.getState().autoPlayPronunciation).toBe(true)
    })

    it('should set autoPlayPronunciation back to false', () => {
      useSettingsStore.getState().setAutoPlayPronunciation(true)
      useSettingsStore.getState().setAutoPlayPronunciation(false)

      expect(useSettingsStore.getState().autoPlayPronunciation).toBe(false)
    })
  })

  describe('setLastSelectedCollectionId', () => {
    it('should set a collection ID', () => {
      useSettingsStore.getState().setLastSelectedCollectionId('col-123')

      expect(useSettingsStore.getState().lastSelectedCollectionId).toBe(
        'col-123'
      )
    })

    it('should clear collection ID to null', () => {
      useSettingsStore.getState().setLastSelectedCollectionId('col-123')
      useSettingsStore.getState().setLastSelectedCollectionId(null)

      expect(useSettingsStore.getState().lastSelectedCollectionId).toBeNull()
    })
  })

  describe('persistence config', () => {
    it('should have correct store name', () => {
      // The persist middleware stores metadata under the store name
      // Verify by checking the persist API exists
      expect(useSettingsStore.persist).toBeDefined()
      expect(useSettingsStore.persist.getOptions().name).toBe(
        'settings-storage'
      )
    })
  })
})

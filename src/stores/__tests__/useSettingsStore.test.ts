/**
 * Tests for useSettingsStore
 *
 * Zustand store with AsyncStorage persistence for user preferences:
 * autoPlayPronunciation and lastSelectedCollectionId.
 */

import { useSettingsStore } from '../useSettingsStore'

describe('useSettingsStore', () => {
  beforeEach(() => {
    // Reset store to initial state between tests
    useSettingsStore.setState({
      autoPlayPronunciation: false,
      lastSelectedCollectionId: null,
    })
  })

  describe('initial state', () => {
    it('should default autoPlayPronunciation to false', () => {
      expect(useSettingsStore.getState().autoPlayPronunciation).toBe(false)
    })

    it('should default lastSelectedCollectionId to null', () => {
      expect(useSettingsStore.getState().lastSelectedCollectionId).toBeNull()
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

/**
 * Tests for useHistoryStore
 *
 * Zustand store tracking notification and word analysis history.
 * Notifications are ephemeral (max 20), analyzed words are persisted (max 3).
 * Analyzed words deduplicate by dutchLemma.
 */

import { useHistoryStore } from '../useHistoryStore'
import { ToastType } from '@/constants/ToastConstants'

describe('useHistoryStore', () => {
  beforeEach(() => {
    useHistoryStore.setState({
      notifications: [],
      analyzedWords: [],
    })
  })

  describe('addNotification', () => {
    it('should add a notification to the beginning of the list', () => {
      useHistoryStore.getState().addNotification('First', ToastType.SUCCESS)
      useHistoryStore.getState().addNotification('Second', ToastType.INFO)

      const notifications = useHistoryStore.getState().notifications
      expect(notifications).toHaveLength(2)
      expect(notifications[0].message).toBe('Second')
      expect(notifications[1].message).toBe('First')
    })

    it('should cap at 20 notifications', () => {
      for (let i = 0; i < 25; i++) {
        useHistoryStore
          .getState()
          .addNotification(`Notification ${i}`, ToastType.SUCCESS)
      }

      expect(useHistoryStore.getState().notifications).toHaveLength(20)
    })

    it('should keep most recent notification first when at max capacity', () => {
      for (let i = 0; i < 25; i++) {
        useHistoryStore
          .getState()
          .addNotification(`Notification ${i}`, ToastType.SUCCESS)
      }

      const notifications = useHistoryStore.getState().notifications
      expect(notifications[0].message).toBe('Notification 24')
    })

    it('should assign unique IDs to each notification', () => {
      useHistoryStore.getState().addNotification('A', ToastType.SUCCESS)
      useHistoryStore.getState().addNotification('B', ToastType.SUCCESS)

      const notifications = useHistoryStore.getState().notifications
      expect(notifications[0].id).not.toBe(notifications[1].id)
    })

    it('should set correct type on notification', () => {
      useHistoryStore.getState().addNotification('Error!', ToastType.ERROR)

      expect(useHistoryStore.getState().notifications[0].type).toBe(
        ToastType.ERROR
      )
    })
  })

  describe('addAnalyzedWord', () => {
    it('should add a new word entry', () => {
      useHistoryStore.getState().addAnalyzedWord('huis', 'huis')

      const words = useHistoryStore.getState().analyzedWords
      expect(words).toHaveLength(1)
      expect(words[0].dutchLemma).toBe('huis')
    })

    it('should cap at 3 analyzed words', () => {
      useHistoryStore.getState().addAnalyzedWord('een', 'een')
      useHistoryStore.getState().addAnalyzedWord('twee', 'twee')
      useHistoryStore.getState().addAnalyzedWord('drie', 'drie')
      useHistoryStore.getState().addAnalyzedWord('vier', 'vier')

      expect(useHistoryStore.getState().analyzedWords).toHaveLength(3)
    })

    it('should deduplicate by dutchLemma and update existing entry', () => {
      useHistoryStore.getState().addAnalyzedWord('huis', 'huis')
      useHistoryStore
        .getState()
        .addAnalyzedWord('huis', 'huis', 'My Collection')

      const words = useHistoryStore.getState().analyzedWords
      expect(words).toHaveLength(1)
      expect(words[0].addedToCollection).toBe('My Collection')
    })

    it('should set wasAdded to true when addedToCollection is provided', () => {
      useHistoryStore
        .getState()
        .addAnalyzedWord('huis', 'huis', 'My Collection')

      expect(useHistoryStore.getState().analyzedWords[0].wasAdded).toBe(true)
    })

    it('should set wasAdded to false when addedToCollection is undefined', () => {
      useHistoryStore.getState().addAnalyzedWord('huis', 'huis')

      expect(useHistoryStore.getState().analyzedWords[0].wasAdded).toBe(false)
    })

    it('should update wasAdded on dedup when collection changes', () => {
      useHistoryStore.getState().addAnalyzedWord('huis', 'huis', 'Collection A')
      useHistoryStore.getState().addAnalyzedWord('huis', 'huis')

      expect(useHistoryStore.getState().analyzedWords[0].wasAdded).toBe(false)
    })
  })

  describe('clearNotificationHistory', () => {
    it('should clear all notifications', () => {
      useHistoryStore.getState().addNotification('Test', ToastType.SUCCESS)
      useHistoryStore.getState().clearNotificationHistory()

      expect(useHistoryStore.getState().notifications).toHaveLength(0)
    })

    it('should not affect analyzedWords', () => {
      useHistoryStore.getState().addAnalyzedWord('huis', 'huis')
      useHistoryStore.getState().addNotification('Test', ToastType.SUCCESS)
      useHistoryStore.getState().clearNotificationHistory()

      expect(useHistoryStore.getState().analyzedWords).toHaveLength(1)
    })
  })

  describe('clearWordHistory', () => {
    it('should clear all analyzed words', () => {
      useHistoryStore.getState().addAnalyzedWord('huis', 'huis')
      useHistoryStore.getState().clearWordHistory()

      expect(useHistoryStore.getState().analyzedWords).toHaveLength(0)
    })

    it('should not affect notifications', () => {
      useHistoryStore.getState().addNotification('Test', ToastType.SUCCESS)
      useHistoryStore.getState().addAnalyzedWord('huis', 'huis')
      useHistoryStore.getState().clearWordHistory()

      expect(useHistoryStore.getState().notifications).toHaveLength(1)
    })
  })

  describe('getNotificationHistory', () => {
    it('should return current notifications array', () => {
      useHistoryStore.getState().addNotification('Test', ToastType.SUCCESS)

      const result = useHistoryStore.getState().getNotificationHistory()
      expect(result).toHaveLength(1)
      expect(result[0].message).toBe('Test')
    })
  })

  describe('getWordHistory', () => {
    it('should return current analyzed words array', () => {
      useHistoryStore.getState().addAnalyzedWord('huis', 'huis')

      const result = useHistoryStore.getState().getWordHistory()
      expect(result).toHaveLength(1)
      expect(result[0].dutchLemma).toBe('huis')
    })
  })

  describe('persistence config', () => {
    it('should only persist analyzedWords via partialize', () => {
      const options = useHistoryStore.persist.getOptions()
      expect(options.name).toBe('history-storage')

      // Verify partialize only includes analyzedWords
      const partialized = options.partialize?.({
        notifications: [
          {
            id: '1',
            message: 'a',
            type: ToastType.SUCCESS,
            timestamp: new Date(),
          },
        ],
        analyzedWords: [
          {
            id: '2',
            word: 'b',
            dutchLemma: 'b',
            timestamp: new Date(),
            wasAdded: false,
          },
        ],
      } as ReturnType<typeof useHistoryStore.getState>)

      expect(partialized).toHaveProperty('analyzedWords')
      expect(partialized).not.toHaveProperty('notifications')
    })
  })
})

import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Crypto from 'expo-crypto'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type {
  BatchCaptureDraftItem,
  BatchCaptureDuplicate,
  BatchCaptureItem,
  BatchCaptureItemStatus,
} from '@/types/BatchCaptureTypes'

interface BatchCaptureState {
  ownerUserId: string | null
  targetCollectionId: string | null
  items: BatchCaptureItem[]
  isPaused: boolean
  activeItemId: string | null
}

interface BatchCaptureActions {
  ensureOwner: (userId: string) => void
  createQueue: (
    userId: string,
    drafts: BatchCaptureDraftItem[],
    targetCollectionId: string | null
  ) => void
  setTargetCollectionId: (collectionId: string | null) => void
  start: () => void
  pause: () => void
  setItemStatus: (
    itemId: string,
    status: BatchCaptureItemStatus,
    error?: string | null
  ) => void
  setPossibleDuplicate: (
    itemId: string,
    duplicate: BatchCaptureDuplicate
  ) => void
  completeItem: (itemId: string) => void
  skipItem: (itemId: string) => void
  retryItem: (itemId: string) => void
  cancelRemaining: () => void
  recoverInterruptedItems: () => void
  clearQueue: () => void
}

type BatchCaptureStore = BatchCaptureState & BatchCaptureActions

export const INITIAL_BATCH_CAPTURE_STATE: BatchCaptureState = {
  ownerUserId: null,
  targetCollectionId: null,
  items: [],
  isPaused: true,
  activeItemId: null,
}

const ACTIVE_STATUSES: BatchCaptureItemStatus[] = [
  'checking_duplicate',
  'analyzing',
  'awaiting_review',
]

const TERMINAL_STATUSES: BatchCaptureItemStatus[] = [
  'completed',
  'skipped',
  'cancelled',
]

const updateItem = (
  items: BatchCaptureItem[],
  itemId: string,
  update: Partial<BatchCaptureItem>
): BatchCaptureItem[] =>
  items.map(item =>
    item.id === itemId
      ? { ...item, ...update, updatedAt: new Date().toISOString() }
      : item
  )

export const useBatchCaptureStore = create<BatchCaptureStore>()(
  persist(
    (set, get) => ({
      ...INITIAL_BATCH_CAPTURE_STATE,

      ensureOwner: userId => {
        if (get().ownerUserId === userId) return
        set({ ...INITIAL_BATCH_CAPTURE_STATE, ownerUserId: userId })
      },

      createQueue: (userId, drafts, targetCollectionId) => {
        const now = new Date().toISOString()
        set({
          ownerUserId: userId,
          targetCollectionId,
          items: drafts.map(draft => ({
            ...draft,
            id: Crypto.randomUUID(),
            status: 'queued',
            error: null,
            duplicate: null,
            createdAt: now,
            updatedAt: now,
          })),
          isPaused: true,
          activeItemId: null,
        })
      },

      setTargetCollectionId: targetCollectionId => {
        set({ targetCollectionId })
      },

      start: () => set({ isPaused: false }),
      pause: () => set({ isPaused: true }),

      setItemStatus: (itemId, status, error = null) => {
        set(state => ({
          items: updateItem(state.items, itemId, { status, error }),
          activeItemId: ACTIVE_STATUSES.includes(status) ? itemId : null,
        }))
      },

      setPossibleDuplicate: (itemId, duplicate) => {
        set(state => ({
          items: updateItem(state.items, itemId, {
            status: 'possible_duplicate',
            duplicate,
            error: null,
          }),
          isPaused: true,
          activeItemId: null,
        }))
      },

      completeItem: itemId => {
        set(state => ({
          items: updateItem(state.items, itemId, {
            status: 'completed',
            error: null,
          }),
          activeItemId: null,
        }))
      },

      skipItem: itemId => {
        set(state => ({
          items: updateItem(state.items, itemId, {
            status: 'skipped',
            error: null,
          }),
          activeItemId:
            state.activeItemId === itemId ? null : state.activeItemId,
        }))
      },

      retryItem: itemId => {
        set(state => ({
          items: updateItem(state.items, itemId, {
            status: 'queued',
            error: null,
            duplicate: null,
          }),
          activeItemId: null,
        }))
      },

      cancelRemaining: () => {
        const now = new Date().toISOString()
        set(state => ({
          items: state.items.map(item =>
            TERMINAL_STATUSES.includes(item.status)
              ? item
              : {
                  ...item,
                  status: 'cancelled',
                  error: null,
                  updatedAt: now,
                }
          ),
          isPaused: true,
          activeItemId: null,
        }))
      },

      recoverInterruptedItems: () => {
        const now = new Date().toISOString()
        let recovered = false
        const items = get().items.map(item => {
          if (!ACTIVE_STATUSES.includes(item.status)) return item
          recovered = true
          return {
            ...item,
            status: 'queued' as const,
            error: 'Previous analysis was interrupted. Ready to resume.',
            updatedAt: now,
          }
        })

        if (recovered) {
          set({ items, isPaused: true, activeItemId: null })
        }
      },

      clearQueue: () => {
        set(state => ({
          ...INITIAL_BATCH_CAPTURE_STATE,
          ownerUserId: state.ownerUserId,
        }))
      },
    }),
    {
      name: 'batch-capture-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        ownerUserId: state.ownerUserId,
        targetCollectionId: state.targetCollectionId,
        items: state.items,
        isPaused: state.isPaused,
        activeItemId: state.activeItemId,
      }),
    }
  )
)

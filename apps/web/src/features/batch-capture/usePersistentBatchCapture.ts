'use client'

import type { BatchCaptureDraftItem } from '@woordenaar/domain'
import { useCallback, useMemo, useSyncExternalStore } from 'react'
import {
  createBatchCaptureState,
  createEmptyBatchCaptureState,
  recoverBatchCaptureState,
  serializeBatchCaptureState,
  updateBatchCaptureItem,
} from './batch-capture-domain'
import type { WebBatchCaptureItem, WebBatchCaptureState } from './types'

const STORAGE_KEY = 'woordenaar.batch-capture.v1'
const listeners = new Set<() => void>()

let browserState: WebBatchCaptureState | null = null
let browserScopeKey = ''

interface PersistentBatchCaptureOptions {
  collectionIds: string[]
  defaultCollectionId: string
  userId: string
}

const getScopeKey = (userId: string, collectionIds: string[]): string =>
  `${userId}|${collectionIds.join(',')}`

const readStoredValue = (): unknown => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored ? (JSON.parse(stored) as unknown) : null
  } catch {
    return null
  }
}

const getBrowserState = ({
  collectionIds,
  defaultCollectionId,
  userId,
}: PersistentBatchCaptureOptions): WebBatchCaptureState => {
  const scopeKey = getScopeKey(userId, collectionIds)
  if (browserState && browserScopeKey === scopeKey) return browserState

  browserState = recoverBatchCaptureState(
    readStoredValue(),
    userId,
    collectionIds,
    defaultCollectionId,
    new Date().toISOString()
  )
  browserScopeKey = scopeKey
  return browserState
}

const commitBrowserState = (state: WebBatchCaptureState): void => {
  browserState = state
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(serializeBatchCaptureState(state))
    )
  } catch {
    // Keep the queue usable in memory when browser storage is unavailable.
  }
  listeners.forEach(listener => listener())
}

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function usePersistentBatchCapture(
  options: PersistentBatchCaptureOptions
) {
  const { collectionIds, defaultCollectionId, userId } = options
  const scopeOptions = useMemo(
    () => ({ collectionIds, defaultCollectionId, userId }),
    [collectionIds, defaultCollectionId, userId]
  )
  const serverSnapshot = useMemo(
    () => createEmptyBatchCaptureState(userId, defaultCollectionId),
    [defaultCollectionId, userId]
  )
  const getSnapshot = useCallback(
    () => getBrowserState(scopeOptions),
    [scopeOptions]
  )
  const getServerSnapshot = useCallback(() => serverSnapshot, [serverSnapshot])
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const updateState = useCallback(
    (update: (current: WebBatchCaptureState) => WebBatchCaptureState): void => {
      commitBrowserState(update(getBrowserState(scopeOptions)))
    },
    [scopeOptions]
  )

  const createQueue = useCallback(
    (drafts: BatchCaptureDraftItem[], targetCollectionId: string) => {
      commitBrowserState(
        createBatchCaptureState(
          userId,
          targetCollectionId,
          drafts,
          () => window.crypto.randomUUID(),
          new Date().toISOString()
        )
      )
    },
    [userId]
  )

  const patchItem = useCallback(
    (itemId: string, update: Partial<WebBatchCaptureItem>) => {
      updateState(current => ({
        ...current,
        items: updateBatchCaptureItem(
          current.items,
          itemId,
          update,
          new Date().toISOString()
        ),
        activeItemId:
          update.status === 'checking_duplicate' ||
          update.status === 'analyzing'
            ? itemId
            : current.activeItemId === itemId
              ? null
              : current.activeItemId,
      }))
    },
    [updateState]
  )

  const setPaused = useCallback(
    (isPaused: boolean) => {
      updateState(current => ({ ...current, isPaused }))
    },
    [updateState]
  )

  const setTargetCollectionId = useCallback(
    (targetCollectionId: string) => {
      updateState(current => ({ ...current, targetCollectionId }))
    },
    [updateState]
  )

  const cancelRemaining = useCallback(() => {
    const now = new Date().toISOString()
    updateState(current => ({
      ...current,
      items: current.items.map(item =>
        ['completed', 'skipped', 'cancelled'].includes(item.status)
          ? item
          : {
              ...item,
              status: 'cancelled',
              analysis: null,
              analysisMetadata: null,
              error: null,
              updatedAt: now,
            }
      ),
      isPaused: true,
      activeItemId: null,
    }))
  }, [updateState])

  const clearQueue = useCallback(() => {
    commitBrowserState(
      createEmptyBatchCaptureState(userId, defaultCollectionId)
    )
  }, [defaultCollectionId, userId])

  return {
    state,
    createQueue,
    patchItem,
    setPaused,
    setTargetCollectionId,
    cancelRemaining,
    clearQueue,
  }
}

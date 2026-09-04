'use client'

import type { BatchCaptureDraftItem } from '@woordenaar/domain'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import { findOwnedSemanticDuplicate } from '@/features/analysis/actions'
import { analyzeWordWithAi } from '@/features/analysis/analysis-client'
import { serializeWordAnalysis } from '@/features/analysis/analysis-contract'
import { useWebSettings } from '@/features/settings/useWebSettings'
import type { CollectionOption } from '@/features/words/repository'
import { findOwnedLemmaDuplicateForBatch } from './actions'
import { BatchCaptureComposer } from './BatchCaptureComposer'
import { BatchCaptureQueue } from './BatchCaptureQueue'
import { BatchReviewPanel } from './BatchReviewPanel'
import { usePersistentBatchCapture } from './usePersistentBatchCapture'
import type { WebBatchCaptureItem } from './types'

interface BatchCaptureWorkspaceProps {
  collections: CollectionOption[]
  userId: string
}

export function BatchCaptureWorkspace({
  collections,
  userId,
}: BatchCaptureWorkspaceProps) {
  const collectionIds = useMemo(
    () => collections.map(collection => collection.id),
    [collections]
  )
  const { isHydrated, settings } = useWebSettings(userId)
  const preferredCollectionId = collections.some(
    collection => collection.id === settings.lastSelectedCollectionId
  )
    ? settings.lastSelectedCollectionId
    : null
  const defaultCollectionId =
    (isHydrated ? preferredCollectionId : null) ?? collections[0]?.id ?? ''
  const {
    cancelRemaining,
    clearQueue,
    createQueue,
    patchItem,
    setPaused,
    setTargetCollectionId,
    state,
  } = usePersistentBatchCapture({
    collectionIds,
    defaultCollectionId,
    userId,
  })
  const processingRef = useRef(false)

  useEffect(() => {
    if (
      !isHydrated ||
      state.items.length > 0 ||
      !preferredCollectionId ||
      state.targetCollectionId === preferredCollectionId
    ) {
      return
    }
    setTargetCollectionId(preferredCollectionId)
  }, [
    isHydrated,
    preferredCollectionId,
    setTargetCollectionId,
    state.items.length,
    state.targetCollectionId,
  ])

  const processItem = useCallback(
    async (item: WebBatchCaptureItem) => {
      if (!item.bypassLemmaDuplicate) {
        patchItem(item.id, {
          status: 'checking_duplicate',
          error: null,
        })
        const duplicate = await findOwnedLemmaDuplicateForBatch(item.dutchText)
        if (duplicate) {
          patchItem(item.id, {
            status: 'possible_duplicate',
            duplicate,
            error: null,
          })
          setPaused(true)
          return
        }
      }

      patchItem(item.id, { status: 'analyzing', error: null })
      const result = await analyzeWordWithAi(userId, item.dutchText)
      let semanticDuplicate = null
      let duplicateWarning: string | null = null
      try {
        semanticDuplicate = await findOwnedSemanticDuplicate(
          serializeWordAnalysis(result.analysis)
        )
      } catch {
        duplicateWarning =
          'Duplicate check is temporarily unavailable. Saving will check again.'
      }

      patchItem(item.id, {
        status: 'awaiting_review',
        analysis: result.analysis,
        analysisMetadata: result.metadata,
        semanticDuplicate,
        error: duplicateWarning,
      })
      setPaused(true)
    },
    [patchItem, setPaused, userId]
  )

  useEffect(() => {
    if (state.isPaused || state.activeItemId || processingRef.current) {
      return
    }

    const nextItem = state.items.find(item => item.status === 'queued')
    if (!nextItem) return

    processingRef.current = true
    void processItem(nextItem)
      .catch(error => {
        patchItem(nextItem.id, {
          status: 'failed',
          error:
            error instanceof Error
              ? error.message
              : 'Could not analyze this item.',
        })
        setPaused(true)
      })
      .finally(() => {
        processingRef.current = false
      })
  }, [patchItem, processItem, setPaused, state])

  const resumeItem = (itemId: string, bypassLemmaDuplicate: boolean) => {
    patchItem(itemId, {
      status: 'queued',
      error: null,
      duplicate: null,
      bypassLemmaDuplicate,
    })
    setPaused(false)
  }

  const resolveItem = (itemId: string, status: 'completed' | 'skipped') => {
    patchItem(itemId, {
      status,
      analysis: null,
      analysisMetadata: null,
      semanticDuplicate: null,
      error: null,
    })
    setPaused(false)
  }

  if (state.items.length === 0) {
    return (
      <BatchCaptureComposer
        collections={collections}
        defaultCollectionId={defaultCollectionId}
        onCreateQueue={(items: BatchCaptureDraftItem[], collectionId) =>
          createQueue(items, collectionId)
        }
      />
    )
  }

  const reviewItem = state.items.find(
    item => item.status === 'awaiting_review' && item.analysis
  )
  const targetCollection =
    collections.find(
      collection => collection.id === state.targetCollectionId
    ) ?? collections[0]

  return (
    <div className="grid gap-6">
      {reviewItem && targetCollection && (
        <BatchReviewPanel
          collectionId={targetCollection.id}
          collectionName={targetCollection.name}
          item={reviewItem}
          onSaved={itemId => resolveItem(itemId, 'completed')}
          onSkip={itemId => resolveItem(itemId, 'skipped')}
          userId={userId}
        />
      )}
      <BatchCaptureQueue
        activeItemId={state.activeItemId}
        collections={collections}
        isPaused={state.isPaused}
        items={state.items}
        onAnalyzeDuplicate={itemId => resumeItem(itemId, true)}
        onCancelRemaining={cancelRemaining}
        onClear={clearQueue}
        onPause={() => setPaused(true)}
        onRetry={itemId => resumeItem(itemId, false)}
        onSkip={itemId => resolveItem(itemId, 'skipped')}
        onStart={() => setPaused(false)}
        onTargetCollectionChange={setTargetCollectionId}
        targetCollectionId={state.targetCollectionId}
      />
    </div>
  )
}

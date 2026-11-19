'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  findOwnedSemanticDuplicate,
  saveWordToCollection,
} from '@/features/analysis/actions'
import { analyzeForCollection } from '@/features/analysis/analyze-for-collection'
import { savePublishedWord } from '@/features/analysis/save-published-word'
import { markAnalysisHistorySaved } from '@/features/history/analysis-history'
import { serializeWordAnalysis } from '@/features/analysis/analysis-contract'
import { useWebSettings } from '@/features/settings/useWebSettings'
import type { CollectionOption } from '@/features/words/repository'
import { findOwnedLemmaDuplicateForBatch } from './actions'
import { BatchCaptureComposer } from './BatchCaptureComposer'
import { BatchCaptureQueue } from './BatchCaptureQueue'
import {
  isBatchItemReadyToSave,
  selectedMeaningIndex,
} from './batch-capture-domain'
import { usePersistentBatchCapture } from './usePersistentBatchCapture'
import type { WebBatchCaptureItem } from './types'

interface BatchCaptureWorkspaceProps {
  followingEnabled: boolean
  collections: CollectionOption[]
  userId: string
}

export function BatchCaptureWorkspace({
  collections,
  followingEnabled,
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
    stopAutoSave,
    setTargetCollectionId,
    state,
  } = usePersistentBatchCapture({
    collectionIds,
    defaultCollectionId,
    userId,
  })
  const processingRef = useRef(false)
  const savingRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const analysisPending =
    state.activeItemId !== null ||
    state.items.some(item => item.status === 'queued')
  const targetCollection =
    collections.find(
      collection => collection.id === state.targetCollectionId
    ) ?? collections[0]

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
    async (
      item: WebBatchCaptureItem
    ): Promise<Partial<WebBatchCaptureItem>> => {
      if (!item.bypassLemmaDuplicate) {
        patchItem(item.id, {
          status: 'checking_duplicate',
          error: null,
        })
        const duplicate = await findOwnedLemmaDuplicateForBatch(item.dutchText)
        if (duplicate) {
          return { status: 'possible_duplicate', duplicate, error: null }
        }
      }

      patchItem(item.id, { status: 'analyzing', error: null })
      const result = await analyzeForCollection(
        userId,
        item.dutchText,
        followingEnabled
      )
      if (result.kind === 'published') {
        return {
          status: 'awaiting_review',
          published: result.document,
          analysis: null,
          error: null,
        }
      }
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

      if (semanticDuplicate) {
        return {
          status: 'skipped',
          duplicate: semanticDuplicate,
          error: 'Already exists in your vocabulary.',
        }
      }

      return {
        status: 'awaiting_review',
        analysis: result.analysis,
        analysisMetadata: result.metadata,
        semanticDuplicate: null,
        error: duplicateWarning,
      }
    },
    [followingEnabled, patchItem, userId]
  )

  useEffect(() => {
    if (state.isPaused || state.activeItemId || processingRef.current) {
      return
    }

    const nextItem = state.items.find(item => item.status === 'queued')
    if (!nextItem) return

    processingRef.current = true
    void processItem(nextItem)
      .catch((error: unknown): Partial<WebBatchCaptureItem> => ({
        status: 'failed',
        error:
          error instanceof Error
            ? error.message
            : 'Could not analyze this item.',
      }))
      .then(update => {
        processingRef.current = false
        patchItem(nextItem.id, update)
      })
  }, [patchItem, processItem, state])

  const resumeItem = (itemId: string, bypassLemmaDuplicate: boolean) => {
    patchItem(itemId, {
      status: 'queued',
      error: null,
      duplicate: null,
      bypassLemmaDuplicate,
    })
    setPaused(false)
  }

  const resolveItem = useCallback(
    (
      itemId: string,
      status: 'completed' | 'skipped',
      error: string | null = null
    ) => {
      patchItem(itemId, {
        status,
        analysis: null,
        analysisMetadata: null,
        published: null,
        semanticDuplicate: null,
        importIntent: undefined,
        error,
      })
    },
    [patchItem]
  )

  const saveReady = useCallback(async () => {
    if (analysisPending || savingRef.current || !targetCollection) return
    const ready = state.items.filter(isBatchItemReadyToSave)
    if (!ready.length) {
      if (state.autoSave) stopAutoSave()
      return
    }
    savingRef.current = true
    setSaving(true)
    stopAutoSave()
    try {
      for (const item of ready) {
        const entry = item.published?.entries[selectedMeaningIndex(item) ?? -1]
        try {
          const result = entry
            ? await savePublishedWord({
                userId,
                collectionId: targetCollection.id,
                entry,
                previousIntent: item.importIntent,
                onIntent: importIntent => patchItem(item.id, { importIntent }),
              })
            : item.analysis &&
              (await saveWordToCollection(
                userId,
                targetCollection.id,
                serializeWordAnalysis(item.analysis)
              ))
          if (!result) continue
          if (!result.success) {
            if (result.duplicate)
              resolveItem(item.id, 'skipped', result.message)
            else patchItem(item.id, { error: result.message })
            continue
          }
          if (item.analysis) {
            markAnalysisHistorySaved(
              userId,
              item.analysis.dutchLemma,
              targetCollection.name
            )
          }
          resolveItem(item.id, 'completed')
        } catch (error) {
          patchItem(item.id, {
            error:
              error instanceof Error
                ? error.message
                : 'Could not save this word.',
          })
        }
      }
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [
    analysisPending,
    patchItem,
    resolveItem,
    state.autoSave,
    state.items,
    stopAutoSave,
    targetCollection,
    userId,
  ])

  useEffect(() => {
    if (!state.autoSave || state.isPaused || analysisPending) return
    const timer = window.setTimeout(() => {
      void saveReady()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [analysisPending, saveReady, state.autoSave, state.isPaused])

  if (state.items.length === 0) {
    return (
      <BatchCaptureComposer
        collections={collections}
        defaultCollectionId={defaultCollectionId}
        onCreateQueue={createQueue}
      />
    )
  }

  return (
    <div className="grid gap-6">
      <BatchCaptureQueue
        activeItemId={state.activeItemId}
        analysisPending={analysisPending}
        autoSave={state.autoSave === true}
        saving={saving}
        onSaveReady={() => {
          void saveReady()
        }}
        onSelectMeaning={(id, meaningIndex) =>
          patchItem(id, { meaningIndex, error: null })
        }
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

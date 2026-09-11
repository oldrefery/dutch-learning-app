import { useCallback, useEffect, useMemo, useState } from 'react'
import { router } from 'expo-router'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { ROUTES } from '@/constants/Routes'
import { Sentry } from '@/lib/sentry'
import {
  starterPackService,
  StarterPackValidationError,
} from '@/services/starterPackService'
import { officialContentCatalogService } from '@/services/officialContentCatalogService'
import { useApplicationStore } from '@/stores/useApplicationStore'
import type {
  ImportPreviewData,
  ImportTargetCollection,
  WordSelectionItem,
} from '@/types/ImportTypes'
import type { StarterPackManifest } from '@/types/StarterPackTypes'
import {
  buildImportWordSelections,
  getImportSuccessMessage,
} from '@/utils/importSelection'

export const NEW_STARTER_COLLECTION_ID = '__new_starter_collection__'

interface StarterPackLoadResult {
  manifest: StarterPackManifest | null
  previewData: ImportPreviewData | null
  error: string | null
}

export interface StarterPackImportSuccess {
  collectionId: string
  collectionName: string
  importedCount: number
}

interface RequestedOfficialPack {
  packId?: string
  version?: string
}

const loadStarterPack = (): StarterPackLoadResult => {
  try {
    const manifest = starterPackService.loadOfficialDutchA1Pack()
    return {
      manifest,
      previewData: starterPackService.getStarterPackPreview(manifest),
      error: null,
    }
  } catch (error) {
    const message =
      error instanceof StarterPackValidationError
        ? 'The bundled starter pack is invalid and cannot be imported.'
        : 'The bundled starter pack could not be loaded.'

    Sentry.captureException(error, {
      tags: { operation: 'loadStarterPack' },
    })
    return { manifest: null, previewData: null, error: message }
  }
}

export function useStarterPackImport(
  requestedPack: RequestedOfficialPack = {}
) {
  const bundledPack = useMemo(() => loadStarterPack(), [])
  const hasRemoteRequest = Boolean(
    requestedPack.packId || requestedPack.version
  )
  const hasCompleteRemoteRequest = Boolean(
    requestedPack.packId && requestedPack.version
  )
  const [pack, setPack] = useState<StarterPackLoadResult>(() =>
    hasRemoteRequest
      ? {
          manifest: null,
          previewData: null,
          error: hasCompleteRemoteRequest
            ? null
            : 'The selected official pack link is incomplete.',
        }
      : bundledPack
  )
  const [loading, setLoading] = useState(
    hasCompleteRemoteRequest ||
      (!hasRemoteRequest && Boolean(bundledPack.previewData))
  )
  const [wordSelections, setWordSelections] = useState<WordSelectionItem[]>([])
  const [collections, setCollections] = useState<ImportTargetCollection[]>([])
  const [targetCollectionId, setTargetCollectionId] = useState<string | null>(
    NEW_STARTER_COLLECTION_ID
  )
  const [importing, setImporting] = useState(false)
  const [hideDuplicates, setHideDuplicates] = useState(true)
  const [success, setSuccess] = useState<StarterPackImportSuccess | null>(null)
  const [remoteLoadAttempt, setRemoteLoadAttempt] = useState(0)

  useEffect(() => {
    if (!requestedPack.packId || !requestedPack.version) {
      return undefined
    }

    let active = true
    void officialContentCatalogService
      .getPack(requestedPack.packId, requestedPack.version)
      .then(({ manifest }) => {
        if (!active) return
        const mobileManifest = manifest as unknown as StarterPackManifest
        setPack({
          manifest: mobileManifest,
          previewData: starterPackService.getStarterPackPreview(mobileManifest),
          error: null,
        })
      })
      .catch(error => {
        if (!active) return
        Sentry.captureException(error, {
          tags: { operation: 'loadRemoteOfficialPack' },
        })
        setPack({
          manifest: null,
          previewData: null,
          error:
            'This official pack could not be downloaded and is not cached on this device.',
        })
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [remoteLoadAttempt, requestedPack.packId, requestedPack.version])

  useEffect(() => {
    const previewData = pack.previewData
    if (!previewData) return undefined

    let active = true

    void useApplicationStore
      .getState()
      .fetchCollections()
      .then(() => {
        if (!active) return
        const state = useApplicationStore.getState()
        setCollections([
          {
            collection_id: NEW_STARTER_COLLECTION_ID,
            name: `Create “${previewData.collection.name}”`,
          },
          ...state.collections.map(collection => ({
            collection_id: collection.collection_id,
            name: collection.name,
          })),
        ])
        setWordSelections(
          buildImportWordSelections(
            previewData.words,
            state.words,
            state.collections
          )
        )
      })
      .catch(error => {
        if (!active) return
        Sentry.captureException(error, {
          tags: { operation: 'prepareStarterPackImport' },
        })
        const state = useApplicationStore.getState()
        setCollections([
          {
            collection_id: NEW_STARTER_COLLECTION_ID,
            name: `Create “${previewData.collection.name}”`,
          },
          ...state.collections.map(collection => ({
            collection_id: collection.collection_id,
            name: collection.name,
          })),
        ])
        setWordSelections(
          buildImportWordSelections(
            previewData.words,
            state.words,
            state.collections
          )
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [pack.previewData])

  const retryRemotePack = useCallback(() => {
    if (requestedPack.packId && requestedPack.version) {
      setPack({ manifest: null, previewData: null, error: null })
      setWordSelections([])
      setCollections([])
      setTargetCollectionId(NEW_STARTER_COLLECTION_ID)
      setImporting(false)
      setHideDuplicates(true)
      setSuccess(null)
      setLoading(true)
      setRemoteLoadAttempt(previous => previous + 1)
    }
  }, [requestedPack.packId, requestedPack.version])

  const toggleWordSelection = useCallback((wordId: string) => {
    setWordSelections(previous =>
      previous.map(item =>
        item.word.word_id === wordId && !item.isDuplicate
          ? { ...item, selected: !item.selected }
          : item
      )
    )
  }, [])

  const toggleSelectAll = useCallback(() => {
    setWordSelections(previous => {
      const availableWords = previous.filter(item => !item.isDuplicate)
      const allAvailableSelected = availableWords.every(item => item.selected)
      return previous.map(item =>
        item.isDuplicate ? item : { ...item, selected: !allAvailableSelected }
      )
    })
  }, [])

  const resolveTargetCollection = useCallback(async () => {
    if (!pack.manifest || !targetCollectionId) return null
    if (targetCollectionId !== NEW_STARTER_COLLECTION_ID) {
      const existingCollection = collections.find(
        collection => collection.collection_id === targetCollectionId
      )
      return existingCollection
        ? {
            collection_id: existingCollection.collection_id,
            name: existingCollection.name,
          }
        : null
    }

    const collection = await useApplicationStore
      .getState()
      .createNewCollection(pack.manifest.title)
    return collection
      ? { collection_id: collection.collection_id, name: collection.name }
      : null
  }, [collections, pack.manifest, targetCollectionId])

  const handleImport = useCallback(async () => {
    if (!pack.manifest || !targetCollectionId) {
      ToastService.show('Please select a collection first', ToastType.ERROR)
      return
    }

    const releaseReady = starterPackService.isStarterPackReleaseReady(
      pack.manifest
    )
    if (!releaseReady && !__DEV__) {
      ToastService.show(
        'This starter pack is awaiting language review.',
        ToastType.ERROR
      )
      return
    }

    const selectedEntryIds = wordSelections
      .filter(item => item.selected && !item.isDuplicate)
      .map(item => item.word.word_id)
    if (selectedEntryIds.length === 0) {
      ToastService.show(
        'Please select at least one word to import',
        ToastType.ERROR
      )
      return
    }

    setImporting(true)
    try {
      const targetCollection = await resolveTargetCollection()
      if (!targetCollection) {
        const storeMessage = useApplicationStore.getState().error?.userMessage
        ToastService.show(
          storeMessage ?? 'Unable to create or resolve the target collection',
          ToastType.ERROR
        )
        return
      }

      const stateBeforeImport = useApplicationStore.getState()
      const importWords = starterPackService.createStarterPackImportWords(
        pack.manifest,
        selectedEntryIds,
        new Date().toISOString().split('T')[0]
      )
      const imported = await stateBeforeImport.addWordsToCollection(
        targetCollection.collection_id,
        importWords
      )
      if (!imported) {
        const storeMessage = useApplicationStore.getState().error?.userMessage
        ToastService.show(
          storeMessage ?? 'Starter pack import failed',
          ToastType.ERROR
        )
        return
      }

      const importedCount = Math.max(
        useApplicationStore.getState().words.length -
          stateBeforeImport.words.length,
        0
      )
      ToastService.show(
        getImportSuccessMessage(selectedEntryIds.length, importedCount),
        ToastType.SUCCESS
      )
      setSuccess({
        collectionId: targetCollection.collection_id,
        collectionName: targetCollection.name,
        importedCount,
      })
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'importStarterPack' },
        extra: {
          packId: pack.manifest.pack_id,
          selectedCount: selectedEntryIds.length,
          targetCollectionId,
        },
      })
      ToastService.show(
        error instanceof Error
          ? error.message
          : 'Failed to import the starter pack.',
        ToastType.ERROR
      )
    } finally {
      setImporting(false)
    }
  }, [
    pack.manifest,
    resolveTargetCollection,
    targetCollectionId,
    wordSelections,
  ])

  const availableWords = wordSelections.filter(item => !item.isDuplicate)
  const selectedCount = wordSelections.filter(item => item.selected).length
  const duplicateCount = wordSelections.filter(item => item.isDuplicate).length
  const allAvailableSelected = availableWords.every(item => item.selected)
  const visibleWordSelections = hideDuplicates
    ? wordSelections.filter(item => !item.isDuplicate)
    : wordSelections
  const importEnabled = Boolean(
    pack.manifest &&
    (starterPackService.isStarterPackReleaseReady(pack.manifest) || __DEV__)
  )

  return {
    loading,
    manifest: pack.manifest,
    previewData: pack.previewData,
    error: pack.error,
    wordSelections: visibleWordSelections,
    collections,
    targetCollectionId,
    importing,
    success,
    selectedCount,
    duplicateCount,
    allAvailableSelected,
    hideDuplicates,
    importEnabled,
    setTargetCollectionId,
    toggleWordSelection,
    toggleSelectAll,
    toggleHideDuplicates: () => setHideDuplicates(previous => !previous),
    retryRemotePack,
    handleImport,
    handleGoBack: () => router.back(),
    handleStartReview: () => router.replace(ROUTES.TABS.REVIEW),
    handleBackToCollections: () => router.replace(ROUTES.TABS.COLLECTIONS),
  }
}

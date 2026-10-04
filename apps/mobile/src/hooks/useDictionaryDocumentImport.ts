import { useEffect, useRef, useState } from 'react'
import { collectionRepository } from '@/db/collectionRepository'
import { wordRepository } from '@/db/wordRepository'
import { useApplicationStore } from '@/stores/useApplicationStore'
import {
  importOfflineDictionaryCollection,
  previewDictionaryTransfer,
} from '@/services/dictionaryTransferService'
import { buildImportWordSelections } from '@/utils/importSelection'
import type {
  ImportPreviewData,
  ImportTargetCollection,
  WordSelectionItem,
} from '@/types/ImportTypes'

export function useDictionaryDocumentImport(owner: string) {
  const [text, setText] = useState('')
  const [preview, setPreview] = useState<ImportPreviewData | null>(null)
  const [selections, setSelections] = useState<WordSelectionItem[]>([])
  const [collections, setCollections] = useState<ImportTargetCollection[]>([])
  const [target, setTarget] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{
    importedCount: number
    skippedCount: number
  } | null>(null)
  const active = useRef(true)
  const inFlight = useRef(false)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const isCurrent = () =>
    active.current && useApplicationStore.getState().currentUserId === owner

  const run = async (operation: () => Promise<void>) => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      await operation()
    } catch (cause) {
      if (isCurrent())
        setError(
          cause instanceof Error ? cause.message : 'Dictionary import failed.'
        )
    } finally {
      inFlight.current = false
      if (isCurrent()) setBusy(false)
    }
  }

  const prepare = () =>
    run(async () => {
      if (!isCurrent()) return
      const documentPreview = previewDictionaryTransfer(text)
      const [ownedCollections, words] = await Promise.all([
        collectionRepository.getCollectionsByUserId(owner),
        wordRepository.getWordsByUserId(owner),
      ])
      if (!isCurrent()) return
      if (!ownedCollections.length)
        throw new Error(
          'An existing collection is required. Create one before importing.'
        )
      setCollections(ownedCollections)
      setTarget(ownedCollections[0].collection_id)
      setSelections(
        buildImportWordSelections(
          documentPreview.words,
          words,
          ownedCollections
        )
      )
      setPreview(documentPreview)
    })

  const importSelected = () =>
    run(async () => {
      if (success || !target || !isCurrent()) return
      const result = await importOfflineDictionaryCollection(
        text,
        target,
        selections
          .filter(item => item.selected && !item.isDuplicate)
          .map(item => item.word.word_id),
        owner
      )
      if (!isCurrent()) return
      // Persistence is already complete; a cache reload failure must not offer a second import.
      setSuccess(result)
      try {
        await useApplicationStore.getState().fetchWords()
      } catch {
        if (isCurrent())
          setError(
            'Words were saved. Reopen the collection to refresh the list.'
          )
      }
    })

  const toggleWord = (id: string) =>
    setSelections(previous =>
      previous.map(item =>
        item.word.word_id === id && !item.isDuplicate
          ? { ...item, selected: !item.selected }
          : item
      )
    )
  const allSelected = selections
    .filter(item => !item.isDuplicate)
    .every(item => item.selected)
  const toggleAll = () =>
    setSelections(previous =>
      previous.map(item =>
        item.isDuplicate ? item : { ...item, selected: !allSelected }
      )
    )

  return {
    text,
    setText,
    preview,
    selections,
    collections,
    target,
    setTarget: (id: string) => {
      if (!inFlight.current) setTarget(id)
    },
    busy,
    error,
    success,
    prepare,
    importSelected,
    toggleWord,
    toggleAll,
    allSelected,
    selectedCount: selections.filter(item => item.selected && !item.isDuplicate)
      .length,
    duplicateCount: selections.filter(item => item.isDuplicate).length,
  }
}

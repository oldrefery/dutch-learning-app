import { useCallback, useMemo } from 'react'
import { useRouter } from 'expo-router'
import { TextThemed } from '@/components/Themed'
import { isDictionaryFollowingEnabled } from '@/constants/dictionaryContent'
import { PublishedMeaningAddWord } from '@/components/PublishedMeaningAddWord'
import { useSettingsStore } from '@/stores/useSettingsStore'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { completeCreationBatchItem } from '@/services/dictionaryCreationBatchCompletion'
import type { DictionaryCreationJournalRow } from '@woordenaar/domain'
import { LegacyAddWordScreen, type AddWordScreenProps } from './AddWordScreen'

export function AddWordScreen(props: AddWordScreenProps) {
  const router = useRouter()
  const ownerId = useApplicationStore(state => state.currentUserId)
  const rows = useApplicationStore(state => state.collections)
  const lastCollectionId = useSettingsStore(
    state => state.lastSelectedCollectionId
  )
  const collections = useMemo(() => {
    const owned = rows.filter(row => row.user_id === ownerId)
    const preferred = owned.some(
      row => row.collection_id === props.preselectedCollectionId
    )
      ? props.preselectedCollectionId
      : lastCollectionId
    return [
      ...owned.filter(row => row.collection_id === preferred),
      ...owned.filter(row => row.collection_id !== preferred),
    ].map(row => ({ collection_id: row.collection_id, name: row.name }))
  }, [rows, ownerId, props.preselectedCollectionId, lastCollectionId])
  const onLoaded = useCallback(
    async (row: DictionaryCreationJournalRow, assertCurrent: () => void) => {
      if (!props.batchItemId) return
      if (!ownerId || !props.initialWord)
        throw new Error('Batch capture context is unavailable')
      await completeCreationBatchItem(
        row,
        {
          ownerId,
          itemId: props.batchItemId,
          originalQuery: props.initialWord,
          targetCollectionId: props.preselectedCollectionId,
        },
        assertCurrent
      )
    },
    [
      ownerId,
      props.batchItemId,
      props.initialWord,
      props.preselectedCollectionId,
    ]
  )
  if (!isDictionaryFollowingEnabled()) return <LegacyAddWordScreen {...props} />
  if (!ownerId) return <TextThemed>Sign in to add a shared meaning.</TextThemed>
  return (
    <PublishedMeaningAddWord
      key={`${ownerId}:${props.preselectedCollectionId ?? ''}:${props.batchItemId ?? ''}:${props.initialWord ?? ''}`}
      ownerId={ownerId}
      collections={collections}
      initialWord={props.initialWord}
      onLoaded={onLoaded}
      onClose={() => router.back()}
    />
  )
}

import React, { useState } from 'react'
import { Button } from 'react-native'
import { TextThemed, ViewThemed } from './Themed'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { dictionaryImportSync } from '@/services/dictionaryImportSync'
import { syncManager } from '@/services/syncManager'
import { isDictionaryContentEnabled } from '@/constants/dictionaryContent'
import { Colors } from '@/constants/Colors'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import type { Word } from '@/types/database'

function ImportConflict({ word }: { word: Word }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const currentUserId = useApplicationStore(state => state.currentUserId)
  const hasConflict = useApplicationStore(state =>
    state.words.some(
      candidate =>
        candidate.word_id === word.word_id &&
        candidate.user_id === word.user_id &&
        candidate.dictionary_import_conflict
    )
  )
  const theme = useNormalizedColorScheme()
  if (currentUserId !== word.user_id || !hasConflict) return null
  const retry = async () => {
    setBusy(true)
    setError(null)
    try {
      await dictionaryImportSync.retryConflict(word.user_id, word.word_id)
      await useApplicationStore.getState().fetchWords()
      void syncManager.performSync(word.user_id)
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not retry the import. Try again.'
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <ViewThemed>
      <TextThemed>
        This import conflicts with a card saved on another device.
      </TextThemed>
      <TextThemed>
        Your local card, private edits and learning history are saved. Both
        cards keep their own progress. Retry after resolving the other card on
        its device.
      </TextThemed>
      {error && <TextThemed accessibilityRole="alert">{error}</TextThemed>}
      <Button
        title="Retry saved import"
        disabled={busy}
        onPress={retry}
        color={Colors[theme].tint}
      />
    </ViewThemed>
  )
}

export function DictionaryImportConflictResolver({ word }: { word: Word }) {
  if (!isDictionaryContentEnabled() || !word.dictionary_import_conflict)
    return null
  return <ImportConflict key={`${word.user_id}:${word.word_id}`} word={word} />
}

import React, { useState } from 'react'
import { Button } from 'react-native'
import { TextThemed, ViewThemed } from './Themed'
import { useApplicationStore } from '@/stores/useApplicationStore'
import {
  dictionaryContentSync,
  type DictionaryConflictSnapshot,
} from '@/services/dictionaryContentSync'
import { syncManager } from '@/services/syncManager'
import { formatWordForCopying } from '@/utils/wordTextFormatter'
import { applyDictionaryMaterialization } from '@/db/dictionaryWordMaterialization'
import type { Word } from '@/types/database'
import type { DictionaryContent } from '@woordenaar/domain'
import { Colors } from '@/constants/Colors'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'

const describeContent = (word: Word, content: DictionaryContent): string =>
  formatWordForCopying(
    applyDictionaryMaterialization(word, {
      word_id: word.word_id,
      content_version: 0,
      reference: null,
      dependency_status: 'ready',
      effective: { content, source: 'fallback', removed_fields: [] },
      cefr: {
        level: null,
        status: 'unknown',
        reason: 'unlinked-or-missing-revision',
      },
    })
  )

export function DictionaryConflictResolver({ word }: { word: Word }) {
  const [snapshot, setSnapshot] = useState<DictionaryConflictSnapshot | null>(
    null
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const currentUserId = useApplicationStore(state => state.currentUserId)
  const hasConflict = useApplicationStore(state =>
    state.words.some(
      candidate =>
        candidate.word_id === word.word_id &&
        candidate.user_id === word.user_id &&
        candidate.dictionary_content_conflict
    )
  )
  const theme = useNormalizedColorScheme()
  if (!hasConflict || currentUserId !== word.user_id) return null

  const compare = async () => {
    setBusy(true)
    setError(null)
    try {
      setSnapshot(
        await dictionaryContentSync.readConflict(word.user_id, word.word_id)
      )
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not load versions. Try again.'
      )
    } finally {
      setBusy(false)
    }
  }
  const resolve = async (choice: 'local' | 'server') => {
    if (!snapshot) return
    setBusy(true)
    setError(null)
    try {
      await dictionaryContentSync.resolveConflict(snapshot, choice)
      setSnapshot(null)
      await useApplicationStore.getState().fetchWords()
      void syncManager.performSync(word.user_id)
    } catch (failure) {
      setSnapshot(null)
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not resolve the conflict. Try again.'
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <ViewThemed>
      <TextThemed>
        Your edits conflict with changes from another device.
      </TextThemed>
      {error && <TextThemed accessibilityRole="alert">{error}</TextThemed>}
      {!snapshot ? (
        <Button
          title="Compare versions"
          disabled={busy}
          onPress={compare}
          color={Colors[theme].tint}
        />
      ) : (
        <>
          <TextThemed>Your version</TextThemed>
          <TextThemed selectable>
            {describeContent(word, snapshot.localContent)}
          </TextThemed>
          <TextThemed>Server version</TextThemed>
          <TextThemed selectable>
            {describeContent(word, snapshot.remoteContent)}
          </TextThemed>
          <TextThemed>
            Keeping your version makes it private. Using the server version
            replaces your pending content edits. Learning progress is preserved.
          </TextThemed>
          <Button
            title="Keep my version"
            disabled={busy}
            onPress={() => resolve('local')}
            color={Colors[theme].tint}
          />
          <Button
            title="Use server version"
            disabled={busy}
            onPress={() => resolve('server')}
            color={Colors[theme].tint}
          />
        </>
      )}
    </ViewThemed>
  )
}

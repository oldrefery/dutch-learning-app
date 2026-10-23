import React, { useEffect, useRef, useState } from 'react'
import { Button } from 'react-native'
import { TextThemed, ViewThemed } from './Themed'
import { useApplicationStore } from '@/stores/useApplicationStore'
import {
  dictionaryContentSync,
  type DictionaryConflictSnapshot,
} from '@/services/dictionaryContentSync'
import { syncManager } from '@/services/syncManager'
import { formatWordForCopying } from '@/utils/wordTextFormatter'
import type { Word } from '@/types/database'
import {
  dictionaryModeReconciliation,
  type DictionaryModeConflictSnapshot,
} from '@/services/dictionaryModeReconciliation'
import { projectDictionaryReadWord } from '@/db/dictionaryReadProjection'
import { supabase } from '@/lib/supabase'
import { Colors } from '@/constants/Colors'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'

const describeContent = (word: Word, content: unknown): string => {
  const projected = projectDictionaryReadWord(word, content)
  return [
    formatWordForCopying(projected),
    projected.analysis_notes && `Analysis notes: ${projected.analysis_notes}`,
    projected.usage_notes && `Usage: ${JSON.stringify(projected.usage_notes)}`,
    projected.conjugation &&
      `Conjugation: ${JSON.stringify(projected.conjugation)}`,
    projected.image_url && `Image: ${projected.image_url}`,
    projected.tts_url && `Audio: ${projected.tts_url}`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

const describeAllContent = (content: object): string =>
  Object.entries(content)
    .map(
      ([field, value]) =>
        `${field.replaceAll('_', ' ')}: ${JSON.stringify(value, null, 2)}`
    )
    .join('\n\n')

function ConflictResolverSession({ word }: { word: Word }) {
  const [snapshot, setSnapshot] = useState<
    DictionaryConflictSnapshot | DictionaryModeConflictSnapshot | null
  >(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const theme = useNormalizedColorScheme()
  const lifetime = useRef({ active: true, changed: false })
  useEffect(() => {
    const mounted = lifetime.current
    mounted.active = true
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || session?.user.id !== word.user_id) {
        mounted.changed = true
        setSnapshot(null)
      }
    })
    return () => {
      mounted.active = false
      subscription.unsubscribe()
    }
  }, [lifetime, word.user_id])
  const assertCurrent = () => {
    const state = useApplicationStore.getState()
    if (
      !lifetime.current.active ||
      lifetime.current.changed ||
      state.currentUserId !== word.user_id ||
      !state.words.some(
        candidate =>
          candidate.word_id === word.word_id &&
          candidate.user_id === word.user_id
      )
    )
      throw new Error(
        'The account or word changed. Reopen the word to compare versions.'
      )
  }

  const compare = async () => {
    setBusy(true)
    setError(null)
    try {
      assertCurrent()
      const loaded = await dictionaryContentSync.readConflict(
        word.user_id,
        word.word_id,
        assertCurrent
      )
      assertCurrent()
      setSnapshot(loaded)
    } catch (failure) {
      if (!lifetime.current.active || lifetime.current.changed) return
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not load versions. Try again.'
      )
    } finally {
      if (lifetime.current.active) setBusy(false)
    }
  }
  const resolve = async (choice: 'local' | 'server') => {
    if (!snapshot) return
    setBusy(true)
    setError(null)
    try {
      assertCurrent()
      await dictionaryContentSync.resolveConflict(
        snapshot,
        choice,
        assertCurrent
      )
      assertCurrent()
      setSnapshot(null)
      void syncManager.performSync(word.user_id)
      await useApplicationStore.getState().fetchWords()
    } catch (failure) {
      if (!lifetime.current.active || lifetime.current.changed) return
      setSnapshot(null)
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not resolve the conflict. Try again.'
      )
    } finally {
      if (lifetime.current.active) setBusy(false)
    }
  }
  const applying = useRef(false)
  const applyMode = async () => {
    if (!snapshot || !('kind' in snapshot) || applying.current) return
    applying.current = true
    setBusy(true)
    setError(null)
    try {
      assertCurrent()
      await dictionaryModeReconciliation.apply(snapshot, assertCurrent)
      assertCurrent()
      await useApplicationStore.getState().fetchWords()
      if (lifetime.current.active) setSnapshot(null)
    } catch (failure) {
      if (lifetime.current.active && !lifetime.current.changed)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Could not load the selected content. Try again.'
        )
      // Keep the decision ID: a refresh failure can retry without replaying writes.
    } finally {
      applying.current = false
      if (lifetime.current.active) setBusy(false)
    }
  }
  const modeConflict = snapshot && 'kind' in snapshot
  return (
    <ViewThemed>
      <TextThemed>This word has content changes to review.</TextThemed>
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
            {modeConflict
              ? describeAllContent(snapshot.localContent)
              : describeContent(word, snapshot.localContent)}
          </TextThemed>
          <TextThemed>Server version</TextThemed>
          <TextThemed selectable>
            {modeConflict
              ? describeAllContent(snapshot.remoteContent)
              : describeContent(word, snapshot.remoteContent)}
          </TextThemed>
          {modeConflict ? (
            <>
              <TextThemed>
                {snapshot.remote.card.mode === 'follow'
                  ? 'The server word uses shared analysis.'
                  : 'The server word returned to legacy content.'}{' '}
                Your saved private content and pending edits need a reviewed
                decision. Loading the server version retains the saved originals
                and pending edits for later review. Learning progress is
                preserved.
              </TextThemed>
              <Button
                title="Load server version and retain saved edits"
                disabled={busy}
                onPress={applyMode}
                color={Colors[theme].tint}
              />
              <Button
                title="Reload comparison"
                disabled={busy}
                onPress={compare}
                color={Colors[theme].tint}
              />
              <Button
                title="Keep pending for review"
                disabled={busy}
                onPress={() => {
                  try {
                    assertCurrent()
                    setSnapshot(null)
                    setError(
                      'Your saved content and pending edits are retained for review.'
                    )
                  } catch (failure) {
                    setSnapshot(null)
                    setError(
                      failure instanceof Error
                        ? failure.message
                        : 'Reopen the word to compare versions.'
                    )
                  }
                }}
                color={Colors[theme].tint}
              />
            </>
          ) : (
            <>
              <TextThemed>
                Keeping your version makes it private. Using the server version
                replaces your pending content edits. Learning progress is
                preserved.
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
        </>
      )}
    </ViewThemed>
  )
}

export function DictionaryConflictResolver({ word }: { word: Word }) {
  const currentUserId = useApplicationStore(state => state.currentUserId)
  const hasConflict = useApplicationStore(state =>
    state.words.some(
      candidate =>
        candidate.word_id === word.word_id &&
        candidate.user_id === word.user_id &&
        candidate.dictionary_content_conflict
    )
  )
  if (!hasConflict || currentUserId !== word.user_id) return null
  return (
    <ConflictResolverSession
      key={`${word.user_id}:${word.word_id}`}
      word={word}
    />
  )
}

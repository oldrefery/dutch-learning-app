import React, { useState } from 'react'
import { Button } from 'react-native'
import { TextThemed, ViewThemed } from './Themed'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useDictionaryImportRecovery } from '@/hooks/useDictionaryImportRecovery'
import { isDictionaryContentEnabled } from '@/constants/dictionaryContent'
import { Colors } from '@/constants/Colors'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import type { Word } from '@/types/database'
import { importRecoveryStyles } from '@/styles/DictionaryImportRecovery.styles'

const issueText = {
  pending: 'This saved import is waiting for delivery.',
  error: 'This saved import could not be delivered.',
  'identity-conflict':
    'This import conflicts with a card saved on another device. Resolve that card on its device before retrying.',
  'state-conflict':
    'Another recovery changed this card. Read its current server state before retrying.',
  'placement-conflict':
    'This card moved on another device. Read its current server placement before retrying.',
  'target-unavailable':
    'This card’s collection is unavailable. Choose an existing collection to recover its placement.',
  unverified:
    'This card was saved before import recovery was available. Its exact import record is missing. Automatic recovery is unavailable.',
}

function ImportRecovery({ word }: { word: Word }) {
  const state = useDictionaryImportRecovery(word)
  const [target, setTarget] = useState<string | null>(null)
  const owner = useApplicationStore(store => store.currentUserId)
  const current = useApplicationStore(store =>
    store.words.find(
      candidate =>
        candidate.word_id === word.word_id && candidate.user_id === word.user_id
    )
  )
  const collections = useApplicationStore(store => store.collections)
  const theme = useNormalizedColorScheme()
  if (owner !== word.user_id || !current) return null
  const issue =
    current.dictionary_import_recovery ??
    (current.dictionary_import_conflict ? 'identity-conflict' : null)
  if (!issue) return null
  const owned = collections.filter(collection => collection.user_id === owner)
  const remote = state.snapshot?.state
  const placement =
    remote?.collection_id === null
      ? 'No collection'
      : (owned.find(
          collection => collection.collection_id === remote?.collection_id
        )?.name ?? 'Another collection')
  const canRecover = remote?.state === 'active' || remote?.state === 'uncreated'
  return (
    <ViewThemed style={importRecoveryStyles.controls}>
      <TextThemed>{issueText[issue]}</TextThemed>
      <TextThemed>
        Your local card, private edits and learning history remain saved.
        Recovery keeps this card’s progress separate from other cards.
      </TextThemed>
      {state.error && (
        <TextThemed accessibilityRole="alert">{state.error}</TextThemed>
      )}
      {state.notice && (
        <TextThemed accessibilityRole="text">{state.notice}</TextThemed>
      )}
      {state.invalidated ? (
        <TextThemed>
          Authentication changed. Reopen Saved imports to continue.
        </TextThemed>
      ) : (
        issue !== 'unverified' && (
          <>
            <Button
              title="Read current server state"
              disabled={state.busy}
              onPress={state.read}
              color={Colors[theme].tint}
            />
            {remote && (
              <TextThemed>
                {remote.state === 'active'
                  ? `Current server placement: ${placement}`
                  : remote.state === 'uncreated'
                    ? 'This card has not been created on the server.'
                    : 'The original card is unavailable or cancelled. It cannot be recreated by recovery.'}
              </TextThemed>
            )}
            {canRecover && (
              <>
                <TextThemed>
                  Choose an existing collection. Confirming saves a new recovery
                  attempt; server changes may still require another explicit
                  retry.
                </TextThemed>
                {owned.map(collection => (
                  <Button
                    key={collection.collection_id}
                    title={`${target === collection.collection_id ? 'Selected: ' : ''}${collection.name}`}
                    disabled={state.busy}
                    onPress={() => setTarget(collection.collection_id)}
                    color={Colors[theme].tint}
                  />
                ))}
                {owned.length === 0 && (
                  <TextThemed>
                    No existing collection is available for recovery.
                  </TextThemed>
                )}
                <Button
                  title="Confirm recovery"
                  disabled={
                    state.busy ||
                    !owned.some(
                      collection => collection.collection_id === target
                    )
                  }
                  onPress={() => target && state.recover(target)}
                  color={Colors[theme].tint}
                />
              </>
            )}
          </>
        )
      )}
    </ViewThemed>
  )
}

export function DictionaryImportConflictResolver({ word }: { word: Word }) {
  if (
    !isDictionaryContentEnabled() ||
    (!word.dictionary_import_conflict && !word.dictionary_import_recovery)
  )
    return null
  return <ImportRecovery key={`${word.user_id}:${word.word_id}`} word={word} />
}

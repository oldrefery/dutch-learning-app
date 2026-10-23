import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { TextInput, Pressable } from 'react-native'
import * as Crypto from 'expo-crypto'
import {
  createDictionaryCreationAction,
  dictionaryCreationMessage,
  normalizeDictionaryMeaningQuery,
  creationPublishedReference,
  type DictionaryCreationJournalRow,
} from '@woordenaar/domain'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import {
  isDictionarySharedAnalysisEnabled,
  isDictionaryFollowingImportsEnabled,
} from '@/constants/dictionaryContent'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { createMobileCreationAdoptionService } from '@/services/dictionaryCreationAdoptionService'
import type { ImportTargetCollection } from '@/types/ImportTypes'
import { createMobileDictionaryCreationService } from '@/services/dictionaryCreationService'
import { supabase } from '@/lib/supabase'
import { followingTransferStyles as styles } from '@/styles/DictionaryFollowingTransfer.styles'

function Control({
  label,
  disabled,
  onPress,
}: {
  label: string
  disabled: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.button}
    >
      <TextThemed>{label}</TextThemed>
    </Pressable>
  )
}

export function DictionaryCreationPanel({
  ownerId,
  originalQuery,
  noMatch,
  collections,
  onLoaded,
}: {
  ownerId: string
  originalQuery: string
  noMatch: boolean
  collections: ImportTargetCollection[]
  onLoaded?: (
    row: DictionaryCreationJournalRow,
    assertCurrent: () => void
  ) => void | Promise<void>
}) {
  const colors = Colors[useNormalizedColorScheme()]
  const changed = useRef(false)
  const action = useMemo(
    () =>
      createDictionaryCreationAction({
        userId: ownerId,
        originalQuery,
        createId: Crypto.randomUUID,
        enabled: isDictionarySharedAnalysisEnabled,
        adoption: {
          enabled: isDictionaryFollowingImportsEnabled,
          targetCollections: () => collections.map(row => row.collection_id),
          connect: (assertCurrent, signal) =>
            createMobileCreationAdoptionService(ownerId, assertCurrent, signal),
          onLoaded,
        },
        connect: (assertCurrent, signal) =>
          createMobileDictionaryCreationService(ownerId, assertCurrent, signal),
      }),
    [ownerId, originalQuery, collections, onLoaded]
  )
  const state = useSyncExternalStore(
    action.subscribe,
    action.getSnapshot,
    action.getServerSnapshot
  )
  const [hint, setHint] = useState('')
  const [target, setTarget] = useState(collections[0]?.collection_id ?? '')
  const [page, setPage] = useState(0)
  useEffect(
    () =>
      action.start(invalidate => {
        if (changed.current) invalidate()
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_OUT' || session?.user.id !== ownerId) {
            changed.current = true
            invalidate()
          }
        })
        return () => subscription.unsubscribe()
      }),
    [action, ownerId]
  )
  const selected = state.rows.find(
    row => row.session.request.resolution_id === state.selectedId
  )
  const sameWord = state.rows.some(row => {
    try {
      return (
        normalizeDictionaryMeaningQuery(row.session.request.original_query) ===
        normalizeDictionaryMeaningQuery(originalQuery)
      )
    } catch {
      return row.session.request.original_query === originalQuery
    }
  })
  const disabled = state.busy || state.blocked
  const newWorkDisabled =
    disabled || !state.loaded || !isDictionarySharedAnalysisEnabled()
  const importEnabled = isDictionaryFollowingImportsEnabled()
  const rows = state.rows.slice(page * 10, (page + 1) * 10)
  return (
    <ViewThemed style={styles.content}>
      <TextThemed>Shared meaning requests</TextThemed>
      <Control
        label={state.busy ? 'Loading request…' : 'Load saved requests'}
        disabled={disabled}
        onPress={() => {
          void action.restore()
        }}
      />
      {state.error && (
        <TextThemed selectable accessibilityRole="alert">
          {state.error}
        </TextThemed>
      )}
      {rows.map((row, index) => (
        <Control
          key={row.session.request.resolution_id}
          label={`Open saved request ${page * 10 + index + 1}: ${row.session.request.original_query}`}
          disabled={disabled || !state.loaded}
          onPress={() => action.select(row.session.request.resolution_id)}
        />
      ))}
      {page > 0 && (
        <Control
          label="Previous saved requests"
          disabled={disabled}
          onPress={() => setPage(page - 1)}
        />
      )}
      {(page + 1) * 10 < state.rows.length && (
        <Control
          label="More saved requests"
          disabled={disabled}
          onPress={() => setPage(page + 1)}
        />
      )}
      {selected && (
        <ViewThemed style={styles.section}>
          <TextThemed selectable>
            Original word: {selected.session.request.original_query}
          </TextThemed>
          <TextThemed selectable>
            Meaning hint: {selected.session.request.meaning_hint}
          </TextThemed>
          <TextThemed selectable>
            {dictionaryCreationMessage(selected)}
          </TextThemed>
          <Control
            label="Check saved request status"
            disabled={disabled || !state.loaded}
            onPress={() => {
              void action.checkStatus()
            }}
          />
          {!selected.session.resolution &&
            !selected.session.command &&
            !selected.session.submitted && (
              <Control
                label="Resolve saved meaning"
                disabled={newWorkDisabled}
                onPress={() => {
                  void action.resolveSaved()
                }}
              />
            )}
          {selected.session.resolution?.outcome === 'new-meaning' &&
            !selected.session.submitted && (
              <Control
                label="Create shared meaning"
                disabled={newWorkDisabled}
                onPress={() => {
                  void action.create()
                }}
              />
            )}
          {creationPublishedReference(selected.session) && (
            <ViewThemed style={styles.section}>
              {!selected.adoption && (
                <ViewThemed style={styles.section}>
                  <TextThemed>Add published meaning to collection</TextThemed>
                  {collections.map(row => (
                    <Control
                      key={row.collection_id}
                      label={`Select collection: ${row.name}`}
                      disabled={disabled}
                      onPress={() => setTarget(row.collection_id)}
                    />
                  ))}
                  <TextThemed>
                    Selected collection:{' '}
                    {collections.find(row => row.collection_id === target)
                      ?.name ?? 'Choose a collection'}
                  </TextThemed>
                </ViewThemed>
              )}
              {(!selected.adoption || !selected.adoption.submitted) && (
                <Control
                  label="Add published meaning"
                  disabled={
                    disabled ||
                    !state.loaded ||
                    !importEnabled ||
                    (!selected.adoption &&
                      !collections.some(row => row.collection_id === target))
                  }
                  onPress={() => {
                    void action.adopt(
                      selected.adoption?.request.collection_id ?? target
                    )
                  }}
                />
              )}
              {selected.adoption && (
                <ViewThemed style={styles.section}>
                  <TextThemed>
                    Saved import destination:{' '}
                    {collections.find(
                      row =>
                        row.collection_id ===
                        selected.adoption?.request.collection_id
                    )?.name ?? 'Original collection'}
                  </TextThemed>
                  <Control
                    label="Check saved import"
                    disabled={disabled || !state.loaded}
                    onPress={() => {
                      void action.checkImport()
                    }}
                  />
                  {selected.adoption.submitted &&
                    !selected.adoption.response && (
                      <Control
                        label="Confirm saved import"
                        disabled={
                          disabled ||
                          !state.loaded ||
                          (!importEnabled &&
                            !state.importStates[
                              selected.session.request.resolution_id
                            ]?.inserted_once)
                        }
                        onPress={() => {
                          void action.confirmImport()
                        }}
                      />
                    )}
                  {selected.adoption.response?.outcome === 'inserted' && (
                    <Control
                      label="Load added card"
                      disabled={disabled || !state.loaded}
                      onPress={() => {
                        void action.loadImport()
                      }}
                    />
                  )}
                  {selected.adoption.response?.outcome ===
                    'identity-conflict' && (
                    <ViewThemed>
                      <TextThemed>
                        This meaning already exists in your vocabulary. No new
                        card was added.
                      </TextThemed>
                      <Control
                        label="Load existing card"
                        disabled={disabled || !state.loaded}
                        onPress={() => {
                          void action.loadImport(true)
                        }}
                      />
                    </ViewThemed>
                  )}
                  {state.importStates[
                    selected.session.request.resolution_id
                  ] && (
                    <TextThemed>
                      Saved import status:{' '}
                      {
                        state.importStates[
                          selected.session.request.resolution_id
                        ].state
                      }
                    </TextThemed>
                  )}
                  {state.loadedImports[
                    selected.session.request.resolution_id
                  ] && (
                    <TextThemed>
                      The personal card and shared content are loaded.
                    </TextThemed>
                  )}
                </ViewThemed>
              )}
            </ViewThemed>
          )}
        </ViewThemed>
      )}
      {noMatch && state.loaded && !sameWord && !state.blocked && (
        <ViewThemed style={styles.section}>
          <TextThemed>
            Describe the intended meaning. A hint does not approve a new
            meaning.
          </TextThemed>
          <TextInput
            accessibilityLabel="Meaning hint"
            value={hint}
            maxLength={1000}
            editable={!disabled}
            onChangeText={setHint}
            style={[styles.button, { color: colors.text }]}
          />
          <Control
            label="Resolve intended meaning"
            disabled={newWorkDisabled || !hint.trim()}
            onPress={() => {
              void action.resolveNew(hint)
            }}
          />
        </ViewThemed>
      )}
      {noMatch && sameWord && (
        <TextThemed>
          Continue the saved request for this word. Its original meaning hint is
          retained.
        </TextThemed>
      )}
      <TextThemed>
        Creation requires full access and server approval. Generation and
        independent checking normally use two analysis quota slots. Publication
        does not add a personal card.
      </TextThemed>
    </ViewThemed>
  )
}

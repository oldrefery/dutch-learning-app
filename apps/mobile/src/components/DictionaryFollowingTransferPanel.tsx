import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { FlatList, TouchableOpacity } from 'react-native'
import * as Crypto from 'expo-crypto'
import * as Clipboard from 'expo-clipboard'
import {
  createDictionaryFollowingTransferAction,
  followingTransferEntryMessage,
  FOLLOWING_TRANSFER_SELECTION_LIMIT,
  type DictionaryCollectionExportV2,
  type SharedDictionaryCollectionV2,
  sharedCollectionFollowingSource,
} from '@woordenaar/domain'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { dictionaryFollowingTransferService as service } from '@/services/dictionaryFollowingTransferService'
import {
  loadFollowingImport,
  loadFollowingExistingCard,
} from '@/services/dictionaryFollowingImportHydration'
import { dictionaryFollowingImportService as imports } from '@/services/dictionaryFollowingImportService'
import { isDictionaryFollowingImportsEnabled } from '@/constants/dictionaryContent'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { supabase } from '@/lib/supabase'
import { followingTransferStyles as styles } from '@/styles/DictionaryFollowingTransfer.styles'
import type { ImportTargetCollection } from '@/types/ImportTypes'
import type { OfficialContentManifest } from '@woordenaar/content/manifest'
import { officialFollowingDocument } from '@woordenaar/content/dictionary'
import { parseDictionaryCollectionExportV2 } from '@woordenaar/domain'
import { prepareOfficialFollowingImport } from '@/services/officialFollowingImport'

import { prepareSharedFollowingImport } from '@/services/sharedFollowingImport'

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
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.button}
    >
      <TextThemed>{label}</TextThemed>
    </TouchableOpacity>
  )
}
export function DictionaryFollowingTransferPanel({
  ownerId,
  title,
  onCloseLabel,
  document: inputDocument,
  officialManifest,
  sharedSource,
  collections,
  onClose,
}: {
  ownerId: string
  title?: string
  onCloseLabel?: string
  document?: DictionaryCollectionExportV2
  officialManifest?: OfficialContentManifest
  sharedSource?: { shareToken: string; original: SharedDictionaryCollectionV2 }
  collections: ImportTargetCollection[]
  onClose: () => void
}) {
  const document = useMemo(
    () =>
      officialManifest
        ? parseDictionaryCollectionExportV2(
            officialFollowingDocument(officialManifest)
          )
        : sharedSource
          ? sharedCollectionFollowingSource(
              sharedSource.shareToken,
              sharedSource.original
            ).document
          : inputDocument,
    [officialManifest, sharedSource, inputDocument]
  )
  const changed = useRef(false)
  const action = useMemo(
    () =>
      createDictionaryFollowingTransferAction({
        userId: ownerId,
        enabled: isDictionaryFollowingImportsEnabled,
        createId: Crypto.randomUUID,
        list: () => service.list(ownerId),
        listOperations: () => imports.list(ownerId),
        prepare: service.prepare,
        prepareSource: officialManifest
          ? assert =>
              prepareOfficialFollowingImport(ownerId, officialManifest, assert)
          : sharedSource
            ? assert =>
                prepareSharedFollowingImport(
                  ownerId,
                  sharedSource.shareToken,
                  sharedSource.original,
                  assert
                )
            : undefined,
        resolve: id => service.resolve(ownerId, id),
        queueEntry: (id, index) => service.queueEntry(ownerId, id, index),
        deliverEntry: (id, index) => service.deliverEntry(ownerId, id, index),
        readState: imports.readState,
        prepareOperation: imports.prepare,
        deliverOperation: imports.deliver,
        targetCollections: () => collections.map(row => row.collection_id),
        load: loadFollowingImport,
        loadExisting: loadFollowingExistingCard,
      }),
    [ownerId, collections, officialManifest, sharedSource]
  )
  const state = useSyncExternalStore(
    action.subscribe,
    action.getSnapshot,
    action.getServerSnapshot
  )
  const [target, setTarget] = useState(collections[0]?.collection_id ?? '')
  const [recoveryTargets, setRecoveryTargets] = useState<
    Record<number, string>
  >({})
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [copyError, setCopyError] = useState<string | null>(null)
  useEffect(
    () =>
      action.start(invalidate => {
        const verify = () => {
          if (
            changed.current ||
            useApplicationStore.getState().currentUserId !== ownerId
          ) {
            changed.current = true
            invalidate()
          }
        }
        const unsubscribeStore = useApplicationStore.subscribe(verify)
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_OUT' || session?.user.id !== ownerId)
            changed.current = true
          verify()
        })
        verify()
        return () => {
          unsubscribeStore()
          subscription.unsubscribe()
        }
      }),
    [action, ownerId]
  )
  if (state.blocked)
    return <TextThemed accessibilityRole="alert">{state.error}</TextThemed>
  const saved = state.sessions.find(
    row => row.session_id === state.selectedSessionId
  )
  const shown = saved?.document ?? document
  const disabled = state.busy || !state.loaded
  const enabled = isDictionaryFollowingImportsEnabled()
  const copyOriginal = async () => {
    try {
      action.assertCurrent()
      if (!saved) return
      await Clipboard.setStringAsync(JSON.stringify(saved.document))
      action.assertCurrent()
      setCopyError(null)
    } catch {
      try {
        action.assertCurrent()
        setCopyError('Could not copy the saved original.')
      } catch {
        /* Ignore an invalidated view. */
      }
    }
  }
  return (
    <ViewThemed style={styles.container}>
      <FlatList
        contentContainerStyle={styles.content}
        data={shown?.entries.map((entry, index) => ({ entry, index })) ?? []}
        keyExtractor={row => String(row.index)}
        ListHeaderComponent={
          <ViewThemed style={styles.section}>
            <TextThemed>
              {title ??
                (officialManifest
                  ? 'Official shared pack import'
                  : 'Shared collection import')}
            </TextThemed>
            <TextThemed>
              Only verified shared meanings can be imported. Other content stays
              in the saved original for review.
            </TextThemed>
            {!enabled && (
              <TextThemed>
                New shared imports are unavailable. Saved documents and status
                checks remain available.
              </TextThemed>
            )}
            {state.error && (
              <TextThemed accessibilityRole="alert">{state.error}</TextThemed>
            )}
            {copyError && (
              <TextThemed accessibilityRole="alert">{copyError}</TextThemed>
            )}
            <Control
              label="Reload saved documents"
              disabled={disabled}
              onPress={() => {
                void action.reload()
              }}
            />
            {state.sessions.map((row, index) => (
              <Control
                key={row.session_id}
                label={`Open saved ${row.document.collection.name} (${index + 1})`}
                disabled={disabled}
                onPress={() => {
                  setExpanded(new Set())
                  setRecoveryTargets({})
                  action.select(row.session_id)
                }}
              />
            ))}
            {saved ? (
              <>
                <TextThemed>
                  {saved.document.collection.name} ·{' '}
                  {saved.selected_indexes.length} selected · Original retained
                </TextThemed>
                <Control
                  label="Copy saved original document"
                  disabled={disabled}
                  onPress={() => {
                    void copyOriginal()
                  }}
                />
                {!saved.plan && (
                  <Control
                    label="Verify selected references"
                    disabled={disabled || !enabled}
                    onPress={() => {
                      void action.resolve()
                    }}
                  />
                )}
              </>
            ) : document ? (
              <>
                <TextThemed>
                  {document.collection.name} · {selected.size} selected. Select
                  up to {FOLLOWING_TRANSFER_SELECTION_LIMIT} entries.
                </TextThemed>
                {collections.length === 0 && (
                  <TextThemed>
                    Create a collection before saving this import.
                  </TextThemed>
                )}
                {collections.map(row => (
                  <Control
                    key={row.collection_id}
                    label={`Import into ${row.name}${target === row.collection_id ? ' (selected)' : ''}`}
                    disabled={disabled}
                    onPress={() => setTarget(row.collection_id)}
                  />
                ))}
                <Control
                  label="Save selected document"
                  disabled={
                    disabled ||
                    !enabled ||
                    selected.size === 0 ||
                    !collections.some(row => row.collection_id === target)
                  }
                  onPress={() => {
                    void action.prepare({
                      document,
                      collection_id: target,
                      selected_indexes: [...selected],
                    })
                  }}
                />
              </>
            ) : (
              <TextThemed>Choose a saved document to continue.</TextThemed>
            )}
            <Control
              label={
                onCloseLabel ??
                (officialManifest || sharedSource
                  ? 'Back to collections'
                  : 'Back to JSON document')
              }
              disabled={disabled}
              onPress={onClose}
            />
          </ViewThemed>
        }
        renderItem={({ item: { entry, index } }) => {
          const intent = saved?.plan?.intents.find(
            item => item.index === index
          )?.intent
          const operation =
            intent &&
            state.operations.find(
              row =>
                row.kind === 'import' &&
                row.request.operation_id === intent.operation_id
            )
          const remote = intent && state.remoteStates[intent.operation_id]
          const latest =
            intent &&
            state.operations
              .filter(
                row =>
                  (row.kind === 'import'
                    ? row.request
                    : row.request.original_intent
                  ).operation_id === intent.operation_id
              )
              .at(-1)
          const existing = latest?.result?.outcome === 'identity-conflict'
          const loadedMessage = existing
            ? 'The existing card was loaded. Learning was kept.'
            : 'The saved import was loaded.'
          const held =
            intent &&
            state.operations.some(
              row =>
                row.kind !== 'import' &&
                row.request.original_intent.operation_id === intent.operation_id
            )
          return (
            <ViewThemed style={styles.section}>
              <TextThemed>
                {entry.content.dutch_lemma} ·{' '}
                {entry.content.translations.en.join(', ')}
              </TextThemed>
              {!saved && (
                <TouchableOpacity
                  accessibilityRole="checkbox"
                  accessibilityLabel={`Select ${entry.content.dutch_lemma} (${index + 1})`}
                  accessibilityState={{
                    checked: selected.has(index),
                    disabled:
                      disabled ||
                      (!selected.has(index) &&
                        selected.size >= FOLLOWING_TRANSFER_SELECTION_LIMIT),
                  }}
                  disabled={
                    disabled ||
                    (!selected.has(index) &&
                      selected.size >= FOLLOWING_TRANSFER_SELECTION_LIMIT)
                  }
                  onPress={() =>
                    setSelected(previous => {
                      const next = new Set(previous)
                      if (next.has(index)) next.delete(index)
                      else next.add(index)
                      return next
                    })
                  }
                >
                  <TextThemed>
                    {selected.has(index) ? 'Selected' : 'Select meaning'}
                  </TextThemed>
                </TouchableOpacity>
              )}
              {saved && (
                <TextThemed accessibilityLiveRegion="polite">
                  {intent && state.loadedImports[intent.operation_id]
                    ? loadedMessage
                    : followingTransferEntryMessage(
                        saved,
                        index,
                        state.operations
                      )}
                </TextThemed>
              )}
              {operation && (
                <>
                  <Control
                    label={`Load saved import (${index + 1})`}
                    disabled={
                      disabled ||
                      !['inserted', 'applied'].includes(
                        latest?.result?.outcome ?? ''
                      )
                    }
                    onPress={() => {
                      void action.load(index)
                    }}
                  />
                  {existing && (
                    <>
                      <TextThemed>
                        Load the existing shared card in its current collection.
                        Learning and the saved original are kept.
                      </TextThemed>
                      <Control
                        label={`Load existing card (${index + 1})`}
                        disabled={disabled}
                        onPress={() => {
                          void action.loadExisting(index)
                        }}
                      />
                    </>
                  )}
                  {intent && state.loadedImports[intent.operation_id] && (
                    <TextThemed accessibilityLiveRegion="polite">
                      {existing
                        ? 'Existing card loaded. Learning was kept.'
                        : 'Imported card loaded.'}
                    </TextThemed>
                  )}
                </>
              )}
              {latest && latest.kind !== 'import' && !latest.result && (
                <Control
                  label={`Retry saved ${latest.kind === 'recover' ? 'recovery' : 'cancellation'} (${index + 1})`}
                  disabled={disabled}
                  onPress={() => {
                    void action.retryOperation(index)
                  }}
                />
              )}
              {remote &&
                remote.state !== 'cancelled' &&
                !(
                  latest?.kind === 'cancel' ||
                  (latest?.kind === 'recover' && !latest.result)
                ) && (
                  <>
                    {remote.state !== 'unavailable' && (
                      <>
                        <TextThemed>
                          Choose a collection for recovery. Existing learning is
                          kept.
                        </TextThemed>
                        {collections.map(row => (
                          <Control
                            key={row.collection_id}
                            label={`Recover into ${row.name} (${index + 1})${recoveryTargets[index] === row.collection_id ? ' (selected)' : ''}`}
                            disabled={disabled}
                            onPress={() =>
                              setRecoveryTargets(previous => ({
                                ...previous,
                                [index]: row.collection_id,
                              }))
                            }
                          />
                        ))}
                        <Control
                          label={`Recover saved import (${index + 1})`}
                          disabled={
                            disabled ||
                            (!remote.inserted_once && !enabled) ||
                            !collections.some(
                              row =>
                                row.collection_id === recoveryTargets[index]
                            )
                          }
                          onPress={() => {
                            void action.recover(index, recoveryTargets[index])
                          }}
                        />
                      </>
                    )}
                    <TextThemed>
                      Cancel further import and recovery. Existing cards and
                      learning are kept.
                    </TextThemed>
                    <Control
                      label={`Cancel further import (${index + 1})`}
                      disabled={disabled}
                      onPress={() => {
                        void action.cancel(index)
                      }}
                    />
                  </>
                )}
              {remote && (
                <TextThemed>
                  Current server state: {remote.state}.{' '}
                  {remote.collection_id
                    ? `Current collection: ${collections.find(row => row.collection_id === remote.collection_id)?.name ?? 'Another collection'}.`
                    : 'No active collection.'}
                </TextThemed>
              )}
              <Control
                label={`View original content (${index + 1})`}
                disabled={disabled}
                onPress={() =>
                  setExpanded(previous => {
                    const next = new Set(previous)
                    if (next.has(index)) next.delete(index)
                    else next.add(index)
                    return next
                  })
                }
              />
              {expanded.has(index) && (
                <TextThemed selectable>
                  {JSON.stringify(entry.content, null, 2)}
                </TextThemed>
              )}
              {intent && !operation && (
                <Control
                  label={`Queue offline (${index + 1})`}
                  disabled={disabled || !enabled}
                  onPress={() => {
                    void action.queue(index)
                  }}
                />
              )}
              {intent &&
                !held &&
                remote?.state !== 'cancelled' &&
                remote?.state !== 'unavailable' &&
                !operation?.result && (
                  <Control
                    label={`Import shared meaning (${index + 1})`}
                    disabled={disabled || !enabled}
                    onPress={() => {
                      void action.deliver(index)
                    }}
                  />
                )}
              {operation && (
                <Control
                  label={`Check saved import status (${index + 1})`}
                  disabled={disabled}
                  onPress={() => {
                    setRecoveryTargets(previous => ({
                      ...previous,
                      [index]: '',
                    }))
                    void action.check(index)
                  }}
                />
              )}
            </ViewThemed>
          )
        }}
      />
    </ViewThemed>
  )
}

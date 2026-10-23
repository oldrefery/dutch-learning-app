'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import {
  createDictionaryFollowingTransferAction,
  followingTransferEntryMessage,
  FOLLOWING_TRANSFER_SELECTION_LIMIT,
  type DictionaryCollectionExportV2,
  type SharedDictionaryCollectionV2,
  sharedCollectionFollowingSource,
} from '@woordenaar/domain'
import { useRouter } from 'next/navigation'
import {
  loadWebFollowingImport,
  loadWebFollowingExistingCard,
} from './following-import-hydration'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { createWebFollowingTransferService } from './following-transfer-client'
import { createWebFollowingImportService } from './following-import-client'
import type { SharedTargetCollection } from './repository'
import styles from './DictionaryTransfer.module.css'
import type { OfficialContentManifest } from '@woordenaar/content/manifest'
import { officialFollowingDocument } from '@woordenaar/content/dictionary'
import { parseDictionaryCollectionExportV2 } from '@woordenaar/domain'
import { prepareOfficialFollowingImport } from '@/features/starter-pack/official-following-import'

import { prepareSharedFollowingImport } from './shared-following-import'

const PAGE_SIZE = 50
export function DictionaryFollowingTransferPanel({
  ownerId,
  title,
  onCloseLabel,
  document: inputDocument,
  officialManifest,
  sharedSource,
  collections,
  followingEnabled,
  onClose,
}: {
  ownerId: string
  title?: string
  onCloseLabel?: string
  document?: DictionaryCollectionExportV2
  officialManifest?: OfficialContentManifest
  sharedSource?: { shareToken: string; original: SharedDictionaryCollectionV2 }
  collections: SharedTargetCollection[]
  followingEnabled: boolean
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
  const router = useRouter()
  const changed = useRef(false)
  const action = useMemo(() => {
    const service = createWebFollowingTransferService(ownerId, followingEnabled)
    const imports = createWebFollowingImportService(ownerId, followingEnabled)
    return createDictionaryFollowingTransferAction({
      userId: ownerId,
      enabled: () =>
        followingEnabled &&
        process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED === 'true',
      createId: () => crypto.randomUUID(),
      list: service.list,
      listOperations: imports.list,
      prepare: service.prepare,
      prepareSource: officialManifest
        ? assert =>
            prepareOfficialFollowingImport(
              ownerId,
              officialManifest,
              followingEnabled,
              assert
            )
        : sharedSource
          ? assert =>
              prepareSharedFollowingImport(
                ownerId,
                sharedSource.shareToken,
                sharedSource.original,
                followingEnabled,
                assert
              )
          : undefined,
      resolve: service.resolve,
      queueEntry: service.queueEntry,
      deliverEntry: service.deliverEntry,
      readState: imports.readState,
      prepareOperation: imports.prepare,
      deliverOperation: imports.deliver,
      targetCollections: () => collections.map(row => row.id),
      loadExisting: (value, assertCurrent) =>
        loadWebFollowingExistingCard(
          value,
          followingEnabled,
          assertCurrent,
          () => router.refresh()
        ),
      load: (value, assertCurrent) =>
        loadWebFollowingImport(value, followingEnabled, assertCurrent, () =>
          router.refresh()
        ),
    })
  }, [
    ownerId,
    followingEnabled,
    router,
    collections,
    officialManifest,
    sharedSource,
  ])
  const state = useSyncExternalStore(
    action.subscribe,
    action.getSnapshot,
    action.getServerSnapshot
  )
  const [target, setTarget] = useState(collections[0]?.id ?? '')
  const [recoveryTargets, setRecoveryTargets] = useState<
    Record<number, string>
  >({})
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [page, setPage] = useState(0)
  const [showOriginal, setShowOriginal] = useState(false)
  useEffect(
    () =>
      action.start(invalidate => {
        if (changed.current) invalidate()
        const {
          data: { subscription },
        } = createClient().auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_OUT' || session?.user.id !== ownerId) {
            changed.current = true
            invalidate()
          }
        })
        return () => subscription.unsubscribe()
      }),
    [action, ownerId]
  )
  if (state.blocked) return <p role="alert">{state.error}</p>
  const saved = state.sessions.find(
    row => row.session_id === state.selectedSessionId
  )
  const shown = saved?.document ?? document
  const disabled = state.busy || !state.loaded
  const enabled =
    followingEnabled &&
    process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED === 'true'
  const pageCount = Math.max(
    1,
    Math.ceil((shown?.entries.length ?? 0) / PAGE_SIZE)
  )
  return (
    <section className={`dw-surface ${styles.panel}`}>
      <h2>
        {title ??
          (officialManifest
            ? 'Official shared pack import'
            : 'Shared collection import')}
      </h2>
      <p>
        Only verified shared meanings can be imported. Other content stays in
        the saved original for review.
      </p>
      {!enabled && (
        <p>
          New shared imports are unavailable. Saved documents and status checks
          remain available.
        </p>
      )}
      {state.error && <p role="alert">{state.error}</p>}
      <div className={styles.actions}>
        <Button
          type="button"
          disabled={disabled}
          onClick={() => {
            void action.reload()
          }}
        >
          Reload saved documents
        </Button>
        <Button
          type="button"
          disabled={disabled}
          onClick={onClose}
          variant="secondary"
        >
          {onCloseLabel ??
            (officialManifest || sharedSource
              ? 'Back to collections'
              : 'Back to JSON document')}
        </Button>
      </div>
      {state.sessions.length > 0 && (
        <div className={styles.field}>
          <label htmlFor="saved-shared-document">Saved documents</label>
          <select
            className="dw-field"
            id="saved-shared-document"
            disabled={disabled}
            value={state.selectedSessionId ?? ''}
            onChange={event => {
              setPage(0)
              setShowOriginal(false)
              setRecoveryTargets({})
              action.select(event.target.value)
            }}
          >
            <option value="">Choose a saved document</option>
            {state.sessions.map((row, index) => (
              <option key={row.session_id} value={row.session_id}>
                {row.document.collection.name} ({index + 1})
              </option>
            ))}
          </select>
        </div>
      )}
      {saved ? (
        <>
          <h3>{saved.document.collection.name}</h3>
          <p>{saved.selected_indexes.length} selected · Original retained</p>
          <Button
            type="button"
            disabled={disabled}
            onClick={() => setShowOriginal(value => !value)}
            variant="secondary"
          >
            View saved original document
          </Button>
          {showOriginal && (
            <textarea
              className={`dw-field ${styles.document}`}
              aria-label="Saved original document"
              readOnly
              value={JSON.stringify(saved.document, null, 2)}
            />
          )}
          {!saved.plan && (
            <Button
              type="button"
              disabled={disabled || !enabled}
              onClick={() => {
                void action.resolve()
              }}
            >
              Verify selected references
            </Button>
          )}
        </>
      ) : document ? (
        <>
          <h3>{document.collection.name}</h3>
          <p>
            {selected.size} selected. Select up to{' '}
            {FOLLOWING_TRANSFER_SELECTION_LIMIT} entries.
          </p>
          {collections.length === 0 && (
            <p>Create a collection before saving this import.</p>
          )}
          <label htmlFor="shared-import-target">Import into</label>
          <select
            className="dw-field"
            id="shared-import-target"
            value={target}
            disabled={disabled}
            onChange={event => setTarget(event.target.value)}
          >
            {collections.map(row => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            disabled={
              disabled ||
              !enabled ||
              selected.size === 0 ||
              !collections.some(row => row.id === target)
            }
            onClick={() => {
              void action.prepare({
                document,
                collection_id: target,
                selected_indexes: [...selected],
              })
            }}
          >
            Save selected document
          </Button>
        </>
      ) : (
        <p>Choose a saved document to continue.</p>
      )}
      <ul className={styles.words} aria-label="Shared import entries">
        {shown?.entries
          .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
          .map((entry, offset) => {
            const index = page * PAGE_SIZE + offset
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
                  row.request.original_intent.operation_id ===
                    intent.operation_id
              )
            return (
              <li className={styles.panel} key={index}>
                <strong>{entry.content.dutch_lemma}</strong>
                <span>{entry.content.translations.en.join(', ')}</span>
                {!saved && (
                  <label>
                    <input
                      type="checkbox"
                      aria-label={`Select ${entry.content.dutch_lemma} (${index + 1})`}
                      checked={selected.has(index)}
                      disabled={
                        disabled ||
                        (!selected.has(index) &&
                          selected.size >= FOLLOWING_TRANSFER_SELECTION_LIMIT)
                      }
                      onChange={() =>
                        setSelected(previous => {
                          const next = new Set(previous)
                          if (next.has(index)) next.delete(index)
                          else next.add(index)
                          return next
                        })
                      }
                    />{' '}
                    Select meaning
                  </label>
                )}
                {saved && (
                  <p role="status">
                    {intent && state.loadedImports[intent.operation_id]
                      ? loadedMessage
                      : followingTransferEntryMessage(
                          saved,
                          index,
                          state.operations
                        )}
                  </p>
                )}
                {operation && (
                  <>
                    <Button
                      type="button"
                      disabled={
                        disabled ||
                        !['inserted', 'applied'].includes(
                          latest?.result?.outcome ?? ''
                        )
                      }
                      onClick={() => {
                        void action.load(index)
                      }}
                    >
                      Load saved import ({index + 1})
                    </Button>
                    {existing && (
                      <>
                        <p>
                          Load the existing shared card in its current
                          collection. Learning and the saved original are kept.
                        </p>
                        <Button
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            void action.loadExisting(index)
                          }}
                        >
                          Load existing card ({index + 1})
                        </Button>
                      </>
                    )}
                    {intent && state.loadedImports[intent.operation_id] && (
                      <p role="status">
                        {existing
                          ? 'Existing card verified. Page refresh requested. Learning was kept.'
                          : 'Imported card loaded. Page refresh requested.'}
                      </p>
                    )}
                  </>
                )}
                {latest && latest.kind !== 'import' && !latest.result && (
                  <Button
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      void action.retryOperation(index)
                    }}
                  >
                    Retry saved{' '}
                    {latest.kind === 'recover' ? 'recovery' : 'cancellation'} (
                    {index + 1})
                  </Button>
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
                          <label htmlFor={`recovery-target-${index}`}>
                            Choose a collection for recovery ({index + 1}).
                            Existing learning is kept.
                          </label>
                          <select
                            id={`recovery-target-${index}`}
                            className="dw-field"
                            disabled={disabled}
                            value={recoveryTargets[index] ?? ''}
                            onChange={event =>
                              setRecoveryTargets(previous => ({
                                ...previous,
                                [index]: event.target.value,
                              }))
                            }
                          >
                            <option value="">Choose a collection</option>
                            {collections.map(row => (
                              <option key={row.id} value={row.id}>
                                {row.name}
                              </option>
                            ))}
                          </select>
                          <Button
                            type="button"
                            disabled={
                              disabled ||
                              (!remote.inserted_once && !enabled) ||
                              !collections.some(
                                row => row.id === recoveryTargets[index]
                              )
                            }
                            onClick={() => {
                              void action.recover(index, recoveryTargets[index])
                            }}
                          >
                            Recover saved import ({index + 1})
                          </Button>
                        </>
                      )}
                      <p>
                        Cancel further import and recovery. Existing cards and
                        learning are kept.
                      </p>
                      <Button
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          void action.cancel(index)
                        }}
                      >
                        Cancel further import ({index + 1})
                      </Button>
                    </>
                  )}
                {remote && (
                  <p>
                    Current server state: {remote.state}.{' '}
                    {remote.collection_id
                      ? `Current collection: ${collections.find(row => row.id === remote.collection_id)?.name ?? 'Another collection'}.`
                      : 'No active collection.'}
                  </p>
                )}
                <details>
                  <summary>Original content</summary>
                  <pre>{JSON.stringify(entry.content, null, 2)}</pre>
                </details>
                <div className={styles.actions}>
                  {intent && !operation && (
                    <Button
                      type="button"
                      disabled={disabled || !enabled}
                      onClick={() => {
                        void action.queue(index)
                      }}
                    >
                      Queue offline ({index + 1})
                    </Button>
                  )}
                  {intent &&
                    !held &&
                    remote?.state !== 'cancelled' &&
                    remote?.state !== 'unavailable' &&
                    !operation?.result && (
                      <Button
                        type="button"
                        disabled={disabled || !enabled}
                        onClick={() => {
                          void action.deliver(index)
                        }}
                      >
                        Import shared meaning ({index + 1})
                      </Button>
                    )}
                  {operation && (
                    <Button
                      type="button"
                      disabled={disabled}
                      variant="secondary"
                      onClick={() => {
                        setRecoveryTargets(previous => ({
                          ...previous,
                          [index]: '',
                        }))
                        void action.check(index)
                      }}
                    >
                      Check saved import status ({index + 1})
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
      </ul>
      {pageCount > 1 && (
        <nav aria-label="Shared import pages" className={styles.pagination}>
          <Button
            type="button"
            disabled={disabled || page === 0}
            onClick={() => setPage(value => value - 1)}
            variant="secondary"
          >
            Previous
          </Button>
          <span>
            Page {page + 1} of {pageCount}
          </span>
          <Button
            type="button"
            disabled={disabled || page + 1 >= pageCount}
            onClick={() => setPage(value => value + 1)}
            variant="secondary"
          >
            Next
          </Button>
        </nav>
      )}
    </section>
  )
}

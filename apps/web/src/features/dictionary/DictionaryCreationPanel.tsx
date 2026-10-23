'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import {
  createDictionaryCreationAction,
  dictionaryCreationMessage,
  normalizeDictionaryMeaningQuery,
  creationPublishedReference,
} from '@woordenaar/domain'
import { useRouter } from 'next/navigation'
import type { CollectionOption } from '@/features/words/repository'
import { createWebCreationAdoptionService } from './creation-adoption-client'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { createWebDictionaryCreationService } from './creation-client'

export function DictionaryCreationPanel({
  ownerId,
  originalQuery,
  noMatch,
  followingEnabled,
  collections,
}: {
  ownerId: string
  originalQuery: string
  noMatch: boolean
  followingEnabled: boolean
  collections: CollectionOption[]
}) {
  const router = useRouter()
  const changed = useRef(false)
  const action = useMemo(
    () =>
      createDictionaryCreationAction({
        userId: ownerId,
        originalQuery,
        createId: () => crypto.randomUUID(),
        enabled: () =>
          followingEnabled &&
          process.env.NEXT_PUBLIC_DICTIONARY_SHARED_ANALYSIS_ENABLED === 'true',
        adoption: {
          enabled: () =>
            followingEnabled &&
            process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED ===
              'true',
          targetCollections: () => collections.map(row => row.id),
          connect: (assertCurrent, signal) =>
            createWebCreationAdoptionService(
              ownerId,
              assertCurrent,
              signal,
              followingEnabled,
              () => router.refresh()
            ),
        },
        connect: (assertCurrent, signal) =>
          createWebDictionaryCreationService(
            ownerId,
            assertCurrent,
            followingEnabled,
            signal
          ),
      }),
    [ownerId, originalQuery, followingEnabled, collections, router]
  )
  const state = useSyncExternalStore(
    action.subscribe,
    action.getSnapshot,
    action.getServerSnapshot
  )
  const [hint, setHint] = useState('')
  const [target, setTarget] = useState(collections[0]?.id ?? '')
  const [page, setPage] = useState(0)
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
    disabled ||
    !state.loaded ||
    !(
      followingEnabled &&
      process.env.NEXT_PUBLIC_DICTIONARY_SHARED_ANALYSIS_ENABLED === 'true'
    )
  const importEnabled =
    followingEnabled &&
    process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED === 'true'
  const rows = state.rows.slice(page * 10, (page + 1) * 10)
  return (
    <section aria-label="Shared meaning requests" className="mt-4 space-y-3">
      <h2>Shared meaning requests</h2>
      <Button
        type="button"
        disabled={disabled}
        onClick={() => {
          void action.restore()
        }}
      >
        {state.busy ? 'Loading request…' : 'Load saved requests'}
      </Button>
      {state.error && <p role="alert">{state.error}</p>}
      {rows.map((row, index) => (
        <Button
          type="button"
          key={row.session.request.resolution_id}
          disabled={disabled || !state.loaded}
          onClick={() => action.select(row.session.request.resolution_id)}
        >
          {`Open saved request ${page * 10 + index + 1}: ${row.session.request.original_query}`}
        </Button>
      ))}
      {page > 0 && (
        <Button
          type="button"
          disabled={disabled}
          onClick={() => setPage(page - 1)}
        >
          Previous saved requests
        </Button>
      )}
      {(page + 1) * 10 < state.rows.length && (
        <Button
          type="button"
          disabled={disabled}
          onClick={() => setPage(page + 1)}
        >
          More saved requests
        </Button>
      )}
      {selected && (
        <div className="space-y-3">
          <p>Original word: {selected.session.request.original_query}</p>
          <p>Meaning hint: {selected.session.request.meaning_hint}</p>
          <p>{dictionaryCreationMessage(selected)}</p>
          <Button
            type="button"
            disabled={disabled || !state.loaded}
            onClick={() => {
              void action.checkStatus()
            }}
          >
            Check saved request status
          </Button>
          {!selected.session.resolution &&
            !selected.session.command &&
            !selected.session.submitted && (
              <Button
                type="button"
                disabled={newWorkDisabled}
                onClick={() => {
                  void action.resolveSaved()
                }}
              >
                Resolve saved meaning
              </Button>
            )}
          {selected.session.resolution?.outcome === 'new-meaning' &&
            !selected.session.submitted && (
              <Button
                type="button"
                disabled={newWorkDisabled}
                onClick={() => {
                  void action.create()
                }}
              >
                Create shared meaning
              </Button>
            )}
          {creationPublishedReference(selected.session) && (
            <div className="space-y-3">
              {!selected.adoption && (
                <label>
                  Add published meaning to collection
                  <select
                    className="dw-field mt-2"
                    value={target}
                    disabled={disabled}
                    onChange={event => setTarget(event.target.value)}
                  >
                    <option value="">Choose a collection</option>
                    {collections.map(row => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {(!selected.adoption || !selected.adoption.submitted) && (
                <Button
                  type="button"
                  disabled={
                    disabled ||
                    !state.loaded ||
                    !importEnabled ||
                    (!selected.adoption &&
                      !collections.some(row => row.id === target))
                  }
                  onClick={() => {
                    void action.adopt(
                      selected.adoption?.request.collection_id ?? target
                    )
                  }}
                >
                  Add published meaning
                </Button>
              )}
              {selected.adoption && (
                <div className="space-y-3">
                  <p>
                    Saved import destination:{' '}
                    {collections.find(
                      row => row.id === selected.adoption?.request.collection_id
                    )?.name ?? 'Original collection'}
                  </p>
                  <Button
                    type="button"
                    disabled={disabled || !state.loaded}
                    onClick={() => {
                      void action.checkImport()
                    }}
                  >
                    Check saved import
                  </Button>
                  {selected.adoption.submitted &&
                    !selected.adoption.response && (
                      <Button
                        type="button"
                        disabled={
                          disabled ||
                          !state.loaded ||
                          (!importEnabled &&
                            !state.importStates[
                              selected.session.request.resolution_id
                            ]?.inserted_once)
                        }
                        onClick={() => {
                          void action.confirmImport()
                        }}
                      >
                        Confirm saved import
                      </Button>
                    )}
                  {selected.adoption.response?.outcome === 'inserted' && (
                    <Button
                      type="button"
                      disabled={disabled || !state.loaded}
                      onClick={() => {
                        void action.loadImport()
                      }}
                    >
                      Load added card
                    </Button>
                  )}
                  {selected.adoption.response?.outcome ===
                    'identity-conflict' && (
                    <div>
                      <p>
                        This meaning already exists in your vocabulary. No new
                        card was added.
                      </p>
                      <Button
                        type="button"
                        disabled={disabled || !state.loaded}
                        onClick={() => {
                          void action.loadImport(true)
                        }}
                      >
                        Load existing card
                      </Button>
                    </div>
                  )}
                  {state.importStates[
                    selected.session.request.resolution_id
                  ] && (
                    <p>
                      Saved import status:{' '}
                      {
                        state.importStates[
                          selected.session.request.resolution_id
                        ].state
                      }
                    </p>
                  )}
                  {state.loadedImports[
                    selected.session.request.resolution_id
                  ] && <p>The personal card and shared content are loaded.</p>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {noMatch && state.loaded && !sameWord && !state.blocked && (
        <form
          onSubmit={event => {
            event.preventDefault()
            void action.resolveNew(hint)
          }}
        >
          <p>
            Describe the intended meaning. A hint does not approve a new
            meaning.
          </p>
          <label>
            Meaning hint
            <input
              className="dw-field mt-2"
              value={hint}
              maxLength={1000}
              disabled={disabled}
              onChange={event => setHint(event.target.value)}
            />
          </label>
          <Button type="submit" disabled={newWorkDisabled || !hint.trim()}>
            Resolve intended meaning
          </Button>
        </form>
      )}
      {noMatch && sameWord && (
        <p>
          Continue the saved request for this word. Its original meaning hint is
          retained.
        </p>
      )}
      <p>
        Creation requires full access and server approval. Generation and
        independent checking normally use two analysis quota slots. Publication
        does not add a personal card.
      </p>
    </section>
  )
}

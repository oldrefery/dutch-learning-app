'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { useRouter } from 'next/navigation'
import {
  createDictionaryAnalysisAction,
  isDictionaryAnalysisContentCurrent,
  dictionaryAnalysisActionMessage,
  dictionaryAnalysisResolutionMessage,
  parseDictionaryAnalysisClientOperation,
  type DictionaryAnalysisClientOperation,
  type DictionaryEffectiveBatchV2,
} from '@woordenaar/domain'
import { WordDetailCard } from '@/features/words/WordDetailCard'
import type { WordDetail } from '@/features/words/word-detail'
import { createClient } from '@/lib/supabase/client'
import { createWebDictionaryAnalysisService } from './analysis-client'
import { refreshPublishedDictionaryAnalysis } from '@/features/words/actions'
import { applyDictionaryAnalysisSnapshot } from './analysis-display'

export function FollowingWordDetail({
  word,
  userId,
  followingEnabled,
}: {
  word: WordDetail
  userId: string
  followingEnabled: boolean
}) {
  const router = useRouter()
  const sessionChanged = useRef(false)
  const [publication, setPublication] = useState<{
    operation: DictionaryAnalysisClientOperation
    batch: DictionaryEffectiveBatchV2
  } | null>(null)
  const applicablePublication =
    publication &&
    publication.operation.user_id === userId &&
    publication.operation.word_id === word.id &&
    word.dictionary?.mode === 'follow' &&
    word.dictionary.reference?.entry_id ===
      publication.operation.command.entry_id
  const displayWord =
    publication && applicablePublication
      ? applyDictionaryAnalysisSnapshot(
          word,
          publication.operation,
          publication.batch
        )
      : word
  const entryId = displayWord.dictionary?.reference?.entry_id
  const revisionId = displayWord.dictionary?.reference?.revision_id
  const headSequence =
    displayWord.dictionary && 'headSequence' in displayWord.dictionary
      ? displayWord.dictionary.headSequence
      : null
  const action = useMemo(() => {
    const service = createWebDictionaryAnalysisService(
      userId,
      followingEnabled,
      () => controller.assertCurrent
    )
    const controller = createDictionaryAnalysisAction({
      userId,
      wordId: word.id,
      readSaved: () => service.readSaved(word.id),
      readHistory: () => service.readHistory(word.id),
      isAvailable: () => service.isAvailable(),
      createIntent: () =>
        parseDictionaryAnalysisClientOperation({
          user_id: userId,
          word_id: word.id,
          submitted: false,
          response: null,
          command: {
            protocol_version: 2,
            operation_id: crypto.randomUUID(),
            entry_id: entryId,
            expected_revision_id: revisionId,
            expected_head_sequence: headSequence,
          },
        }),
      submit: async operation => {
        const assertCurrent = controller.assertCurrent
        const { result, hydrated } = await service.submit(operation)
        assertCurrent()
        if (hydrated) {
          applyDictionaryAnalysisSnapshot(word, result, hydrated)
          await refreshPublishedDictionaryAnalysis(result)
          assertCurrent()
          setPublication({ operation: result, batch: hydrated })
          router.refresh()
        }
        return result
      },
      loadPublished: async operation => {
        const assertCurrent = controller.assertCurrent
        const { result, hydrated } = await service.loadPublished(operation)
        assertCurrent()
        if (!hydrated) throw new Error('Published content was not loaded')
        applyDictionaryAnalysisSnapshot(word, result, hydrated)
        await refreshPublishedDictionaryAnalysis(result)
        assertCurrent()
        setPublication({ operation: result, batch: hydrated })
        router.refresh()
        return result
      },
      recover: async () => {
        const assertCurrent = controller.assertCurrent
        const { result, hydrated } = await service.recover(word.id)
        assertCurrent()
        if (result && hydrated) {
          applyDictionaryAnalysisSnapshot(word, result, hydrated)
          await refreshPublishedDictionaryAnalysis(result)
          assertCurrent()
          setPublication({ operation: result, batch: hydrated })
          router.refresh()
        }
        return result
      },
      nextAttempt: async (previous, candidate) => {
        const assertCurrent = controller.assertCurrent
        const { result, hydrated } = await service.nextAttempt(
          previous,
          candidate
        )
        assertCurrent()
        if (hydrated) {
          applyDictionaryAnalysisSnapshot(word, result, hydrated)
          await refreshPublishedDictionaryAnalysis(result)
          assertCurrent()
          setPublication({ operation: result, batch: hydrated })
          router.refresh()
        }
        return result
      },
    })
    return controller
  }, [
    word,
    userId,
    followingEnabled,
    router,
    entryId,
    revisionId,
    headSequence,
  ])
  const state = useSyncExternalStore(
    action.subscribe,
    action.getSnapshot,
    action.getServerSnapshot
  )
  useEffect(
    () =>
      action.start(invalidate => {
        if (sessionChanged.current) invalidate()
        const sdk = createClient()
        const {
          data: { subscription },
        } = sdk.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_OUT' || session?.user.id !== userId) {
            sessionChanged.current = true
            invalidate()
          }
        })
        return () => subscription.unsubscribe()
      }),
    [action, userId]
  )
  const visible =
    state.loaded && (state.operation || state.allowed || state.error)
  const status = dictionaryAnalysisActionMessage(state.operation)
  const resolution = dictionaryAnalysisResolutionMessage(state.operation)
  return (
    <>
      <WordDetailCard headingLevel="h1" word={displayWord} />
      {visible && (
        <section
          aria-label="Shared analysis"
          className="mt-5 rounded-2xl border border-neutral-200 p-5 dark:border-neutral-800"
        >
          <h2 className="text-base font-semibold">Shared analysis</h2>
          <p className="mt-1 text-sm">
            Approved updates apply to everyone following this meaning.
          </p>
          {status && (
            <p role="status" aria-live="polite" className="mt-3 text-sm">
              {status}
            </p>
          )}
          {state.error && (
            <p role="alert" className="mt-3 text-sm">
              {state.error}
            </p>
          )}
          {resolution && <p className="mt-3 text-sm">{resolution}</p>}
          {state.nextAllowed && !state.blocked && (
            <button
              type="button"
              disabled={state.busy}
              className="mt-3 rounded-xl border px-5 py-3 disabled:opacity-60"
              onClick={() => {
                void action.nextAttempt()
              }}
            >
              Start new analysis
            </button>
          )}
          {state.allowed && !state.operation?.submitted && !state.blocked && (
            <button
              type="button"
              disabled={state.busy}
              className="mt-3 rounded-xl border px-5 py-3 disabled:opacity-60"
              onClick={() => {
                void action.submit()
              }}
            >
              {state.busy
                ? 'Analyzing…'
                : state.operation
                  ? 'Continue analysis'
                  : 'Analyze again'}
            </button>
          )}
          {state.operation?.response &&
            !('outcome' in state.operation.response) &&
            ['published', 'no-change'].includes(
              state.operation.response.status
            ) &&
            !state.contentLoaded &&
            !isDictionaryAnalysisContentCurrent(state.operation, {
              wordId: word.id,
              mode: displayWord.dictionary?.mode,
              entryId,
              revisionId,
              headSequence,
            }) &&
            !state.blocked && (
              <button
                type="button"
                disabled={state.busy}
                className="mt-3 rounded-xl border px-5 py-3 disabled:opacity-60"
                onClick={() => {
                  void action.loadPublished()
                }}
              >
                Load published content
              </button>
            )}
          {state.operation?.submitted && !state.blocked && (
            <button
              type="button"
              disabled={state.busy}
              className="mt-3 rounded-xl border px-5 py-3 disabled:opacity-60"
              onClick={() => {
                void action.recover()
              }}
            >
              {state.busy ? 'Checking…' : 'Check analysis status'}
            </button>
          )}
          {!state.blocked && (
            <button
              type="button"
              disabled={state.busy}
              className="mt-3 rounded-xl border px-5 py-3 disabled:opacity-60"
              onClick={() => {
                void action.loadHistory()
              }}
            >
              View analysis history
            </button>
          )}
          {state.history && (
            <div className="mt-3 text-sm">
              <h3>Archived analysis attempts ({state.history.length})</h3>
              <ol>
                {state.history.map((operation, index) => (
                  <li key={operation.command.operation_id}>
                    {state.history!.length - index}.{' '}
                    {dictionaryAnalysisActionMessage(operation)}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}
    </>
  )
}

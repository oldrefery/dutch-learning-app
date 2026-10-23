import React, { useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import { TouchableOpacity } from 'react-native'
import * as Crypto from 'expo-crypto'
import {
  createDictionaryAnalysisAction,
  isDictionaryAnalysisContentCurrent,
  dictionaryAnalysisActionMessage,
  dictionaryAnalysisResolutionMessage,
  parseDictionaryAnalysisClientOperation,
} from '@woordenaar/domain'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { NonSwipeableArea } from '@/components/NonSwipeableArea'
import { dictionaryAnalysisService as service } from '@/services/dictionaryAnalysisService'
import { refreshDictionaryAnalysisDisplay } from '@/services/dictionaryAnalysisDisplay'
import { supabase } from '@/lib/supabase'
import type { Word } from '@/types/database'
import { styles } from './UniversalWordCard/styles'

export function DictionaryAnalysisPanel({ word }: { word: Word }) {
  const sessionChanged = useRef(false)
  const { user_id: userId, word_id: wordId } = word
  const card = word.dictionary_content_state
  const mode = card?.mode
  const entryId = card?.reference?.entry_id
  const revisionId = card?.reference?.revision_id
  const sequence = card?.head_sequence
  const action = useMemo(() => {
    const controller = createDictionaryAnalysisAction({
      userId,
      wordId,
      readSaved: () => service.readSaved(userId, wordId),
      readHistory: () => service.readHistory(userId, wordId),
      isAvailable: () =>
        mode === 'follow'
          ? service.isAvailable(userId)
          : Promise.resolve(false),
      createIntent: () =>
        parseDictionaryAnalysisClientOperation({
          user_id: userId,
          word_id: wordId,
          submitted: false,
          response: null,
          command: {
            protocol_version: 2,
            operation_id: Crypto.randomUUID(),
            entry_id: entryId,
            expected_revision_id: revisionId,
            expected_head_sequence: sequence,
          },
        }),
      submit: async operation => {
        const assertCurrent = controller.assertCurrent
        const saved = await service.submit(operation, assertCurrent)
        assertCurrent()
        if (
          saved.response &&
          !('outcome' in saved.response) &&
          ['published', 'no-change'].includes(saved.response.status)
        )
          await refreshDictionaryAnalysisDisplay(userId, assertCurrent)
        return saved
      },
      loadPublished: async operation => {
        const assertCurrent = controller.assertCurrent
        const saved = await service.loadPublished(operation, assertCurrent)
        assertCurrent()
        await refreshDictionaryAnalysisDisplay(userId, assertCurrent)
        return saved
      },
      recover: async () => {
        const assertCurrent = controller.assertCurrent
        const saved = await service.recover(userId, wordId, assertCurrent)
        assertCurrent()
        if (
          saved?.response &&
          !('outcome' in saved.response) &&
          ['published', 'no-change'].includes(saved.response.status)
        )
          await refreshDictionaryAnalysisDisplay(userId, assertCurrent)
        return saved
      },
      nextAttempt: async (previous, candidate) => {
        const assertCurrent = controller.assertCurrent
        const saved = await service.nextAttempt(
          previous,
          candidate,
          assertCurrent
        )
        assertCurrent()
        if (
          saved.response &&
          !('outcome' in saved.response) &&
          ['published', 'no-change'].includes(saved.response.status)
        )
          await refreshDictionaryAnalysisDisplay(userId, assertCurrent)
        return saved
      },
    })
    return controller
  }, [userId, wordId, entryId, revisionId, sequence, mode])
  const state = useSyncExternalStore(
    action.subscribe,
    action.getSnapshot,
    action.getServerSnapshot
  )
  useEffect(
    () =>
      action.start(invalidate => {
        if (sessionChanged.current) invalidate()
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_OUT' || session?.user.id !== userId) {
            sessionChanged.current = true
            invalidate()
          }
        })
        return () => subscription.unsubscribe()
      }),
    [action, userId]
  )
  if (!state.loaded || (!state.operation && !state.allowed && !state.error))
    return null
  const status = dictionaryAnalysisActionMessage(state.operation)
  const resolution = dictionaryAnalysisResolutionMessage(state.operation)
  return (
    <ViewThemed style={styles.actionsSection}>
      <TextThemed>Shared analysis</TextThemed>
      <TextThemed>
        Approved updates apply to everyone following this meaning.
      </TextThemed>
      {status && (
        <TextThemed accessibilityLiveRegion="polite">{status}</TextThemed>
      )}
      {state.error && (
        <TextThemed accessibilityRole="alert">{state.error}</TextThemed>
      )}
      {resolution && <TextThemed>{resolution}</TextThemed>}
      <NonSwipeableArea>
        {state.nextAllowed && !state.blocked && (
          <TouchableOpacity
            accessibilityRole="button"
            disabled={state.busy}
            accessibilityState={{ disabled: state.busy }}
            style={[styles.actionButton, styles.reanalyzeButton]}
            onPress={() => {
              void action.nextAttempt()
            }}
          >
            <TextThemed
              style={[styles.actionButtonText, styles.reanalyzeButtonText]}
            >
              Start new analysis
            </TextThemed>
          </TouchableOpacity>
        )}
        {state.allowed && !state.operation?.submitted && !state.blocked && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: state.busy }}
            disabled={state.busy}
            style={[styles.actionButton, styles.reanalyzeButton]}
            onPress={() => {
              void action.submit()
            }}
          >
            <TextThemed
              style={[styles.actionButtonText, styles.reanalyzeButtonText]}
            >
              {state.busy
                ? 'Analyzing…'
                : state.operation
                  ? 'Continue analysis'
                  : 'Analyze again'}
            </TextThemed>
          </TouchableOpacity>
        )}
        {mode === 'follow' &&
          state.operation?.response &&
          !('outcome' in state.operation.response) &&
          ['published', 'no-change'].includes(
            state.operation.response.status
          ) &&
          !state.contentLoaded &&
          !isDictionaryAnalysisContentCurrent(state.operation, {
            wordId,
            mode: card?.mode,
            entryId,
            revisionId,
            headSequence: sequence,
          }) &&
          !state.blocked && (
            <TouchableOpacity
              accessibilityRole="button"
              disabled={state.busy}
              accessibilityState={{ disabled: state.busy }}
              style={[styles.actionButton, styles.reanalyzeButton]}
              onPress={() => {
                void action.loadPublished()
              }}
            >
              <TextThemed
                style={[styles.actionButtonText, styles.reanalyzeButtonText]}
              >
                Load published content
              </TextThemed>
            </TouchableOpacity>
          )}
        {state.operation?.submitted && !state.blocked && (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ disabled: state.busy }}
            disabled={state.busy}
            style={[styles.actionButton, styles.reanalyzeButton]}
            onPress={() => {
              void action.recover()
            }}
          >
            <TextThemed
              style={[styles.actionButtonText, styles.reanalyzeButtonText]}
            >
              {state.busy ? 'Checking…' : 'Check analysis status'}
            </TextThemed>
          </TouchableOpacity>
        )}
        {!state.blocked && (
          <TouchableOpacity
            accessibilityRole="button"
            disabled={state.busy}
            accessibilityState={{ disabled: state.busy }}
            style={[styles.actionButton, styles.reanalyzeButton]}
            onPress={() => {
              void action.loadHistory()
            }}
          >
            <TextThemed
              style={[styles.actionButtonText, styles.reanalyzeButtonText]}
            >
              View analysis history
            </TextThemed>
          </TouchableOpacity>
        )}
      </NonSwipeableArea>
      {state.history && (
        <ViewThemed>
          <TextThemed>
            Archived analysis attempts ({state.history.length})
          </TextThemed>
          {state.history.map((operation, index) => (
            <TextThemed key={operation.command.operation_id}>
              {state.history!.length - index}.{' '}
              {dictionaryAnalysisActionMessage(operation)}
            </TextThemed>
          ))}
        </ViewThemed>
      )}
    </ViewThemed>
  )
}

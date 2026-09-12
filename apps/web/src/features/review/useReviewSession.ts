'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import {
  autoAdvanceReview,
  browseReviewHistory,
  closeReviewDetails,
  getAllowedReviewAssessments,
  getReviewAutoAdvance,
  openReviewDetails,
  previousReviewWord,
  returnToReviewQuestion,
  revealReviewAnswer,
  setReviewForeground,
  setReviewManualRecognition,
  skipAssistedReview,
  summarizeReviewFlow,
} from '@woordenaar/domain'
import { submitReviewAssessment } from './actions'
import { submitReviewCorrection } from './correction-actions'
import { loadReviewCorrectionState } from './correction-refresh'
import { createReviewSessionController } from './session-controller'
import {
  getPreferredTranslation,
  getRussianTranslation,
  getReviewAnswer,
  selectReviewWords,
} from './review-domain'
import type {
  RecognitionOption,
  ReviewScope,
  ReviewSessionMode,
  ReviewWorkspaceData,
} from './types'

export function useReviewSession(
  data: ReviewWorkspaceData,
  initialScope: ReviewScope,
  initialCollectionId: string | null,
  userId: string,
  initialMode: ReviewSessionMode = 'adaptive'
) {
  const [controller] = useState(() =>
    createReviewSessionController(userId, data, submitReviewAssessment, {
      submit: submitReviewCorrection,
      refresh: loadReviewCorrectionState,
    })
  )
  const {
    flow,
    words,
    correction,
    correctionsAvailable,
    blockedCorrections,
    notice,
    noticeEventId,
    preparation,
    detailRevision,
  } = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getServerSnapshot
  )
  const [mode, setMode] = useState(initialMode)
  const [scope, setScope] = useState(initialScope)
  const [collectionId, setCollectionId] = useState(initialCollectionId)
  const [manualRecognition, setManualPreference] = useState(false)
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null)
  const dueWords = useMemo(
    () => selectReviewWords(words, scope, collectionId),
    [words, scope, collectionId]
  )

  useEffect(() => {
    controller.attach()
    const visibility = () => {
      if (document.hidden) controller.cancelPreparation()
      controller.transition(state =>
        setReviewForeground(state, !document.hidden)
      )
    }
    visibility()
    document.addEventListener('visibilitychange', visibility)
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!controller.getSnapshot().flow) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => {
      controller.detach()
      document.removeEventListener('visibilitychange', visibility)
      window.removeEventListener('beforeunload', beforeUnload)
    }
  }, [controller])

  useEffect(() => {
    if (!flow) return
    const ticket = getReviewAutoAdvance(flow)
    if (!ticket) return
    const timer = window.setTimeout(
      () => {
        controller.transition(state =>
          setReviewForeground(state, !document.hidden)
        )
        controller.transition(state =>
          autoAdvanceReview(state, ticket, Date.now())
        )
      },
      Math.max(0, ticket.notBefore - Date.now())
    )
    return () => window.clearTimeout(timer)
  }, [controller, flow])

  const setManualRecognition = useCallback(
    (value: boolean) => {
      setManualPreference(value)
      controller.transition(state => setReviewManualRecognition(state, value))
    },
    [controller]
  )
  const start = () => {
    void controller
      .start(scope, collectionId, mode, manualRecognition)
      .then(result => {
        if (result === 'empty') {
          if (!controller.exit()) return
          setEmptyMessage('No words are due in this scope. Try another scope.')
          return
        }
        if (result === 'started') {
          controller.transition(state =>
            setReviewForeground(state, !document.hidden)
          )
          setEmptyMessage(null)
        }
      })
  }
  const historyEntry =
    flow?.view.kind === 'history' ? flow.history[flow.view.index] : null
  const displayed = historyEntry?.question ?? flow?.active
  const currentWord = displayed?.question.payload.word ?? null
  const effectiveMode = displayed?.question.mode ?? 'meaning-recall'
  const options =
    displayed?.question.options.map(option => ({ ...option })) ?? []
  const summary = flow ? summarizeReviewFlow(flow) : null
  const sessionWords = flow
    ? [
        ...flow.history.map(entry => entry.question.question.payload.word),
        ...(flow.active ? [flow.active.question.payload.word] : []),
        ...flow.remaining.map(question => question.payload.word),
      ]
    : []
  const status = flow?.active?.submission?.status

  return {
    correction,
    correctionsAvailable,
    blockedCorrections,
    notice:
      historyEntry?.result.kind === 'assessed' &&
      historyEntry.result.eventId === noticeEventId
        ? notice
        : null,
    detailRevision,
    correct: controller.correct,
    retryCorrection: controller.retryCorrection,
    keepServerVersion: controller.keepServerVersion,
    flow,
    historyEntry,
    summary,
    manualRecognition,
    setManualRecognition,
    adaptiveMessage: displayed?.question.payload.adaptiveMessage ?? null,
    answer: currentWord ? getReviewAnswer(currentWord, effectiveMode) : '',
    assessed:
      Boolean(historyEntry) || displayed?.submission?.status === 'saved',
    assessmentCounts: summary?.counts ?? {
      again: 0,
      hard: 0,
      good: 0,
      easy: 0,
    },
    collectionId,
    currentIndex:
      flow?.view.kind === 'history'
        ? flow.view.index
        : (flow?.history.length ?? 0),
    currentWord,
    dueWords,
    dueCount: dueWords.length,
    effectiveMode,
    emptyMessage,
    error: flow?.active?.submission?.error ?? null,
    mode,
    pending: status === 'saving',
    preparation,
    unsettled:
      Boolean(correction) || status === 'saving' || status === 'failed',
    recognitionOptions: options.length ? options : null,
    revealed: historyEntry ? true : (displayed?.revealed ?? false),
    selectedOption:
      options.find(option => option.id === displayed?.selectedOptionId) ?? null,
    sessionWords,
    stage: !flow
      ? 'setup'
      : summary?.finished && !historyEntry
        ? 'complete'
        : 'review',
    translation: currentWord ? getPreferredTranslation(currentWord) : null,
    russianTranslation: currentWord ? getRussianTranslation(currentWord) : null,
    allowedAssessments: flow ? getAllowedReviewAssessments(flow) : [],
    detailsVisible:
      flow?.view.kind === 'details' ||
      (flow?.view.kind === 'history' && flow.view.details),
    openDetails: () => controller.transition(openReviewDetails),
    closeDetails: () => controller.transition(closeReviewDetails),
    returnToCurrent: () => controller.transition(returnToReviewQuestion),
    browseHistory: (index: number) =>
      controller.transition(state => browseReviewHistory(state, index)),
    skip: () =>
      controller.transition(state =>
        state.active
          ? skipAssistedReview(state, state.active.question.id, Date.now())
          : state
      ),
    changeMode: () => {
      controller.exit()
    },
    goTo: (direction: -1 | 1) =>
      controller.transition(state => {
        if (direction === -1) return previousReviewWord(state)
        if (state.view.kind !== 'history') return state
        return state.view.index + 1 < state.history.length
          ? browseReviewHistory(state, state.view.index + 1)
          : returnToReviewQuestion(state)
      }),
    selectOption: (option: RecognitionOption) =>
      controller.selectOption(option.id),
    setCollectionId,
    setMode,
    setScope,
    start,
    cancelPreparation: controller.cancelPreparation,
    submit: controller.submit,
    scope,
    setRevealed: (value: boolean) => {
      if (value)
        controller.transition(state =>
          state.active
            ? revealReviewAnswer(state, state.active.question.id, Date.now())
            : state
        )
    },
  }
}

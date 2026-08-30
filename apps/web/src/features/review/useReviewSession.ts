'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { submitReviewAssessment } from './actions'
import {
  buildRecognitionOptions,
  getLocalReviewDate,
  getPreferredTranslation,
  getReviewAnswer,
  groupAdaptiveDecisions,
  MAX_REVIEW_RESPONSE_TIME_MS,
  selectReviewWords,
} from './review-domain'
import type {
  RecognitionOption,
  ReviewAssessment,
  ReviewScope,
  ReviewSessionMode,
  ReviewSubmissionInput,
  ReviewWord,
  ReviewWorkspaceData,
} from './types'

type SessionStage = 'setup' | 'review' | 'complete'

const getNextUnassessedIndex = (
  words: readonly ReviewWord[],
  assessedIds: ReadonlySet<string>,
  currentIndex: number
) => {
  for (let offset = 1; offset <= words.length; offset += 1) {
    const index = (currentIndex + offset) % words.length
    if (!assessedIds.has(words[index].id)) return index
  }
  return currentIndex
}

const getAdaptiveMessage = (
  mode: ReviewSessionMode,
  decision: ReturnType<typeof groupAdaptiveDecisions>[string] | undefined
) => {
  if (mode !== 'adaptive' || !decision) return null
  if (decision.reason === 'promotion') {
    return `Adaptive challenge promoted this word to ${decision.mode}.`
  }
  if (decision.reason === 'demotion') {
    return `Adaptive challenge moved this word back to ${decision.mode}.`
  }
  return 'Adaptive challenge starts this word in recognition mode.'
}

export function useReviewSession(
  data: ReviewWorkspaceData,
  initialScope: ReviewScope,
  initialCollectionId: string | null,
  initialMode: ReviewSessionMode = 'adaptive'
) {
  const [words, setWords] = useState(data.words)
  const [events, setEvents] = useState(data.events)
  const [mode, setMode] = useState<ReviewSessionMode>(initialMode)
  const [scope, setScope] = useState(initialScope)
  const [collectionId, setCollectionId] = useState(initialCollectionId)
  const [sessionWords, setSessionWords] = useState<ReviewWord[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [assessedIds, setAssessedIds] = useState<ReadonlySet<string>>(new Set())
  const [assessmentCounts, setAssessmentCounts] = useState<
    Record<ReviewAssessment, number>
  >({ again: 0, hard: 0, good: 0, easy: 0 })
  const [stage, setStage] = useState<SessionStage>('setup')
  const [revealed, setRevealed] = useState(false)
  const [selectedOption, setSelectedOption] =
    useState<RecognitionOption | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emptyMessage, setEmptyMessage] = useState<string | null>(null)
  const responseStartedAtRef = useRef(0)
  const retryInputRef = useRef<ReviewSubmissionInput | null>(null)

  const dueWords = useMemo(
    () => selectReviewWords(words, scope, collectionId),
    [collectionId, scope, words]
  )
  const adaptiveDecisions = useMemo(
    () => groupAdaptiveDecisions(words, events),
    [events, words]
  )
  const currentWord = sessionWords[currentIndex] ?? null
  const configuredMode = currentWord
    ? mode === 'adaptive'
      ? (adaptiveDecisions[currentWord.id]?.mode ?? 'recognition')
      : mode
    : 'meaning-recall'
  const recognitionOptions = useMemo(
    () =>
      currentWord && configuredMode === 'recognition'
        ? buildRecognitionOptions(currentWord, words)
        : null,
    [configuredMode, currentWord, words]
  )
  const effectiveMode =
    configuredMode === 'recognition' && !recognitionOptions
      ? 'meaning-recall'
      : configuredMode
  const translation = currentWord ? getPreferredTranslation(currentWord) : null
  const answer = currentWord ? getReviewAnswer(currentWord, effectiveMode) : ''
  const adaptiveMessage = getAdaptiveMessage(
    mode,
    currentWord ? adaptiveDecisions[currentWord.id] : undefined
  )

  const resetCardState = useCallback(() => {
    setRevealed(false)
    setSelectedOption(null)
    setError(null)
    responseStartedAtRef.current = Date.now()
    retryInputRef.current = null
  }, [])

  const start = useCallback(() => {
    const nextWords = selectReviewWords(words, scope, collectionId)
    if (nextWords.length === 0) {
      setEmptyMessage('No words are due in this scope. Try another scope.')
      setStage('setup')
      return
    }

    setSessionWords(nextWords)
    setCurrentIndex(0)
    setAssessedIds(new Set())
    setAssessmentCounts({ again: 0, hard: 0, good: 0, easy: 0 })
    setEmptyMessage(null)
    resetCardState()
    setStage('review')
  }, [collectionId, resetCardState, scope, words])

  const goTo = useCallback(
    (direction: -1 | 1) => {
      if (sessionWords.length < 2 || pending) return
      resetCardState()
      setCurrentIndex(
        index => (index + direction + sessionWords.length) % sessionWords.length
      )
    },
    [pending, resetCardState, sessionWords.length]
  )

  const submit = useCallback(
    async (assessment: ReviewAssessment) => {
      if (!currentWord || pending || assessedIds.has(currentWord.id)) return

      const answeredCorrectly =
        effectiveMode === 'recognition'
          ? (selectedOption?.isCorrect ?? null)
          : null
      const retryInput = retryInputRef.current
      const input =
        retryInput?.assessment === assessment
          ? retryInput
          : {
              answeredCorrectly,
              assessment,
              eventId: crypto.randomUUID(),
              responseTimeMs: Math.min(
                MAX_REVIEW_RESPONSE_TIME_MS,
                Math.max(0, Date.now() - responseStartedAtRef.current)
              ),
              reviewDate: getLocalReviewDate(),
              reviewedAt: new Date().toISOString(),
              reviewMode: effectiveMode,
              wordId: currentWord.id,
            }

      retryInputRef.current = input
      setPending(true)
      setError(null)

      try {
        const result = await submitReviewAssessment(input)
        if (result.status === 'error') {
          setError(result.message)
          return
        }

        retryInputRef.current = null
        const updateWord = (word: ReviewWord) =>
          word.id === result.update.wordId
            ? {
                ...word,
                easinessFactor: result.update.easinessFactor,
                intervalDays: result.update.intervalDays,
                lastReviewedAt: result.update.lastReviewedAt,
                nextReviewDate: result.update.nextReviewDate,
                repetitionCount: result.update.repetitionCount,
              }
            : word
        setWords(current => current.map(updateWord))
        setSessionWords(current => current.map(updateWord))
        setEvents(current => [
          {
            answeredCorrectly: input.answeredCorrectly,
            assessment: input.assessment,
            eventId: input.eventId,
            reviewMode: input.reviewMode,
            reviewedAt: input.reviewedAt,
            wordId: input.wordId,
          },
          ...current,
        ])
        setAssessmentCounts(current => ({
          ...current,
          [assessment]: current[assessment] + 1,
        }))

        const nextAssessedIds = new Set(assessedIds).add(currentWord.id)
        setAssessedIds(nextAssessedIds)
        if (nextAssessedIds.size === sessionWords.length) {
          setStage('complete')
        } else {
          resetCardState()
          setCurrentIndex(
            getNextUnassessedIndex(sessionWords, nextAssessedIds, currentIndex)
          )
        }
      } catch {
        setError('Could not save this review. Please try again.')
      } finally {
        setPending(false)
      }
    },
    [
      assessedIds,
      currentIndex,
      currentWord,
      effectiveMode,
      pending,
      resetCardState,
      selectedOption?.isCorrect,
      sessionWords,
    ]
  )

  const selectOption = useCallback((option: RecognitionOption) => {
    setSelectedOption(option)
    setRevealed(true)
  }, [])

  const changeMode = useCallback(() => {
    setStage('setup')
    setEmptyMessage(null)
  }, [])

  return {
    adaptiveMessage,
    answer,
    assessed: currentWord ? assessedIds.has(currentWord.id) : false,
    assessmentCounts,
    collectionId,
    currentIndex,
    currentWord,
    dueWords,
    dueCount: dueWords.length,
    effectiveMode,
    emptyMessage,
    error,
    mode,
    pending,
    recognitionOptions,
    revealed,
    selectedOption,
    sessionWords,
    stage,
    translation,
    changeMode,
    goTo,
    selectOption,
    setCollectionId,
    setMode,
    setRevealed,
    setScope,
    start,
    submit,
    scope,
  }
}

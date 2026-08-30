'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useWebSettings } from '@/features/settings/useWebSettings'
import { ReviewCard } from './ReviewCard'
import { ReviewSetup } from './ReviewSetup'
import { useReviewSession } from './useReviewSession'
import type {
  ReviewAssessment,
  ReviewScope,
  ReviewWorkspaceData,
} from './types'

interface ReviewWorkspaceProps {
  data: ReviewWorkspaceData
  initialCollectionId: string | null
  initialScope: ReviewScope
  userId: string
}

const Completion = ({
  counts,
  onChangeMode,
  onRestart,
  total,
}: {
  counts: Record<ReviewAssessment, number>
  onChangeMode: () => void
  onRestart: () => void
  total: number
}) => (
  <section className="mx-auto max-w-2xl rounded-3xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
      Session complete
    </p>
    <h1 className="mt-2 text-3xl font-semibold tracking-tight">Great work!</h1>
    <p className="mt-3 text-neutral-600 dark:text-neutral-400">
      You reviewed {total} {total === 1 ? 'word' : 'words'}.
    </p>
    <dl className="mt-7 grid grid-cols-4 gap-3">
      {(Object.entries(counts) as [ReviewAssessment, number][]).map(
        ([assessment, count]) => (
          <div
            className="rounded-xl bg-neutral-100 p-3 dark:bg-neutral-800"
            key={assessment}
          >
            <dt className="text-xs capitalize text-neutral-500">
              {assessment}
            </dt>
            <dd className="mt-1 text-xl font-semibold">{count}</dd>
          </div>
        )
      )}
    </dl>
    <div className="mt-7 flex flex-wrap justify-center gap-3">
      <button
        className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-950"
        onClick={onRestart}
        type="button"
      >
        Review due words again
      </button>
      <button
        className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium dark:border-neutral-700"
        onClick={onChangeMode}
        type="button"
      >
        Change mode
      </button>
    </div>
  </section>
)

export function ReviewWorkspace({
  data,
  initialCollectionId,
  initialScope,
  userId,
}: ReviewWorkspaceProps) {
  const session = useReviewSession(data, initialScope, initialCollectionId)
  const { isHydrated, settings, update } = useWebSettings(userId)
  const appliedPreferencesRef = useRef(false)
  const setSessionCollectionId = session.setCollectionId
  const setSessionMode = session.setMode

  const playPronunciation = useCallback(() => {
    const word = session.currentWord
    if (!word) return

    const speakWithBrowser = () => {
      if (!('speechSynthesis' in window)) return
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(word.dutchLemma)
      utterance.lang = 'nl-NL'
      window.speechSynthesis.speak(utterance)
    }

    if (word.ttsUrl) {
      void new Audio(word.ttsUrl).play().catch(speakWithBrowser)
      return
    }

    speakWithBrowser()
  }, [session.currentWord])

  useEffect(() => {
    if (!isHydrated || appliedPreferencesRef.current) return
    appliedPreferencesRef.current = true

    const preferredMode =
      settings.adaptiveReviewEnabled ||
      settings.lastSelectedReviewMode !== 'adaptive'
        ? settings.lastSelectedReviewMode
        : 'meaning-recall'
    setSessionMode(preferredMode)

    if (
      !initialCollectionId &&
      settings.lastSelectedCollectionId &&
      data.collections.some(
        collection => collection.id === settings.lastSelectedCollectionId
      )
    ) {
      setSessionCollectionId(settings.lastSelectedCollectionId)
    }
  }, [
    data.collections,
    initialCollectionId,
    isHydrated,
    setSessionCollectionId,
    setSessionMode,
    settings,
  ])

  useEffect(() => {
    if (
      !settings.autoPlayPronunciation ||
      session.stage !== 'review' ||
      !session.currentWord
    ) {
      return
    }

    playPronunciation()
  }, [
    playPronunciation,
    session.currentWord,
    session.stage,
    settings.autoPlayPronunciation,
  ])

  useEffect(() => {
    if (session.stage !== 'review') return

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement
      ) {
        return
      }

      if (event.key === 'ArrowLeft') session.goTo(-1)
      if (event.key === 'ArrowRight') session.goTo(1)
      if (event.key === ' ' && session.effectiveMode !== 'recognition') {
        event.preventDefault()
        session.setRevealed(true)
      }
      if (!session.revealed || session.assessed) return

      const assessmentByKey: Partial<Record<string, ReviewAssessment>> = {
        '1': 'again',
        '2': 'hard',
        '3': 'good',
        '4': 'easy',
      }
      const assessment = assessmentByKey[event.key]
      const wrongRecognition =
        session.effectiveMode === 'recognition' &&
        session.selectedOption?.isCorrect === false
      if (wrongRecognition && assessment !== 'again') return
      if (session.effectiveMode === 'recognition' && assessment === 'again') {
        if (!wrongRecognition) return
      }
      if (assessment) void session.submit(assessment)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [session])

  if (session.stage === 'setup') {
    return (
      <ReviewSetup
        adaptiveReviewEnabled={settings.adaptiveReviewEnabled}
        collectionId={session.collectionId}
        collections={data.collections}
        dueCount={session.dueCount}
        emptyMessage={session.emptyMessage}
        mode={session.mode}
        onCollectionChange={value => {
          session.setCollectionId(value)
          update({ lastSelectedCollectionId: value })
        }}
        onModeChange={value => {
          session.setMode(value)
          update({ lastSelectedReviewMode: value })
        }}
        onScopeChange={value => {
          session.setScope(value)
          if (value === 'collection-due' && !session.collectionId) {
            session.setCollectionId(data.collections[0]?.id ?? null)
          }
        }}
        onStart={session.start}
        scope={session.scope}
      />
    )
  }

  if (session.stage === 'complete') {
    return (
      <Completion
        counts={session.assessmentCounts}
        onChangeMode={session.changeMode}
        onRestart={session.start}
        total={session.sessionWords.length}
      />
    )
  }

  if (!session.currentWord) return null

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-neutral-500">
            {session.assessed ? 'Reviewed' : 'Current card'}
          </p>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Card {session.currentIndex + 1} of {session.sessionWords.length} ·{' '}
            {session.assessmentCounts.again +
              session.assessmentCounts.hard +
              session.assessmentCounts.good +
              session.assessmentCounts.easy}{' '}
            complete
          </p>
        </div>
        <button
          className="text-sm text-neutral-600 hover:underline dark:text-neutral-400"
          onClick={session.changeMode}
          type="button"
        >
          End session
        </button>
      </div>

      <ReviewCard
        adaptiveMessage={session.adaptiveMessage}
        answer={session.answer}
        assessed={session.assessed}
        error={session.error}
        mode={session.effectiveMode}
        onAssessment={assessment => void session.submit(assessment)}
        onPlayPronunciation={playPronunciation}
        onReveal={() => session.setRevealed(true)}
        onSelectOption={session.selectOption}
        options={session.recognitionOptions}
        pending={session.pending}
        revealed={session.revealed}
        selectedOption={session.selectedOption}
        translation={session.translation}
        word={session.currentWord}
      />

      <div className="mx-auto mt-5 flex max-w-3xl items-center justify-between gap-4">
        <button
          className="rounded-xl border border-neutral-300 px-4 py-2 text-sm disabled:opacity-40 dark:border-neutral-700"
          disabled={session.sessionWords.length < 2 || session.pending}
          onClick={() => session.goTo(-1)}
          type="button"
        >
          ← Previous
        </button>
        <p className="hidden text-xs text-neutral-500 sm:block">
          Space reveals · 1–4 rates · arrows navigate
        </p>
        <button
          className="rounded-xl border border-neutral-300 px-4 py-2 text-sm disabled:opacity-40 dark:border-neutral-700"
          disabled={session.sessionWords.length < 2 || session.pending}
          onClick={() => session.goTo(1)}
          type="button"
        >
          Next →
        </button>
      </div>
    </section>
  )
}

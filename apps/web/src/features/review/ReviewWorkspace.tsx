'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Headphones, Volume2, X } from 'lucide-react'
import { useCallback, useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useWebSettings } from '@/features/settings/useWebSettings'
import { ReviewCard } from './ReviewCard'
import { ReviewSetup } from './ReviewSetup'
import { useReviewSession } from './useReviewSession'
import type {
  ReviewAssessment,
  ReviewScope,
  ReviewWorkspaceData,
} from './types'
import styles from './Review.module.css'

const MODE_LABELS = {
  recognition: 'Recognition',
  'meaning-recall': 'Meaning recall',
  'dutch-production': 'Dutch production',
} as const

function Completion({
  counts,
  onChangeMode,
  onRestart,
  total,
}: {
  counts: Record<ReviewAssessment, number>
  onChangeMode: () => void
  onRestart: () => void
  total: number
}) {
  return (
    <section className={styles.completion}>
      <span aria-hidden="true" className={styles.completionIcon}>
        <Check size={28} strokeWidth={2.2} />
      </span>
      <h1>Session complete</h1>
      <p className="dw-support">
        You reviewed {total} {total === 1 ? 'word' : 'words'}. Progress is
        saved.
      </p>

      <dl className={styles.completionStats}>
        {(Object.entries(counts) as [ReviewAssessment, number][]).map(
          ([assessment, count]) => (
            <div
              className={`${styles.completionStat} ${styles[assessment]}`}
              key={assessment}
            >
              <dt>{assessment}</dt>
              <dd>{count}</dd>
            </div>
          )
        )}
      </dl>

      {counts.again > 0 && (
        <p className={styles.attention}>
          {counts.again} {counts.again === 1 ? 'word needs' : 'words need'} a
          little more attention. They will return soon.
        </p>
      )}

      <div className={styles.completionActions}>
        <Button onClick={onRestart} type="button">
          Review due words again
        </Button>
        <Button onClick={onChangeMode} type="button" variant="secondary">
          Change mode
        </Button>
        <Link className="dw-button dw-button--secondary" href="/app/insights">
          View insights
        </Link>
        <Link className="dw-button dw-button--ghost" href="/app/collections">
          Back to collections
        </Link>
      </div>
    </section>
  )
}

export function ReviewWorkspace({
  data,
  initialCollectionId,
  initialScope,
  userId,
}: ReviewWorkspaceProps) {
  const session = useReviewSession(data, initialScope, initialCollectionId)
  const router = useRouter()
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

  const {
    assessed,
    currentWord,
    effectiveMode,
    pending,
    recognitionOptions,
    revealed,
    selectedOption,
  } = session

  useEffect(() => {
    if (session.stage !== 'review') return

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target
      if (
        target instanceof HTMLButtonElement ||
        target instanceof HTMLInputElement ||
        target instanceof HTMLSelectElement ||
        target instanceof HTMLTextAreaElement ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.repeat
      ) {
        return
      }

      if (event.key === 'Escape') {
        session.changeMode()
        return
      }
      if (event.key.toLowerCase() === 'p') {
        playPronunciation()
        return
      }
      if (event.key.toLowerCase() === 'd' && currentWord?.collectionId) {
        router.push(
          `/app/collections/${currentWord.collectionId}/words/${currentWord.id}`
        )
        return
      }
      if (event.key === 'ArrowLeft') session.goTo(-1)
      if (event.key === 'ArrowRight') session.goTo(1)

      const optionIndex = Number(event.key) - 1
      if (
        effectiveMode === 'recognition' &&
        !revealed &&
        optionIndex >= 0 &&
        optionIndex < (recognitionOptions?.length ?? 0)
      ) {
        const option = recognitionOptions?.[optionIndex]
        if (option) session.selectOption(option)
        return
      }

      if (event.key === ' ') {
        event.preventDefault()
        if (!revealed && effectiveMode !== 'recognition') {
          session.setRevealed(true)
          return
        }
        if (revealed && !assessed) {
          const assessment =
            effectiveMode === 'recognition' &&
            selectedOption?.isCorrect === false
              ? 'again'
              : 'good'
          void session.submit(assessment)
        }
        return
      }

      if (!revealed || assessed || pending || effectiveMode === 'recognition') {
        return
      }
      const assessmentByKey: Partial<Record<string, ReviewAssessment>> = {
        '1': 'again',
        '2': 'hard',
        '3': 'good',
        '4': 'easy',
      }
      const assessment = assessmentByKey[event.key]
      if (assessment) void session.submit(assessment)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [
    assessed,
    currentWord,
    effectiveMode,
    pending,
    playPronunciation,
    recognitionOptions,
    revealed,
    router,
    selectedOption?.isCorrect,
    session,
  ])

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

  const completedCount = Object.values(session.assessmentCounts).reduce(
    (total, count) => total + count,
    0
  )
  const progress =
    ((session.currentIndex + 1) / session.sessionWords.length) * 100
  const modeLabel = MODE_LABELS[session.effectiveMode]

  return (
    <section className={`dw-review-focus ${styles.focus}`}>
      <header className={styles.sessionTopbar}>
        <button
          className={styles.exit}
          onClick={session.changeMode}
          type="button"
        >
          <X aria-hidden="true" size={18} /> <span>Exit</span>
          <span className={styles.key}>Esc</span>
        </button>
        <div className={styles.sessionProgress}>
          <div
            className="dw-progress"
            role="progressbar"
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <span>
            {session.currentIndex + 1} / {session.sessionWords.length}
          </span>
        </div>
        <div className={styles.sessionMeta}>
          <Badge className={styles.modeChip} tone="accent">
            {session.mode === 'adaptive'
              ? `Adaptive → ${modeLabel}`
              : modeLabel}
          </Badge>
          <button
            aria-label="Play pronunciation"
            className="dw-icon-button"
            onClick={playPronunciation}
            type="button"
          >
            {session.effectiveMode === 'dutch-production' ? (
              <Headphones aria-hidden="true" size={17} />
            ) : (
              <Volume2 aria-hidden="true" size={17} />
            )}
          </button>
        </div>
      </header>

      <div className={styles.sessionBody}>
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

        <footer className={styles.sessionFooter}>
          <span>{completedCount} completed</span>
          <span>Space continue · P audio · D details · Esc exit</span>
        </footer>
      </div>
    </section>
  )
}

interface ReviewWorkspaceProps {
  data: ReviewWorkspaceData
  initialCollectionId: string | null
  initialScope: ReviewScope
  userId: string
}

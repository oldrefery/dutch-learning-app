'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef } from 'react'
import { WordDetailCard } from '@/features/words/WordDetailCard'
import type { WordDetail } from '@/features/words/word-detail'
import { getPreferredTranslation } from './review-domain'
import type { ReviewWorkspaceData } from './types'
import { useAudioReviewPlayback } from './useAudioReviewPlayback'
import { useReviewSession } from './useReviewSession'

const toWordDetail = (
  word: ReviewWorkspaceData['words'][number],
  translation: string | null
): WordDetail => ({
  analysisNotes: null,
  antonyms: [],
  article: word.article,
  collectionId: word.collectionId,
  conjugation: null,
  createdAt: word.lastReviewedAt ?? '1970-01-01T00:00:00.000Z',
  dutchLemma: word.dutchLemma,
  dutchOriginal: word.dutchOriginal,
  easinessFactor: word.easinessFactor,
  examples: [],
  expressionType: null,
  id: word.id,
  imageUrl: word.imageUrl,
  intervalDays: word.intervalDays,
  isExpression: false,
  isIrregular: false,
  isReflexive: false,
  isSeparable: false,
  lastReviewedAt: word.lastReviewedAt,
  nextReviewDate: word.nextReviewDate,
  partOfSpeech: word.partOfSpeech,
  plural: null,
  prefixPart: null,
  preposition: null,
  register: null,
  repetitionCount: word.repetitionCount,
  rootVerb: null,
  synonyms: [],
  translations: { en: translation ? [translation] : [], ru: [] },
  ttsUrl: word.ttsUrl,
  updatedAt: null,
  usageNotes: null,
})

export function AudioReviewWorkspace({ data }: { data: ReviewWorkspaceData }) {
  const session = useReviewSession(data, 'all-due', null, 'meaning-recall')
  const playback = useAudioReviewPlayback()
  const playedWordIdRef = useRef<string | null>(null)
  const translation = session.currentWord
    ? getPreferredTranslation(session.currentWord)
    : null

  const start = useCallback(() => {
    const firstWord = session.dueWords[0]
    if (!firstWord) return
    playedWordIdRef.current = firstWord.id
    session.start()
    void playback.play(firstWord)
  }, [playback, session])

  const reveal = useCallback(() => {
    if (!session.currentWord) return
    session.setRevealed(true)
    void playback.play(session.currentWord)
  }, [playback, session])

  const submit = useCallback(
    async (assessment: 'again' | 'good') => {
      playback.stop()
      await session.submit(assessment)
    },
    [playback, session]
  )

  useEffect(() => {
    const word = session.currentWord
    if (
      session.stage !== 'review' ||
      !word ||
      playedWordIdRef.current === word.id
    ) {
      return
    }

    playedWordIdRef.current = word.id
    void playback.play(word)
  }, [playback, session.currentWord, session.stage])

  useEffect(() => {
    if (session.stage !== 'review') return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === ' ' && !session.revealed) {
        event.preventDefault()
        reveal()
      }
      if (event.key.toLocaleLowerCase() === 'r' && session.currentWord) {
        void playback.play(session.currentWord)
      }
      if (event.key.toLocaleLowerCase() === 'p') playback.togglePause()
      if (!session.revealed || session.pending) return
      if (event.key === '1') void submit('again')
      if (event.key === '3') void submit('good')
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [playback, reveal, session, submit])

  if (session.stage === 'setup') {
    return (
      <section className="mx-auto max-w-2xl rounded-3xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
          Foreground listening session
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Audio Review
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-sm text-neutral-600 dark:text-neutral-400">
          Listen to each Dutch prompt, recall its meaning, then reveal and rate
          it. Playback pauses when this tab goes into the background.
        </p>
        <p className="mt-6 text-sm text-neutral-600 dark:text-neutral-400">
          {session.dueCount} {session.dueCount === 1 ? 'word is' : 'words are'}{' '}
          due.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-neutral-100 dark:text-neutral-950"
            disabled={session.dueCount === 0}
            onClick={start}
            type="button"
          >
            Start Audio Review
          </button>
          <Link
            className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium dark:border-neutral-700"
            href="/app/review"
          >
            Back to review modes
          </Link>
        </div>
      </section>
    )
  }

  if (session.stage === 'complete') {
    return (
      <section className="mx-auto max-w-2xl rounded-3xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
          Audio Review complete
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Session saved
        </h1>
        <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">
          Again: {session.assessmentCounts.again} · Good:{' '}
          {session.assessmentCounts.good}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-950"
            onClick={start}
            type="button"
          >
            Review due words again
          </button>
          <Link
            className="rounded-xl border border-neutral-300 px-5 py-2.5 text-sm font-medium dark:border-neutral-700"
            href="/app/review"
          >
            Exit Audio Review
          </Link>
        </div>
      </section>
    )
  }

  if (!session.currentWord) return null

  const currentWord = session.currentWord

  return (
    <section className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
            Audio Review
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {session.currentIndex + 1} / {session.sessionWords.length}
          </p>
        </div>
        <Link
          className="text-sm text-neutral-600 hover:underline dark:text-neutral-400"
          href="/app/review"
          onClick={playback.stop}
        >
          Exit
        </Link>
      </div>

      <article className="mt-5 rounded-3xl border border-neutral-200 bg-white p-8 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <p className="text-sm text-neutral-500">
          {playback.isPaused
            ? 'Playback paused'
            : playback.isPlaying
              ? 'Playing Dutch prompt…'
              : 'Listen, recall, then reveal'}
        </p>
        <h1 className="mt-5 text-5xl font-semibold tracking-tight">
          {currentWord.dutchLemma}
        </h1>
        {playback.playbackMessage && (
          <p
            aria-live="polite"
            className="mt-4 text-sm text-amber-700 dark:text-amber-300"
          >
            {playback.playbackMessage}
          </p>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700"
            onClick={() => void playback.play(currentWord)}
            type="button"
          >
            Replay
          </button>
          <button
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium disabled:opacity-40 dark:border-neutral-700"
            disabled={!playback.isPlaying && !playback.isPaused}
            onClick={playback.togglePause}
            type="button"
          >
            {playback.isPaused ? 'Resume' : 'Pause'}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {!session.revealed ? (
            <button
              className="rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-950"
              onClick={reveal}
              type="button"
            >
              Show answer
            </button>
          ) : (
            <>
              <button
                className="rounded-xl bg-rose-700 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
                disabled={session.pending}
                onClick={() => void submit('again')}
                type="button"
              >
                Again
              </button>
              <button
                className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-40"
                disabled={session.pending}
                onClick={() => void submit('good')}
                type="button"
              >
                Good
              </button>
            </>
          )}
        </div>
        <p className="mt-6 text-xs text-neutral-500">
          Space reveals · R replays · P pauses · 1 Again · 3 Good
        </p>
        {session.error && (
          <p aria-live="polite" className="mt-4 text-sm text-rose-700">
            {session.error}
          </p>
        )}
      </article>
      {session.revealed && (
        <div aria-live="polite" className="mt-5">
          <WordDetailCard word={toWordDetail(currentWord, translation)} />
        </div>
      )}
    </section>
  )
}

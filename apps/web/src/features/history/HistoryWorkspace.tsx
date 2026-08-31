'use client'

import Link from 'next/link'
import { useCallback, useSyncExternalStore } from 'react'
import {
  getAnalysisHistoryServerSnapshot,
  getAnalysisHistorySnapshot,
  subscribeToAnalysisHistory,
} from './analysis-history'
import type { ReviewHistoryEvent } from './types'

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))

const formatMode = (value: string) =>
  value
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const formatResponseTime = (milliseconds: number | null) => {
  if (milliseconds === null) return null
  return milliseconds < 1_000
    ? `${milliseconds} ms`
    : `${(milliseconds / 1_000).toFixed(1)} s`
}

const ReviewEventCard = ({ event }: { event: ReviewHistoryEvent }) => {
  const heading = event.dutchLemma ?? 'Word no longer available'
  const responseTime = formatResponseTime(event.responseTimeMs)
  const title = event.collectionId ? (
    <Link
      className="rounded-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-neutral-500"
      href={`/app/collections/${event.collectionId}/words/${event.wordId}`}
    >
      {heading}
    </Link>
  ) : (
    heading
  )

  return (
    <article className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {formatMode(event.reviewMode)}
            {event.collectionName ? ` · ${event.collectionName}` : ''}
          </p>
        </div>
        <div className="sm:text-right">
          <span className="inline-flex rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold capitalize dark:bg-neutral-800">
            {event.assessment}
          </span>
          <p className="mt-2 text-xs text-neutral-500">
            {formatDateTime(event.reviewedAt)}
          </p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-neutral-500">Interval</dt>
          <dd className="mt-1 font-medium">
            {event.previousIntervalDays} → {event.nextIntervalDays} days
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Easiness</dt>
          <dd className="mt-1 font-medium">
            {event.previousEasinessFactor.toFixed(2)} →{' '}
            {event.nextEasinessFactor.toFixed(2)}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Answer</dt>
          <dd className="mt-1 font-medium">
            {event.answeredCorrectly === null
              ? 'Self-assessed'
              : event.answeredCorrectly
                ? 'Correct'
                : 'Incorrect'}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Response</dt>
          <dd className="mt-1 font-medium">{responseTime ?? 'Not recorded'}</dd>
        </div>
      </dl>
    </article>
  )
}

export function HistoryWorkspace({
  reviewEvents,
  userId,
}: {
  reviewEvents: ReviewHistoryEvent[]
  userId: string
}) {
  const subscribe = useCallback(
    (listener: () => void) => subscribeToAnalysisHistory(userId, listener),
    [userId]
  )
  const getSnapshot = useCallback(
    () => getAnalysisHistorySnapshot(userId),
    [userId]
  )
  const analyses = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getAnalysisHistoryServerSnapshot
  )

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <section className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <h2 className="text-lg font-semibold">Recent AI analyses</h2>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          The latest analyses from this browser. They stay separated by
          signed-in user and are not synced between devices.
        </p>
        {analyses.length === 0 ? (
          <p className="mt-6 text-sm text-neutral-600 dark:text-neutral-400">
            No AI analyses recorded in this browser yet.
          </p>
        ) : (
          <div className="mt-5 grid gap-3">
            {analyses.map(entry => (
              <article
                className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
                key={entry.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">{entry.dutchLemma}</h3>
                    <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                      Input: {entry.input}
                    </p>
                  </div>
                  <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium dark:bg-neutral-800">
                    {entry.cacheHit ? 'Cache' : 'AI'}
                  </span>
                </div>
                <p className="mt-3 text-xs text-neutral-500">
                  {formatDateTime(entry.analyzedAt)}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Review history</h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Synced review outcomes from the shared Supabase backend.
            </p>
          </div>
          <span className="whitespace-nowrap text-sm text-neutral-500">
            Latest {reviewEvents.length}
          </span>
        </div>
        {reviewEvents.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-neutral-300 p-6 text-center dark:border-neutral-700">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Complete a review session to start building history.
            </p>
            <Link
              className="mt-4 inline-flex rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700"
              href="/app/review"
            >
              Start review
            </Link>
          </div>
        ) : (
          <div className="mt-5 grid gap-3">
            {reviewEvents.map(event => (
              <ReviewEventCard event={event} key={event.eventId} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

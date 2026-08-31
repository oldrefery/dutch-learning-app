'use client'

import { buildReviewInsights } from '@woordenaar/domain'
import type { DistributionBucket, ForecastDay } from '@woordenaar/domain'
import type { Json } from '@woordenaar/supabase-contracts'
import Link from 'next/link'
import { useMemo } from 'react'
import type { InsightsData, InsightWord } from './types'

const SummaryCard = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
    <p className="text-sm text-neutral-600 dark:text-neutral-400">{label}</p>
    <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
  </div>
)

const Distribution = ({
  buckets,
  title,
}: {
  buckets: DistributionBucket[]
  title: string
}) => {
  const maximum = Math.max(...buckets.map(bucket => bucket.count), 1)

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-5 grid gap-4">
        {buckets.map(bucket => (
          <div key={bucket.id}>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span>{bucket.label}</span>
              <span className="font-medium">{bucket.count}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div
                aria-hidden="true"
                className="h-full rounded-full bg-sky-600 dark:bg-sky-400"
                style={{ width: `${(bucket.count / maximum) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

const formatForecastDay = (day: ForecastDay) =>
  new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric' }).format(
    new Date(`${day.dateKey}T12:00:00`)
  )

const Forecast = ({ days }: { days: ForecastDay[] }) => {
  const maximum = Math.max(...days.map(day => day.count), 1)

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="text-lg font-semibold">Next 7 days</h2>
      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
        Scheduled reviews after today, calculated in this browser’s local time.
      </p>
      <div className="mt-6 grid grid-cols-7 gap-2" role="list">
        {days.map(day => (
          <div
            className="grid gap-2 text-center"
            key={day.dateKey}
            role="listitem"
          >
            <div className="flex h-28 items-end justify-center rounded-xl bg-neutral-100 px-2 pt-2 dark:bg-neutral-800">
              <div
                aria-hidden="true"
                className="w-full min-w-2 rounded-t-md bg-emerald-600 dark:bg-emerald-400"
                style={{
                  height:
                    day.count === 0 ? '2px' : `${(day.count / maximum) * 100}%`,
                }}
              />
            </div>
            <div>
              <p className="text-xs text-neutral-500">
                {formatForecastDay(day)}
              </p>
              <p className="text-sm font-semibold">{day.count}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

const getTranslation = (translations: Json): string | null => {
  if (
    typeof translations !== 'object' ||
    translations === null ||
    Array.isArray(translations)
  ) {
    return null
  }

  for (const language of ['en', 'ru']) {
    const values = translations[language]
    if (!Array.isArray(values)) continue
    const first = values.find(
      value => typeof value === 'string' && value.trim()
    )
    if (typeof first === 'string') return first
  }

  return null
}

const DifficultWord = ({
  collectionName,
  word,
}: {
  collectionName: string | null
  word: InsightWord
}) => {
  const content = (
    <>
      <div>
        <h3 className="font-semibold">
          {[word.article, word.dutch_lemma].filter(Boolean).join(' ')}
        </h3>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          {getTranslation(word.translations) ?? 'Translation unavailable'}
          {collectionName ? ` · ${collectionName}` : ''}
        </p>
      </div>
      <div className="text-right text-sm">
        <p className="font-medium">EF {word.easiness_factor.toFixed(2)}</p>
        <p className="mt-1 text-neutral-500">
          {word.interval_days} day interval
        </p>
      </div>
    </>
  )

  return word.collection_id ? (
    <Link
      className="flex items-start justify-between gap-4 rounded-xl border border-neutral-200 p-4 outline-none hover:border-neutral-400 focus-visible:ring-2 focus-visible:ring-neutral-500 dark:border-neutral-800 dark:hover:border-neutral-600"
      href={`/app/collections/${word.collection_id}/words/${word.word_id}`}
    >
      {content}
    </Link>
  ) : (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      {content}
    </div>
  )
}

export function InsightsDashboard({ data }: { data: InsightsData }) {
  const insights = useMemo(() => buildReviewInsights(data.words), [data.words])
  const collectionNames = useMemo(
    () =>
      new Map(
        data.collections.map(collection => [collection.id, collection.name])
      ),
    [data.collections]
  )

  if (data.words.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-300 px-6 py-12 text-center dark:border-neutral-700">
        <h2 className="text-lg font-semibold">No learning data yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600 dark:text-neutral-400">
          Add words to a collection to see review forecasts, difficulty, and
          mastery insights.
        </p>
        <Link
          className="mt-5 inline-flex rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium dark:border-neutral-700"
          href="/app/collections"
        >
          View collections
        </Link>
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Due today" value={insights.forecast.today} />
        <SummaryCard label="Overdue" value={insights.forecast.overdue} />
        <SummaryCard label="Difficult" value={insights.difficultWords.length} />
        <SummaryCard label="Mastered" value={insights.masteredWords.length} />
      </div>

      <Forecast days={insights.forecast.nextSevenDays} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Distribution
          buckets={insights.intervalDistribution}
          title="Review intervals"
        />
        <Distribution
          buckets={insights.easinessDistribution}
          title="Easiness factors"
        />
      </div>

      <section className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Difficult words</h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
              Words with an easiness factor of 2.10 or lower, due items first.
            </p>
          </div>
          <Link
            className="rounded-xl bg-neutral-900 px-4 py-2 text-center text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-950"
            href="/app/review?scope=difficult-due"
          >
            Review {insights.dueDifficultWords.length} due
          </Link>
        </div>

        {insights.difficultWords.length === 0 ? (
          <p className="mt-6 text-sm text-neutral-600 dark:text-neutral-400">
            No difficult words right now.
          </p>
        ) : (
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {insights.difficultWords.slice(0, 12).map(word => (
              <DifficultWord
                collectionName={
                  word.collection_id
                    ? (collectionNames.get(word.collection_id) ?? null)
                    : null
                }
                key={word.word_id}
                word={word}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

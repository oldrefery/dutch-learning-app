'use client'

import { buildReviewInsights } from '@woordenaar/domain'
import type { DistributionBucket, ForecastDay } from '@woordenaar/domain'
import type { Json } from '@woordenaar/supabase-contracts'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import type { InsightsData, InsightWord } from './types'
import styles from './Insights.module.css'

const formatForecastDay = (day: ForecastDay) =>
  new Intl.DateTimeFormat('en', { weekday: 'short', day: 'numeric' }).format(
    new Date(`${day.dateKey}T12:00:00`)
  )

function BarList({
  items,
  variant = 'forecast',
}: {
  items: { count: number; id: string; label: string }[]
  variant?: 'forecast' | 'distribution'
}) {
  const maximum = Math.max(...items.map(item => item.count), 1)
  return (
    <div
      className={`${styles.bars} ${variant === 'distribution' ? styles.distribution : ''}`}
    >
      {items.map(item => (
        <div className={styles.barRow} key={item.id}>
          <span className={styles.barLabel}>{item.label}</span>
          <span className={styles.barTrack}>
            <span
              aria-hidden="true"
              className={styles.barFill}
              style={{ width: `${(item.count / maximum) * 100}%` }}
            />
          </span>
          <span className={styles.barValue}>{item.count}</span>
        </div>
      ))}
    </div>
  )
}

function DataTable({
  items,
}: {
  items: { count: number; id: string; label: string }[]
}) {
  const total = items.reduce((sum, item) => sum + item.count, 0)
  return (
    <table className={styles.dataTable}>
      <thead>
        <tr>
          <th>Range</th>
          <th>Count</th>
          <th>Share</th>
        </tr>
      </thead>
      <tbody>
        {items.map(item => (
          <tr key={item.id}>
            <td>{item.label}</td>
            <td>{item.count}</td>
            <td>{total === 0 ? 0 : Math.round((item.count / total) * 100)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ChartPanel({
  description,
  items,
  title,
  variant,
}: {
  description?: string
  items: { count: number; id: string; label: string }[]
  title: string
  variant?: 'forecast' | 'distribution'
}) {
  const [showTable, setShowTable] = useState(false)
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <button
          className={styles.tableToggle}
          onClick={() => setShowTable(current => !current)}
          type="button"
        >
          {showTable ? 'View as bars' : 'View as table'}
        </button>
      </div>
      {showTable ? (
        <DataTable items={items} />
      ) : (
        <BarList items={items} variant={variant} />
      )}
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

function DifficultWord({
  collectionName,
  word,
}: {
  collectionName: string | null
  word: InsightWord
}) {
  const className = styles.wordRow
  const content = (
    <>
      <span className={styles.wordName}>
        {[word.article, word.dutch_lemma].filter(Boolean).join(' ')}
      </span>
      <span className={styles.wordTranslation}>
        {getTranslation(word.translations) ?? 'Translation unavailable'}
      </span>
      <span className={styles.wordCollection}>
        {collectionName ?? 'Unsorted'}
      </span>
      <span className={styles.wordMetric}>
        EF {word.easiness_factor.toFixed(2)}
      </span>
    </>
  )

  return word.collection_id ? (
    <Link
      className={className}
      href={`/app/collections/${word.collection_id}/words/${word.word_id}`}
    >
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
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
      <div className={styles.empty}>
        <Badge>Not enough history</Badge>
        <h2>Your insights will grow with you</h2>
        <p className="dw-support">
          Add words and complete a few reviews to see your forecast, interval
          spread and difficult words.
        </p>
        <Link
          className="dw-button dw-button--secondary mt-5"
          href="/app/collections"
        >
          View collections
        </Link>
      </div>
    )
  }

  const forecastItems = insights.forecast.nextSevenDays
    .slice(0, 5)
    .map(day => ({
      count: day.count,
      id: day.dateKey,
      label: formatForecastDay(day),
    }))
  const distributionItems = (buckets: DistributionBucket[]) =>
    buckets.map(bucket => ({
      count: bucket.count,
      id: bucket.id,
      label: bucket.label,
    }))

  return (
    <div className={styles.dashboard}>
      <dl className={styles.metrics}>
        {[
          ['Due today', insights.forecast.today],
          ['Overdue', insights.forecast.overdue],
          ['Difficult', insights.difficultWords.length],
          ['Mastered', insights.masteredWords.length],
        ].map(([label, value]) => (
          <div className={styles.metric} key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      <div className={styles.charts}>
        <ChartPanel
          description="Scheduled reviews after today"
          items={forecastItems}
          title="Review forecast"
        />
        <div className={styles.dashboard}>
          <ChartPanel
            items={distributionItems(insights.intervalDistribution)}
            title="Interval spread"
            variant="distribution"
          />
          <ChartPanel
            items={distributionItems(insights.easinessDistribution)}
            title="Easiness"
            variant="distribution"
          />
        </div>
      </div>

      <section className={styles.words}>
        <header className={styles.wordsHeader}>
          <div>
            <h2>Difficult words</h2>
            <p>Easiness factor 2.10 or lower, due words first.</p>
          </div>
          <Link
            className="dw-button dw-button--primary"
            href="/app/review?scope=difficult-due"
          >
            Review difficult words · {insights.dueDifficultWords.length}
          </Link>
        </header>
        {insights.difficultWords.length === 0 ? (
          <p className="dw-support" style={{ padding: 20 }}>
            No difficult words right now.
          </p>
        ) : (
          insights.difficultWords
            .slice(0, 12)
            .map(word => (
              <DifficultWord
                collectionName={
                  word.collection_id
                    ? (collectionNames.get(word.collection_id) ?? null)
                    : null
                }
                key={word.word_id}
                word={word}
              />
            ))
        )}
      </section>
    </div>
  )
}

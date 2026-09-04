'use client'

import { Ellipsis, Volume2 } from 'lucide-react'
import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { Badge } from '@/components/ui/Badge'
import {
  getAnalysisHistoryServerSnapshot,
  getAnalysisHistorySnapshot,
  subscribeToAnalysisHistory,
} from './analysis-history'
import type { AnalysisHistoryEntry } from './analysis-history'
import styles from './History.module.css'

const toDateKey = (date: Date) =>
  [date.getFullYear(), date.getMonth(), date.getDate()].join('-')

const getGroupLabel = (value: string) => {
  const date = new Date(value)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (toDateKey(date) === toDateKey(today)) return 'Today'
  if (toDateKey(date) === toDateKey(yesterday)) return 'Yesterday'
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

const formatTime = (value: string) =>
  new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

const groupAnalyses = (analyses: readonly AnalysisHistoryEntry[]) => {
  const groups = new Map<string, AnalysisHistoryEntry[]>()
  for (const entry of analyses) {
    const label = getGroupLabel(entry.analyzedAt)
    groups.set(label, [...(groups.get(label) ?? []), entry])
  }
  return [...groups.entries()]
}

export function HistoryWorkspace({ userId }: { userId: string }) {
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
  const groups = useMemo(() => groupAnalyses(analyses), [analyses])

  const playWord = (lemma: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(lemma)
    utterance.lang = 'nl-NL'
    window.speechSynthesis.speak(utterance)
  }

  return (
    <div className={styles.history}>
      {groups.length === 0 ? (
        <div className={styles.empty}>
          <Badge>30-day window</Badge>
          <h2>No recent analyses</h2>
          <p className="dw-support">
            Words you analyse with AI will appear here for thirty days, whether
            you save them or not.
          </p>
        </div>
      ) : (
        groups.map(([label, entries]) => (
          <section className={styles.group} key={label}>
            <div className={styles.groupHeader}>
              <span className="dw-label">{label}</span>
              <span className={styles.groupCount}>{entries.length}</span>
            </div>
            <div className={styles.list}>
              {entries.map(entry => (
                <article className={styles.row} key={entry.id}>
                  <span className={styles.lemma}>{entry.dutchLemma}</span>
                  <span className={styles.input}>Input · {entry.input}</span>
                  <span>
                    <Badge tone={entry.cacheHit ? 'neutral' : 'accent'}>
                      {entry.cacheHit ? 'Cached' : 'Not saved'}
                    </Badge>
                  </span>
                  <span className={styles.time}>
                    {formatTime(entry.analyzedAt)}
                  </span>
                  <span className={styles.actions}>
                    <button
                      aria-label={`Play ${entry.dutchLemma}`}
                      className="dw-icon-button"
                      onClick={() => playWord(entry.dutchLemma)}
                      type="button"
                    >
                      <Volume2 aria-hidden="true" size={16} />
                    </button>
                    <button
                      aria-label="More actions"
                      className="dw-icon-button"
                      type="button"
                    >
                      <Ellipsis aria-hidden="true" size={17} />
                    </button>
                  </span>
                </article>
              ))}
            </div>
          </section>
        ))
      )}

      <section className={styles.later}>
        <Badge>Later</Badge>
        <h2>Review-event history</h2>
        <p className="dw-support">
          A complete timeline of every SRS answer is planned for a later
          release. Current review outcomes already feed your Insights.
        </p>
      </section>
    </div>
  )
}

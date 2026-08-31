'use client'

import Link from 'next/link'
import { useState } from 'react'
import { serializeWordAnalysis } from '@/features/analysis/analysis-contract'
import { buildAnalysisPreview } from '@/features/analysis/analysis-preview'
import { WordDetailCard } from '@/features/words/WordDetailCard'
import { saveBatchAnalyzedWord } from './actions'
import type { WebBatchCaptureItem } from './types'

interface BatchReviewPanelProps {
  collectionId: string
  collectionName: string
  item: WebBatchCaptureItem
  onSaved: (itemId: string) => void
  onSkip: (itemId: string) => void
}

export function BatchReviewPanel({
  collectionId,
  collectionName,
  item,
  onSaved,
  onSkip,
}: BatchReviewPanelProps) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  if (!item.analysis) return null

  const handleSave = async () => {
    if (!item.analysis) return
    setSaving(true)
    setSaveError(null)
    try {
      const result = await saveBatchAnalyzedWord(
        collectionId,
        serializeWordAnalysis(item.analysis)
      )
      if (!result.success) {
        setSaveError(result.message)
        return
      }
      onSaved(item.id)
    } catch {
      setSaveError('Could not save this word. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      aria-labelledby="batch-review-heading"
      className="grid gap-5 rounded-2xl border-2 border-blue-300 bg-blue-50/60 p-5 dark:border-blue-900 dark:bg-blue-950/20"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-800 dark:text-blue-300">
            Manual review required
          </p>
          <h2
            className="mt-1 text-2xl font-semibold tracking-tight"
            id="batch-review-heading"
          >
            Review “{item.dutchText}”
          </h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Saving to “{collectionName}”
          </p>
        </div>
        {item.analysisMetadata && (
          <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
            {item.analysisMetadata.cacheHit
              ? 'Cached analysis'
              : 'Fresh AI analysis'}
          </span>
        )}
      </div>

      {item.translationHint && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Unverified input hint: {item.translationHint}
        </p>
      )}

      {item.semanticDuplicate && (
        <div
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          This exact semantic word already exists
          {item.semanticDuplicate.collectionName
            ? ` in “${item.semanticDuplicate.collectionName}”`
            : ' in your vocabulary'}
          .
          {item.semanticDuplicate.collectionId && (
            <Link
              className="ml-2 font-medium underline"
              href={`/app/collections/${item.semanticDuplicate.collectionId}/words/${item.semanticDuplicate.wordId}`}
            >
              Open it
            </Link>
          )}
        </div>
      )}

      <WordDetailCard
        showProgress={false}
        word={buildAnalysisPreview(item.analysis)}
      />

      {item.error && (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          {item.error}
        </p>
      )}
      {saveError && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {saveError}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          className="rounded-xl bg-emerald-700 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600"
          disabled={saving || Boolean(item.semanticDuplicate)}
          onClick={() => void handleSave()}
          type="button"
        >
          {saving ? 'Saving…' : 'Approve and save'}
        </button>
        <button
          className="rounded-xl border border-neutral-300 px-5 py-3 text-sm font-medium disabled:opacity-60 dark:border-neutral-700"
          disabled={saving}
          onClick={() => onSkip(item.id)}
          type="button"
        >
          Skip this item
        </button>
      </div>
    </section>
  )
}

'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { WordDetailCard } from '@/features/words/WordDetailCard'
import type { CollectionOption } from '@/features/words/repository'
import { findOwnedSemanticDuplicate, saveAnalyzedWord } from './actions'
import {
  analyzeWordWithAi,
  findWordImages,
  getNextImageOffset,
} from './analysis-client'
import {
  mergeWordImageOptions,
  normalizeDutchInput,
  serializeWordAnalysis,
} from './analysis-contract'
import type {
  AnalysisMetadata,
  WordAnalysis,
  WordImageOption,
} from './analysis-contract'
import { buildAnalysisPreview } from './analysis-preview'
import type { DuplicateWordResult } from './form-state'
import { INITIAL_ADD_WORD_ACTION_STATE } from './form-state'
import { ImageOptionGrid } from './ImageOptionGrid'

const AnalysisMetadataBadge = ({
  metadata,
}: {
  metadata: AnalysisMetadata
}) => (
  <p className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
    {metadata.cacheHit
      ? `Cached analysis${metadata.usageCount ? ` · used ${metadata.usageCount} times` : ''}`
      : metadata.forceRefresh
        ? 'Fresh AI reanalysis'
        : 'Fresh AI analysis'}
  </p>
)

const ImageOptions = ({
  analysis,
  images,
  loading,
  onLoad,
  onLoadMore,
  onSelect,
}: {
  analysis: WordAnalysis
  images: WordImageOption[]
  loading: boolean
  onLoad: () => void
  onLoadMore: () => void
  onSelect: (url: string) => void
}) => {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Choose an image</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Search uses “{analysis.translations.en[0]}” and the analyzed
            context.
          </p>
        </div>
        <button
          className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700"
          disabled={loading}
          onClick={onLoad}
          type="button"
        >
          {loading ? 'Finding images…' : 'Find other images'}
        </button>
      </div>

      {images.length > 0 && (
        <>
          <div className="mt-5">
            <ImageOptionGrid
              currentImageUrl={analysis.imageUrl}
              images={images}
              onSelect={onSelect}
            />
          </div>
          <button
            className="mt-4 rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700"
            disabled={loading}
            onClick={onLoadMore}
            type="button"
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </>
      )}
    </section>
  )
}

export function AddWordWorkflow({
  collections,
  initialCollectionId,
  userId,
}: {
  collections: CollectionOption[]
  initialCollectionId: string
  userId: string
}) {
  const [inputWord, setInputWord] = useState('')
  const [analysis, setAnalysis] = useState<WordAnalysis | null>(null)
  const [metadata, setMetadata] = useState<AnalysisMetadata | null>(null)
  const [duplicate, setDuplicate] = useState<DuplicateWordResult | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [duplicateError, setDuplicateError] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [images, setImages] = useState<WordImageOption[]>([])
  const [imageOffset, setImageOffset] = useState(0)
  const [imageError, setImageError] = useState<string | null>(null)
  const [isLoadingImages, setIsLoadingImages] = useState(false)
  const [selectedCollectionId, setSelectedCollectionId] =
    useState(initialCollectionId)
  const [saveState, saveAction, isSaving] = useActionState(
    saveAnalyzedWord,
    INITIAL_ADD_WORD_ACTION_STATE
  )

  const checkDuplicate = async (nextAnalysis: WordAnalysis) => {
    setDuplicate(null)
    setDuplicateError(null)
    try {
      const result = await findOwnedSemanticDuplicate(
        serializeWordAnalysis(nextAnalysis)
      )
      setDuplicate(result)
    } catch {
      setDuplicateError('Duplicate check is temporarily unavailable.')
    }
  }

  const runAnalysis = async (forceRefresh: boolean) => {
    const validation = normalizeDutchInput(inputWord)
    if (validation.error) {
      setAnalysisError(validation.error)
      return
    }

    setInputWord(validation.value)
    setIsAnalyzing(true)
    setAnalysisError(null)
    setImageError(null)
    setImages([])
    setImageOffset(0)
    setDuplicateError(null)
    if (!forceRefresh) {
      setAnalysis(null)
      setMetadata(null)
      setDuplicate(null)
    }

    try {
      const result = await analyzeWordWithAi(
        userId,
        validation.value,
        forceRefresh
      )
      setAnalysis(result.analysis)
      setMetadata(result.metadata)
      await checkDuplicate(result.analysis)
    } catch (error) {
      setAnalysisError(
        error instanceof Error
          ? error.message
          : 'Could not analyze this word. Please try again.'
      )
    } finally {
      setIsAnalyzing(false)
    }
  }

  const loadImages = async (loadMore: boolean) => {
    if (!analysis) return
    const nextOffset = loadMore ? getNextImageOffset(imageOffset) : 0
    setIsLoadingImages(true)
    setImageError(null)

    try {
      const nextImages = await findWordImages(analysis, nextOffset)
      setImages(current =>
        loadMore ? mergeWordImageOptions(current, nextImages) : nextImages
      )
      setImageOffset(nextOffset)
    } catch (error) {
      setImageError(
        error instanceof Error ? error.message : 'Could not load image options.'
      )
    } finally {
      setIsLoadingImages(false)
    }
  }

  const startOver = () => {
    setInputWord('')
    setAnalysis(null)
    setMetadata(null)
    setDuplicate(null)
    setAnalysisError(null)
    setDuplicateError(null)
    setImages([])
    setImageOffset(0)
    setImageError(null)
  }

  return (
    <div className="grid gap-6">
      <form
        className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
        onSubmit={event => {
          event.preventDefault()
          void runAnalysis(false)
        }}
      >
        <label className="text-sm font-medium" htmlFor="dutch-word">
          Dutch word or expression
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            autoComplete="off"
            className="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-transparent px-4 py-3 outline-none focus:border-neutral-600 dark:border-neutral-700 dark:focus:border-neutral-400"
            disabled={isAnalyzing}
            id="dutch-word"
            maxLength={120}
            onChange={event => setInputWord(event.target.value)}
            placeholder="e.g. het huis or meenemen"
            required
            value={inputWord}
          />
          <button
            className="rounded-xl bg-neutral-900 px-6 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-950"
            disabled={isAnalyzing}
            type="submit"
          >
            {isAnalyzing ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
        <p className="mt-2 text-xs text-neutral-500">
          Linguistic analysis can take several seconds after a cache miss.
        </p>
        {analysisError && (
          <p
            aria-live="polite"
            className="mt-3 text-sm text-red-600 dark:text-red-400"
            role="alert"
          >
            {analysisError}
          </p>
        )}
      </form>

      {analysis && metadata && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <AnalysisMetadataBadge metadata={metadata} />
            <div className="flex flex-wrap gap-2">
              <button
                className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700"
                disabled={isAnalyzing}
                onClick={() => void runAnalysis(true)}
                type="button"
              >
                Analyze again with fresh AI
              </button>
              <button
                className="rounded-xl px-4 py-2 text-sm font-medium text-neutral-600 hover:underline dark:text-neutral-400"
                onClick={startOver}
                type="button"
              >
                Start over
              </button>
            </div>
          </div>

          {duplicate && (
            <div
              className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
              role="status"
            >
              This semantic word already exists
              {duplicate.collectionName
                ? ` in “${duplicate.collectionName}”`
                : ' in your vocabulary'}
              .
              {duplicate.collectionId && (
                <Link
                  className="ml-2 font-medium underline"
                  href={`/app/collections/${duplicate.collectionId}/words/${duplicate.wordId}`}
                >
                  Open it
                </Link>
              )}
            </div>
          )}
          {duplicateError && (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {duplicateError} Saving still performs a database-backed duplicate
              check.
            </p>
          )}

          <WordDetailCard
            showProgress={false}
            word={buildAnalysisPreview(analysis)}
          />

          <ImageOptions
            analysis={analysis}
            images={images}
            loading={isLoadingImages}
            onLoad={() => void loadImages(false)}
            onLoadMore={() => void loadImages(true)}
            onSelect={url =>
              setAnalysis(current =>
                current ? { ...current, imageUrl: url } : current
              )
            }
          />
          {imageError && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {imageError}
            </p>
          )}

          <form
            action={saveAction}
            className="rounded-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
          >
            <input
              name="analysis"
              type="hidden"
              value={serializeWordAnalysis(analysis)}
            />
            <label className="text-sm font-medium" htmlFor="save-collection">
              Save to collection
            </label>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row">
              <select
                className="min-w-0 flex-1 rounded-xl border border-neutral-300 bg-transparent px-4 py-3 text-sm dark:border-neutral-700"
                id="save-collection"
                name="collectionId"
                onChange={event => setSelectedCollectionId(event.target.value)}
                value={selectedCollectionId}
              >
                {collections.map(collection => (
                  <option key={collection.id} value={collection.id}>
                    {collection.name}
                  </option>
                ))}
              </select>
              <button
                className="rounded-xl bg-emerald-700 px-6 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600"
                disabled={isSaving || Boolean(duplicate)}
                type="submit"
              >
                {isSaving ? 'Saving…' : 'Save word'}
              </button>
            </div>
            {saveState.fieldErrors?.collectionId && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {saveState.fieldErrors.collectionId}
              </p>
            )}
            {saveState.fieldErrors?.analysis && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {saveState.fieldErrors.analysis}
              </p>
            )}
            {saveState.message && (
              <p
                aria-live="polite"
                className="mt-3 text-sm text-red-600 dark:text-red-400"
                role="alert"
              >
                {saveState.message}
              </p>
            )}
          </form>
        </>
      )}
    </div>
  )
}

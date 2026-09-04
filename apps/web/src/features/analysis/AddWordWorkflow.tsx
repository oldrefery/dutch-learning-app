'use client'

import Link from 'next/link'
import { useActionState, useState, useSyncExternalStore } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
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
import styles from './AddWordWorkflow.module.css'

const subscribeToConnectivity = (listener: () => void) => {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
  }
}

const getConnectivitySnapshot = () => navigator.onLine
const getConnectivityServerSnapshot = () => true

const AnalysisMetadataBadge = ({
  metadata,
}: {
  metadata: AnalysisMetadata
}) => (
  <Badge tone={metadata.cacheHit ? 'neutral' : 'success'}>
    {metadata.cacheHit
      ? `Cached analysis${metadata.usageCount ? ` · used ${metadata.usageCount} times` : ''}`
      : metadata.forceRefresh
        ? 'Fresh AI reanalysis'
        : 'Fresh AI analysis'}
  </Badge>
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
    <section className={styles.imagePanel}>
      <div className={styles.panelHeader}>
        <div>
          <h2 className="text-lg font-semibold">Choose an image</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Search uses “{analysis.translations.en[0]}” and the analyzed
            context.
          </p>
        </div>
        <Button
          disabled={loading}
          onClick={onLoad}
          type="button"
          variant="secondary"
        >
          {loading ? 'Finding images…' : 'Find other images'}
        </Button>
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
          <Button
            className="mt-4"
            disabled={loading}
            onClick={onLoadMore}
            type="button"
            variant="secondary"
          >
            {loading ? 'Loading…' : 'Load more'}
          </Button>
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
  const isOnline = useSyncExternalStore(
    subscribeToConnectivity,
    getConnectivitySnapshot,
    getConnectivityServerSnapshot
  )
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
    <div className={styles.workflow}>
      <form
        className={styles.capture}
        onSubmit={event => {
          event.preventDefault()
          void runAnalysis(false)
        }}
      >
        {!isOnline && (
          <p className={styles.error} role="status">
            You are offline. Your word stays here; analysis becomes available
            again when the connection returns.
          </p>
        )}
        <label className={styles.captureLabel} htmlFor="dutch-word">
          Dutch word or expression
        </label>
        <div className={styles.captureRow}>
          <input
            autoComplete="off"
            className={styles.captureInput}
            disabled={isAnalyzing}
            id="dutch-word"
            maxLength={120}
            onChange={event => setInputWord(event.target.value)}
            placeholder="e.g. het huis or meenemen"
            required
            value={inputWord}
          />
          <Button
            className={styles.captureButton}
            disabled={isAnalyzing || !isOnline}
            type="submit"
          >
            {isAnalyzing ? 'Analyzing…' : 'Analyze'}
          </Button>
        </div>
        <div className={styles.collectionRow}>
          <label>
            Collection
            <select
              className={styles.collectionSelect}
              onChange={event => setSelectedCollectionId(event.target.value)}
              value={selectedCollectionId}
            >
              {collections.map(collection => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.alternateLinks}>
            <Link href="/app/batch-capture">Add a list</Link>
            <Link href="/app/starter-pack">Use starter pack</Link>
          </div>
        </div>
        <p className={styles.hint}>
          Linguistic analysis can take several seconds after a cache miss.
        </p>
        {isAnalyzing && (
          <div aria-live="polite" className={styles.analyzing}>
            <div className="dw-progress">
              <span style={{ width: '58%' }} />
            </div>
            <div className={styles.checklist}>
              <span>✓ Checked for duplicates</span>
              <span>✓ Translations</span>
              <span>◴ Examples and grammar</span>
              <span>· Image options</span>
            </div>
          </div>
        )}
        {analysisError && (
          <p aria-live="polite" className={styles.error} role="alert">
            {analysisError}
          </p>
        )}
      </form>

      {analysis && metadata && (
        <>
          <div className={styles.resultHeader}>
            <AnalysisMetadataBadge metadata={metadata} />
            <div className={styles.resultActions}>
              <Button
                disabled={isAnalyzing}
                onClick={() => void runAnalysis(true)}
                type="button"
                variant="secondary"
              >
                Analyze again with fresh AI
              </Button>
              <Button onClick={startOver} type="button" variant="ghost">
                Start over
              </Button>
            </div>
          </div>

          {duplicate && (
            <div className={styles.duplicate} role="status">
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

          <div className={styles.cardWrap}>
            <WordDetailCard
              showProgress={false}
              word={buildAnalysisPreview(analysis)}
            />
          </div>

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

          <form action={saveAction} className={styles.savePanel}>
            <input
              name="analysis"
              type="hidden"
              value={serializeWordAnalysis(analysis)}
            />
            <label className="text-sm font-medium" htmlFor="save-collection">
              Save to collection
            </label>
            <div className={styles.saveRow}>
              <select
                className={styles.saveSelect}
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
              <Button disabled={isSaving || Boolean(duplicate)} type="submit">
                {isSaving ? 'Saving…' : 'Save word'}
              </Button>
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

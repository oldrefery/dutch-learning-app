'use client'

import { useActionState, useState } from 'react'
import {
  findWordImages,
  getNextImageOffset,
} from '@/features/analysis/analysis-client'
import { buildAnalysisFromWordDetail } from '@/features/analysis/analysis-preview'
import { ImageOptionGrid } from '@/features/analysis/ImageOptionGrid'
import { mergeWordImageOptions } from '@/features/analysis/analysis-contract'
import type { WordImageOption } from '@/features/analysis/analysis-contract'
import type { WordDetail } from './word-detail'
import { updateWordImage } from './actions'
import { INITIAL_WORD_ACTION_STATE } from './form-state'

export function WordImageManager({
  collectionId,
  word,
}: {
  collectionId: string
  word: WordDetail
}) {
  const analysis = buildAnalysisFromWordDetail(word)
  const [images, setImages] = useState<WordImageOption[]>([])
  const [selectedImageUrl, setSelectedImageUrl] = useState(word.imageUrl)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const updateImageWithIds = updateWordImage.bind(null, collectionId, word.id)
  const [state, action, pending] = useActionState(
    updateImageWithIds,
    INITIAL_WORD_ACTION_STATE
  )

  const loadImages = async (loadMore: boolean) => {
    const nextOffset = loadMore ? getNextImageOffset(offset) : 0
    setLoading(true)
    setSearchError(null)

    try {
      const result = await findWordImages(analysis, nextOffset)
      setImages(current =>
        loadMore ? mergeWordImageOptions(current, result) : result
      )
      setOffset(nextOffset)
    } catch (error) {
      setSearchError(
        error instanceof Error ? error.message : 'Could not load image options.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Change image</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Search for alternatives using the current translation and examples.
          </p>
        </div>
        <button
          className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700"
          disabled={loading}
          onClick={() => void loadImages(false)}
          type="button"
        >
          {loading ? 'Finding images…' : 'Find replacement images'}
        </button>
      </div>

      {images.length > 0 && (
        <div className="mt-5">
          <ImageOptionGrid
            currentImageUrl={selectedImageUrl}
            images={images}
            onSelect={setSelectedImageUrl}
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700"
              disabled={loading}
              onClick={() => void loadImages(true)}
              type="button"
            >
              {loading ? 'Loading…' : 'Load more'}
            </button>
            <form action={action}>
              <input
                name="imageUrl"
                type="hidden"
                value={selectedImageUrl ?? ''}
              />
              <button
                className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-600"
                disabled={
                  pending ||
                  !selectedImageUrl ||
                  selectedImageUrl === word.imageUrl
                }
                type="submit"
              >
                {pending ? 'Saving…' : 'Save selected image'}
              </button>
            </form>
          </div>
        </div>
      )}

      {searchError && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
          {searchError}
        </p>
      )}
      {state.message && (
        <p
          aria-live="polite"
          className={`mt-3 text-sm ${
            state.status === 'success'
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-red-600 dark:text-red-400'
          }`}
          role={state.status === 'error' ? 'alert' : 'status'}
        >
          {state.message}
        </p>
      )}
    </section>
  )
}

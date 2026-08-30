'use client'

import Image from 'next/image'
import { canRenderWordImage } from '@/features/words/word-detail'
import type { WordImageOption } from './analysis-contract'

export function ImageOptionGrid({
  currentImageUrl,
  images,
  onSelect,
}: {
  currentImageUrl: string | null
  images: WordImageOption[]
  onSelect: (url: string) => void
}) {
  const renderableImages = images.filter(image => canRenderWordImage(image.url))

  if (renderableImages.length === 0) return null

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {renderableImages.map(image => {
        const isSelected = image.url === currentImageUrl
        return (
          <button
            aria-pressed={isSelected}
            className={`overflow-hidden rounded-xl border text-left outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 ${
              isSelected
                ? 'border-emerald-600 ring-2 ring-emerald-600 dark:border-emerald-400 dark:ring-emerald-400'
                : 'border-neutral-200 dark:border-neutral-800'
            }`}
            key={image.url}
            onClick={() => onSelect(image.url)}
            type="button"
          >
            <span className="relative block aspect-[4/3] bg-neutral-100 dark:bg-neutral-800">
              <Image
                alt={image.alt}
                className="object-cover"
                fill
                sizes="(max-width: 640px) 100vw, 33vw"
                src={image.url}
              />
            </span>
            <span className="block truncate px-3 py-2 text-xs">
              {isSelected ? 'Selected' : image.alt}
            </span>
          </button>
        )
      })}
    </div>
  )
}

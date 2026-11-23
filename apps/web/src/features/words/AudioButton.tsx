'use client'

import { Volume2, Square } from 'lucide-react'
import { useAudioReviewPlayback } from '@/features/review/useAudioReviewPlayback'

export function AudioButton({
  label,
  source,
}: {
  label: string
  source: string | null
}) {
  const { play, stop, isPlaying, playbackMessage } = useAudioReviewPlayback()
  return (
    <>
      <button
        aria-label={isPlaying ? `Stop ${label}` : `Play ${label}`}
        className="dw-button dw-button--ghost"
        onClick={() =>
          isPlaying ? stop() : void play({ dutchLemma: label, ttsUrl: source })
        }
        type="button"
      >
        {isPlaying ? (
          <Square aria-hidden="true" size={16} />
        ) : (
          <Volume2 aria-hidden="true" size={18} />
        )}
        {isPlaying ? 'Stop' : 'Listen'}
      </button>
      {playbackMessage && (
        <span className="dw-support" role="status">
          {playbackMessage}
        </span>
      )}
    </>
  )
}

'use client'

import { Pause, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export function AudioButton({
  label,
  source,
}: {
  label: string
  source: string
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const audio = new Audio(source)
    const handleEnded = () => setPlaying(false)
    audio.addEventListener('ended', handleEnded)
    audioRef.current = audio

    return () => {
      audio.pause()
      audio.removeEventListener('ended', handleEnded)
      audioRef.current = null
    }
  }, [source])

  const togglePlayback = () => {
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      audio.pause()
      setPlaying(false)
      return
    }

    void audio.play().then(() => setPlaying(true))
  }

  return (
    <button
      aria-label={playing ? `Pause ${label}` : `Play ${label}`}
      className="dw-icon-button"
      onClick={togglePlayback}
      type="button"
    >
      {playing ? (
        <Pause aria-hidden="true" size={18} />
      ) : (
        <Volume2 aria-hidden="true" size={18} />
      )}
    </button>
  )
}

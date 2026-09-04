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
  const playbackSourceRef = useRef<'audio' | 'speech' | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const audio = new Audio(source)
    const handleEnded = () => {
      playbackSourceRef.current = null
      setPlaying(false)
    }
    audio.addEventListener('ended', handleEnded)
    audioRef.current = audio

    return () => {
      audio.pause()
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
      audio.removeEventListener('ended', handleEnded)
      audioRef.current = null
      playbackSourceRef.current = null
    }
  }, [source])

  const playWithBrowserVoice = () => {
    if (!('speechSynthesis' in window)) {
      setPlaying(false)
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(label)
    utterance.lang = 'nl-NL'
    utterance.onend = () => {
      playbackSourceRef.current = null
      setPlaying(false)
    }
    utterance.onerror = () => {
      playbackSourceRef.current = null
      setPlaying(false)
    }
    playbackSourceRef.current = 'speech'
    setPlaying(true)
    window.speechSynthesis.speak(utterance)
  }

  const togglePlayback = () => {
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      if (playbackSourceRef.current === 'speech') {
        if ('speechSynthesis' in window) window.speechSynthesis.cancel()
      } else {
        audio.pause()
      }
      playbackSourceRef.current = null
      setPlaying(false)
      return
    }

    let settled = false
    const fallback = () => {
      if (settled) return
      settled = true
      audio.removeEventListener('error', fallback)
      playWithBrowserVoice()
    }

    audio.addEventListener('error', fallback, { once: true })
    void audio.play().then(() => {
      settled = true
      audio.removeEventListener('error', fallback)
      playbackSourceRef.current = 'audio'
      setPlaying(true)
    }, fallback)
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

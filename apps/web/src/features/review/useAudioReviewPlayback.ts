'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReviewWord } from './types'

type PlaybackSource = 'audio' | 'speech' | null

const createUtterance = (word: ReviewWord) => {
  const utterance = new SpeechSynthesisUtterance(word.dutchLemma)
  utterance.lang = 'nl-NL'
  return utterance
}

export function useAudioReviewPlayback() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const sourceRef = useRef<PlaybackSource>(null)
  const playbackGenerationRef = useRef(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [playbackMessage, setPlaybackMessage] = useState<string | null>(null)

  const stop = useCallback(() => {
    playbackGenerationRef.current += 1
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    sourceRef.current = null
    setIsPlaying(false)
    setIsPaused(false)
  }, [])

  const playWithSpeech = useCallback((word: ReviewWord, generation: number) => {
    if (!('speechSynthesis' in window)) {
      setPlaybackMessage('Pronunciation is unavailable in this browser.')
      setIsPlaying(false)
      return
    }

    window.speechSynthesis.cancel()
    const utterance = createUtterance(word)
    utterance.onend = () => {
      if (playbackGenerationRef.current === generation) setIsPlaying(false)
    }
    utterance.onerror = () => {
      if (playbackGenerationRef.current !== generation) return
      setIsPlaying(false)
      setPlaybackMessage('Pronunciation could not be played. Use Replay.')
    }
    sourceRef.current = 'speech'
    setIsPlaying(true)
    setIsPaused(false)
    window.speechSynthesis.speak(utterance)
  }, [])

  const play = useCallback(
    async (word: ReviewWord) => {
      stop()
      const generation = playbackGenerationRef.current
      setPlaybackMessage(null)

      if (!word.ttsUrl) {
        playWithSpeech(word, generation)
        return
      }

      const audio = new Audio(word.ttsUrl)
      audioRef.current = audio
      sourceRef.current = 'audio'
      audio.onended = () => {
        if (playbackGenerationRef.current === generation) setIsPlaying(false)
      }
      audio.onerror = () => {
        if (
          audioRef.current !== audio ||
          playbackGenerationRef.current !== generation
        ) {
          return
        }
        audioRef.current = null
        playWithSpeech(word, generation)
      }
      setIsPlaying(true)
      setIsPaused(false)

      try {
        await audio.play()
      } catch {
        if (
          audioRef.current === audio &&
          playbackGenerationRef.current === generation
        ) {
          audioRef.current = null
          playWithSpeech(word, generation)
        }
      }
    },
    [playWithSpeech, stop]
  )

  const togglePause = useCallback(() => {
    if (sourceRef.current === 'audio' && audioRef.current) {
      if (audioRef.current.paused) {
        void audioRef.current.play().then(
          () => {
            setIsPaused(false)
            setIsPlaying(true)
          },
          () => setPlaybackMessage('Playback is blocked. Use Replay.')
        )
      } else {
        audioRef.current.pause()
        setIsPaused(true)
        setIsPlaying(false)
      }
      return
    }

    if (sourceRef.current === 'speech' && 'speechSynthesis' in window) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume()
        setIsPaused(false)
        setIsPlaying(true)
      } else {
        window.speechSynthesis.pause()
        setIsPaused(true)
        setIsPlaying(false)
      }
    }
  }, [])

  useEffect(() => {
    const pauseWhenHidden = () => {
      if (!document.hidden) return
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause()
      }
      if ('speechSynthesis' in window) window.speechSynthesis.pause()
      setIsPlaying(false)
      setIsPaused(true)
    }

    document.addEventListener('visibilitychange', pauseWhenHidden)
    return () => {
      playbackGenerationRef.current += 1
      document.removeEventListener('visibilitychange', pauseWhenHidden)
      if (audioRef.current) audioRef.current.pause()
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    }
  }, [])

  return {
    isPaused,
    isPlaying,
    playbackMessage,
    play,
    stop,
    togglePause,
  }
}

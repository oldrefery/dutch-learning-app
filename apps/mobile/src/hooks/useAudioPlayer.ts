import { useCallback, useMemo } from 'react'
import { useAudio } from '@/contexts/AudioContext'

export function useAudioPlayer() {
  const { playWord, isPlaying } = useAudio()

  const playAudio = useCallback(
    async (url?: string, fallbackWord?: string, ttsUrl?: string | null) => {
      if (!fallbackWord) return

      // Use custom URL if provided, otherwise let the context handle it
      if (url) {
        // For custom URLs, we need to temporarily set the source
        await playWord(fallbackWord, url)
      } else {
        await playWord(fallbackWord, ttsUrl)
      }
    },
    [playWord]
  )

  return useMemo(
    () => ({
      playAudio,
      isPlaying,
      isReady: true, // Always ready with the new context approach
    }),
    [playAudio, isPlaying]
  )
}

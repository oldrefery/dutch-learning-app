import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from 'react'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { Sentry } from '@/lib/sentry'

interface AudioContextType {
  playWord: (word: string, ttsUrl?: string | null) => Promise<void>
  isPlaying: boolean
  currentWord: string | null
}

const AudioContext = createContext<AudioContextType | null>(null)

export function useAudio() {
  const context = useContext(AudioContext)
  if (!context) {
    throw new Error('useAudio must be used within AudioProvider')
  }
  return context
}

interface AudioProviderProps {
  children: React.ReactNode
}

export function AudioProvider({ children }: AudioProviderProps) {
  const [currentWord, setCurrentWord] = useState<string | null>(null)

  // Initialize player with null source and use replace() for dynamic sources
  const player = useAudioPlayer(null, {
    downloadFirst: true, // Recommended for remote URLs
    updateInterval: 2000, // Reduce update frequency to prevent constant rerenders
  })

  const status = useAudioPlayerStatus(player)

  const playWord = useCallback(
    async (word: string, ttsUrl?: string | null) => {
      try {
        const audioUrl =
          ttsUrl ||
          `https://translate.google.com/translate_tts?ie=UTF-8&tl=nl&client=tw-ob&q=${encodeURIComponent(word)}`

        // Only update currentWord if it actually changed to prevent unnecessary rerenders
        if (currentWord !== word) {
          setCurrentWord(word)
        }

        // Use replace() method for dynamic audio sources
        player.replace(audioUrl)

        // Reset position and play
        player.seekTo(0)
        await player.play()
      } catch (error) {
        Sentry.captureException(error, {
          tags: { operation: 'playAudio' },
          extra: { message: 'Failed to play audio', word },
        })
        ToastService.show('Could not play pronunciation', ToastType.ERROR)
      }
    },
    [player, currentWord]
  )

  // Memoize isPlaying to prevent frequent updates
  const isPlayingMemo = useMemo(() => status.playing || false, [status.playing])

  const contextValue: AudioContextType = useMemo(
    () => ({
      playWord,
      isPlaying: isPlayingMemo,
      currentWord,
    }),
    [playWord, isPlayingMemo, currentWord]
  )

  return (
    <AudioContext.Provider value={contextValue}>
      {children}
    </AudioContext.Provider>
  )
}

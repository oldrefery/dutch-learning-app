import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { Sentry } from '@/lib/sentry'

interface AudioContextType {
  playWord: (word: string, ttsUrl?: string | null) => Promise<void>
  pauseAudio: () => void
  resumeAudio: () => void
  stopAudio: () => Promise<void>
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
  const currentWordRef = useRef<string | null>(null)
  const currentSourceRef = useRef<string | null>(null)

  // Initialize player with null source and use replace() for dynamic sources
  const player = useAudioPlayer(null, {
    downloadFirst: true, // Recommended for remote URLs
    updateInterval: 2000, // Reduce update frequency to prevent constant rerenders
  })

  const status = useAudioPlayerStatus(player)

  useEffect(() => {
    void setAudioModeAsync({
      allowsRecording: false,
      interruptionMode: 'duckOthers',
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    }).catch(error => {
      Sentry.captureException(error, {
        tags: { operation: 'configureAudioMode' },
        extra: { message: 'Failed to configure foreground audio mode' },
      })
    })
  }, [])

  const playWord = useCallback(
    async (word: string, ttsUrl?: string | null) => {
      try {
        const audioUrl =
          ttsUrl ||
          `https://translate.google.com/translate_tts?ie=UTF-8&tl=nl&client=tw-ob&q=${encodeURIComponent(word)}`

        // Only update currentWord if it actually changed to prevent unnecessary rerenders
        if (currentWordRef.current !== word) {
          currentWordRef.current = word
          setCurrentWord(word)
        }

        player.pause()

        if (currentSourceRef.current === audioUrl) {
          await player.seekTo(0)
        } else {
          currentSourceRef.current = audioUrl
          player.replace(audioUrl)
        }

        player.play()
      } catch (error) {
        Sentry.captureException(error, {
          tags: { operation: 'playAudio' },
          extra: { message: 'Failed to play audio', word },
        })
        ToastService.show('Could not play pronunciation', ToastType.ERROR)
      }
    },
    [player]
  )

  const pauseAudio = useCallback(() => {
    player.pause()
  }, [player])

  const resumeAudio = useCallback(() => {
    if (currentSourceRef.current) {
      player.play()
    }
  }, [player])

  const stopAudio = useCallback(async () => {
    try {
      player.pause()
      if (currentSourceRef.current) {
        await player.seekTo(0)
      }
    } catch (error) {
      Sentry.captureException(error, {
        tags: { operation: 'stopAudio' },
        extra: { message: 'Failed to stop audio cleanly' },
      })
    }
  }, [player])

  // Memoize isPlaying to prevent frequent updates
  const isPlayingMemo = useMemo(() => status.playing || false, [status.playing])

  const contextValue: AudioContextType = useMemo(
    () => ({
      playWord,
      pauseAudio,
      resumeAudio,
      stopAudio,
      isPlaying: isPlayingMemo,
      currentWord,
    }),
    [currentWord, isPlayingMemo, pauseAudio, playWord, resumeAudio, stopAudio]
  )

  return (
    <AudioContext.Provider value={contextValue}>
      {children}
    </AudioContext.Provider>
  )
}

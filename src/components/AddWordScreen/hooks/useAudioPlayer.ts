import { useState } from 'react'
import { createAudioPlayer } from 'expo-audio'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { Sentry } from '@/lib/sentry.ts'

export const useAudioPlayer = () => {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)

  const playPronunciation = async (ttsUrl: string) => {
    if (isPlayingAudio) return

    setIsPlayingAudio(true)
    try {
      // Use expo-audio createAudioPlayer API
      const player = createAudioPlayer({ uri: ttsUrl })

      // Play the audio
      await player.play()

      // Simple timeout to reset state (since event listeners might be complex)
      setTimeout(() => {
        setIsPlayingAudio(false)
        player.release() // Clean up resources
      }, 3000) // 3 seconds should be enough for TTS
    } catch (error) {
      setIsPlayingAudio(false)
      Sentry.captureException('Error playing audio:', error)
      ToastService.show('Could not play pronunciation', ToastType.ERROR)
    }
  }

  return {
    isPlayingAudio,
    playPronunciation,
  }
}

import { useState } from 'react'
import { createAudioPlayer } from 'expo-audio'
import Toast from 'react-native-toast-message'

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
      console.error('Error playing audio:', error)
      setIsPlayingAudio(false)
      Toast.show({
        type: 'error',
        text1: 'Audio Error',
        text2: 'Could not play pronunciation. Please try again.',
      })
    }
  }

  return {
    isPlayingAudio,
    playPronunciation,
  }
}

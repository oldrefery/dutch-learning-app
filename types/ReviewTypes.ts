import { GestureResponderEvent } from 'react-native'
import { AudioPlayer } from 'expo-audio'

export interface ReviewScreenProps {
  // Props can be added here if needed
}

export interface UseReviewScreenReturn {
  // State
  reviewSession: any
  currentWord: any
  isFlipped: boolean
  isLoading: boolean
  audioPlayer: AudioPlayer | null

  // Actions
  playAudio: () => Promise<void>
  handleCardPress: () => void
  handleTouchStart: (event: GestureResponderEvent) => void
  handleTouchMove: (event: GestureResponderEvent) => void
  handleCorrect: () => Promise<void>
  handleIncorrect: () => Promise<void>
  handleDeleteWord: () => Promise<void>
  handleEndSession: () => void
}

export interface ReviewCardProps {
  word: any
  isFlipped: boolean
  onPress: () => void
  onTouchStart: (event: GestureResponderEvent) => void
  onTouchMove: (event: GestureResponderEvent) => void
  onDeleteWord: () => void
}

export interface ReviewControlsProps {
  onCorrect: () => void
  onIncorrect: () => void
  onEndSession: () => void
  isLoading: boolean
  canEndSession: boolean
}

export interface ReviewHeaderProps {
  currentIndex: number
  totalWords: number
  onEndSession: () => void
  canEndSession: boolean
}

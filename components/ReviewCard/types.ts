import type { Word } from '@/types/database'

// Shared props for review card components
export interface ReviewCardProps {
  currentWord: Word
}

export interface PronunciationProps {
  ttsUrl?: string
  isPlayingAudio: boolean
  onPress: (url: string) => void
  size?: 'small' | 'normal'
}

export interface ImageSectionProps extends ReviewCardProps {
  onChangeImage: () => void
}

export interface CardBackProps extends ReviewCardProps {
  onChangeImage: () => void
  isPlayingAudio: boolean
  onPlayPronunciation: (url: string) => void
  onDeleteWord: () => void
}

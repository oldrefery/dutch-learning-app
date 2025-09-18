import type { Word } from '@/types/database'
import React from 'react'

// Shared props for review card components
export interface ReviewCardProps {
  currentWord: Word
}

export interface PronunciationProps {
  ttsUrl: string | null
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
  pronunciationRef?: React.RefObject<any>
}

export interface ImageOption {
  url: string
  alt: string
}

export interface ImageSelectorProps {
  visible: boolean
  onClose: () => void
  onSelect: (imageUrl: string) => void
  currentImageUrl?: string
  englishTranslation: string
  partOfSpeech: string
  examples?: {
    nl: string
    en: string
    ru?: string
  }[]
}

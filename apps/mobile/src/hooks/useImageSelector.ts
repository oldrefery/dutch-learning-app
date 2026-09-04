import { useState } from 'react'

export interface UseImageSelectorReturn {
  showImageSelector: boolean
  setShowImageSelector: (show: boolean) => void
  openImageSelector: () => void
  closeImageSelector: () => void
}

export function useImageSelector(): UseImageSelectorReturn {
  const [showImageSelector, setShowImageSelector] = useState(false)

  const openImageSelector = () => setShowImageSelector(true)
  const closeImageSelector = () => setShowImageSelector(false)

  return {
    showImageSelector,
    setShowImageSelector,
    openImageSelector,
    closeImageSelector,
  }
}

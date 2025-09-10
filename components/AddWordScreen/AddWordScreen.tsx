import React, { useState, useEffect } from 'react'
import { View } from '@/components/Themed'
import ImageSelector from '@/components/ImageSelector'
import { WordInputSection } from './components/WordInputSection'
import { AnalysisResultCard } from './components/AnalysisResultCard'
import { AddToCollectionSection } from './components/AddToCollectionSection'
import { useAudioPlayer } from './hooks/useAudioPlayer'
import { useWordAnalysis } from './hooks/useWordAnalysis'
import { useAddWord } from './hooks/useAddWord'
import { useCollections } from '@/hooks/useCollections'
import { useAppStore } from '@/stores/useAppStore'
import { wordService } from '@/lib/supabase'
import { ToastService } from '@/components/AppToast'
import { ToastMessageType } from '@/constants/ToastConstants'
import { addWordScreenStyles } from './styles/AddWordScreen.styles'

export function AddWordScreen() {
  const [inputWord, setInputWord] = useState('')
  const [isAlreadyInCollection, setIsAlreadyInCollection] = useState(false)
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false)

  const { currentUserId } = useAppStore()
  const { isPlayingAudio, playPronunciation } = useAudioPlayer()
  const {
    isAnalyzing,
    analysisResult,
    analyzeWord,
    clearAnalysis,
    updateImageUrl,
  } = useWordAnalysis()
  const {
    isAdding,
    selectedCollection,
    setSelectedCollection,
    showImageSelector,
    addWord,
    openImageSelector,
    closeImageSelector,
  } = useAddWord()
  const { collections } = useCollections()

  // Check for duplicates after analysis is complete
  useEffect(() => {
    const checkForDuplicates = async () => {
      if (!analysisResult || !currentUserId) {
        setIsAlreadyInCollection(false)
        return
      }

      setIsCheckingDuplicate(true)
      try {
        const existingWord = await wordService.checkWordExists(
          currentUserId,
          analysisResult.dutch_lemma
        )
        const isDuplicate = !!existingWord
        setIsAlreadyInCollection(isDuplicate)

        if (isDuplicate) {
          ToastService.showInfo(
            ToastMessageType.WORD_ALREADY_EXISTS,
            `"${analysisResult.dutch_lemma}" is already in your collection`
          )
        }
      } catch (error) {
        console.error('Error checking word existence:', error)
        setIsAlreadyInCollection(false)
      } finally {
        setIsCheckingDuplicate(false)
      }
    }

    checkForDuplicates()
  }, [analysisResult, currentUserId])

  const handleAnalyze = async () => {
    if (!inputWord.trim()) {
      return
    }

    // Reset duplicate state when starting new analysis
    setIsAlreadyInCollection(false)
    setIsCheckingDuplicate(true)
    // Clear previous analysis result
    clearAnalysis()

    const normalizedWord = inputWord.trim().toLowerCase()

    // Check for duplicates before analysis
    if (currentUserId) {
      try {
        const existingWord = await wordService.checkWordExists(
          currentUserId,
          normalizedWord
        )
        if (existingWord) {
          setIsAlreadyInCollection(true)
          setIsCheckingDuplicate(false)
          ToastService.showInfo(
            ToastMessageType.WORD_ALREADY_EXISTS,
            `"${normalizedWord}" is already in your collection`
          )
          return
        }
      } catch (error) {
        console.error('Error checking word existence:', error)
        // Continue with analysis if check fails
      }
    }

    setIsCheckingDuplicate(false)
    analyzeWord(inputWord)
  }

  const handleAddWord = async () => {
    if (!analysisResult) return

    const success = await addWord(analysisResult)
    if (success) {
      // Clear form and analysis
      setInputWord('')
      clearAnalysis()
    }
  }

  const handleCancel = () => {
    setInputWord('')
    clearAnalysis()
  }

  const handleImageChange = (newImageUrl: string) => {
    updateImageUrl(newImageUrl)
    closeImageSelector()
  }

  return (
    <View style={addWordScreenStyles.container}>
      <WordInputSection
        inputWord={inputWord}
        setInputWord={setInputWord}
        onAnalyze={handleAnalyze}
        isAnalyzing={isAnalyzing}
        isCheckingDuplicate={isCheckingDuplicate}
      />

      {analysisResult && (
        <>
          <AnalysisResultCard
            analysisResult={analysisResult}
            isPlayingAudio={isPlayingAudio}
            onPlayPronunciation={playPronunciation}
            onImageChange={handleImageChange}
            onShowImageSelector={openImageSelector}
            isAlreadyInCollection={isAlreadyInCollection}
            isCheckingDuplicate={isCheckingDuplicate}
          />

          {/* Only show add to collection section if word is not already in collection */}
          {!isAlreadyInCollection && (
            <AddToCollectionSection
              selectedCollection={selectedCollection}
              onCollectionSelect={setSelectedCollection}
              onAddWord={handleAddWord}
              onCancel={handleCancel}
              isAdding={isAdding}
              collections={collections}
            />
          )}
        </>
      )}

      {/* Image Selector Modal */}
      {analysisResult && (
        <ImageSelector
          visible={showImageSelector}
          onClose={closeImageSelector}
          onSelect={handleImageChange}
          currentImageUrl={analysisResult.image_url || undefined}
          englishTranslation={analysisResult.translations.en[0] || ''}
          partOfSpeech={analysisResult.part_of_speech || ''}
          examples={analysisResult.examples || undefined}
        />
      )}
    </View>
  )
}

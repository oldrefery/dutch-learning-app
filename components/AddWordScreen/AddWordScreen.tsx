import React, { useState } from 'react'
import { View } from '@/components/Themed'
import ImageSelector from '@/components/ImageSelector'
import { WordInputSection } from './components/WordInputSection'
import { AnalysisResultCard } from './components/AnalysisResultCard'
import { AddToCollectionSection } from './components/AddToCollectionSection'
import { useAudioPlayer } from './hooks/useAudioPlayer'
import { useWordAnalysis } from './hooks/useWordAnalysis'
import { useAddWord } from './hooks/useAddWord'
import { useCollections } from '@/hooks/useCollections'
import { addWordScreenStyles } from './styles/AddWordScreen.styles'

export function AddWordScreen() {
  const [inputWord, setInputWord] = useState('')

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

  const handleAnalyze = () => {
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
      />

      {analysisResult && (
        <>
          <AnalysisResultCard
            analysisResult={analysisResult}
            isPlayingAudio={isPlayingAudio}
            onPlayPronunciation={playPronunciation}
            onImageChange={handleImageChange}
            onShowImageSelector={openImageSelector}
          />

          <AddToCollectionSection
            selectedCollection={selectedCollection}
            onCollectionSelect={setSelectedCollection}
            onAddWord={handleAddWord}
            onCancel={handleCancel}
            isAdding={isAdding}
            collections={collections}
          />
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

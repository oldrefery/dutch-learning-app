import React, { useState, useEffect } from 'react'
import { Keyboard } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { ViewThemed } from '@/components/Themed'
import ImageSelector from '@/components/ImageSelector'
import { FloatingActionButton } from '@/components/FloatingActionButton'
import { CompactWordInput } from './components/CompactWordInput'
import { DuplicateWordInfo } from './components/DuplicateWordInfo'
import {
  UniversalWordCard,
  WordCardPresets,
} from '@/components/UniversalWordCard'
import { useAudioPlayer } from './hooks/useAudioPlayer'
import { useWordAnalysis } from './hooks/useWordAnalysis'
import { useAddWord } from './hooks/useAddWord'
import { useCollections } from '@/hooks/useCollections'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { wordService } from '@/lib/supabase'
import { addWordScreenStyles } from './styles/AddWordScreen.styles'

interface AddWordScreenProps {
  preselectedCollectionId?: string
}

export function AddWordScreen({ preselectedCollectionId }: AddWordScreenProps) {
  const insets = useSafeAreaInsets()
  const [inputWord, setInputWord] = useState('')
  const [isAlreadyInCollection, setIsAlreadyInCollection] = useState(false)
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false)
  const [duplicateWordInfo, setDuplicateWordInfo] = useState<any>(null)
  const [lastDuplicateCheck, setLastDuplicateCheck] = useState<string | null>(
    null
  )
  const [hasNavigatedToCollection, setHasNavigatedToCollection] =
    useState(false)

  const { currentUserId } = useApplicationStore()
  const { isPlayingAudio, playPronunciation } = useAudioPlayer()
  const {
    isAnalyzing,
    analysisResult,
    analysisMetadata,
    analyzeWord,
    clearAnalysis,
    forceRefreshAnalysis,
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
  } = useAddWord(preselectedCollectionId)
  const { collections } = useCollections()

  // Check for duplicates after analysis is complete
  useEffect(() => {
    const checkForDuplicates = async () => {
      if (!analysisResult || !currentUserId) {
        setIsAlreadyInCollection(false)
        setDuplicateWordInfo(null)
        setIsCheckingDuplicate(false)
        return
      }

      setIsCheckingDuplicate(true)

      try {
        const existingWord = await wordService.checkWordExists(
          currentUserId,
          analysisResult.dutch_lemma,
          analysisResult.part_of_speech,
          analysisResult.article
        )
        const isDuplicate = !!existingWord

        setIsAlreadyInCollection(isDuplicate)
        setDuplicateWordInfo(existingWord)
        if (isDuplicate) {
          setLastDuplicateCheck(analysisResult.dutch_lemma)
        }
      } catch (error) {
        console.error('Error checking for duplicate word:', error)
        setIsAlreadyInCollection(false)
        setDuplicateWordInfo(null)
      } finally {
        setIsCheckingDuplicate(false)
      }
    }

    checkForDuplicates()
  }, [analysisResult, currentUserId])

  const handleAnalyze = async () => {
    // Normalize input: trim, remove periods, replace multiple spaces with a single space
    const normalizedWord = inputWord
      .trim()
      .replace(/\./g, '')
      .replace(/\s+/g, ' ')

    if (!normalizedWord) {
      return
    }

    setInputWord(normalizedWord)

    Keyboard.dismiss()

    setIsAlreadyInCollection(false)
    setDuplicateWordInfo(null)
    setIsCheckingDuplicate(true)
    setHasNavigatedToCollection(false)

    clearAnalysis()
    analyzeWord(normalizedWord)
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
    setIsAlreadyInCollection(false)
    setDuplicateWordInfo(null)
    setLastDuplicateCheck(null)
    setHasNavigatedToCollection(false)
  }

  const handleDismissDuplicate = () => {
    setInputWord('')
    clearAnalysis()
    setIsAlreadyInCollection(false)
    setDuplicateWordInfo(null)
    setLastDuplicateCheck(null)
    setHasNavigatedToCollection(false)
  }

  const handleForceRefresh = async () => {
    const normalizedWord = inputWord
      .trim()
      .replace(/\./g, '')
      .replace(/\s+/g, ' ')
    if (!normalizedWord) return

    setInputWord(normalizedWord)
    await forceRefreshAnalysis(normalizedWord)
  }

  const handleImageChange = (newImageUrl: string) => {
    updateImageUrl(newImageUrl)
    closeImageSelector()
  }

  // Reset navigation flag when returning to the screen
  useFocusEffect(
    React.useCallback(() => {
      // Reset the navigation flag if it was set, but preserve all duplicate state
      if (hasNavigatedToCollection) {
        setHasNavigatedToCollection(false)
      }
    }, [hasNavigatedToCollection])
  )

  return (
    <ViewThemed
      style={[
        addWordScreenStyles.container,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <CompactWordInput
        inputWord={inputWord}
        setInputWord={setInputWord}
        onAnalyze={handleAnalyze}
        isAnalyzing={isAnalyzing}
        isCheckingDuplicate={isCheckingDuplicate}
        selectedCollection={selectedCollection}
        collections={collections}
        onCollectionSelect={setSelectedCollection}
        onCancel={handleCancel}
      />

      {isAlreadyInCollection && duplicateWordInfo && (
        <DuplicateWordInfo
          duplicateWord={duplicateWordInfo}
          collections={collections}
          onDismiss={handleDismissDuplicate}
          onNavigateToCollection={() => setHasNavigatedToCollection(true)}
        />
      )}

      {/* Word information takes maximum space */}
      {analysisResult && !isAlreadyInCollection && !isCheckingDuplicate && (
        <ViewThemed style={{ flex: 1, marginTop: 8 }}>
          <UniversalWordCard
            word={analysisResult}
            metadata={analysisMetadata}
            actions={{
              ...WordCardPresets.analysis.actions,
              isDuplicateChecking: isCheckingDuplicate,
              isAlreadyInCollection: isAlreadyInCollection,
            }}
            isPlayingAudio={isPlayingAudio}
            onPlayPronunciation={playPronunciation}
            onChangeImage={openImageSelector}
            onForceRefresh={handleForceRefresh}
            style={{ flex: 1 }}
          />
        </ViewThemed>
      )}

      {analysisResult && !isAlreadyInCollection && !isCheckingDuplicate && (
        <FloatingActionButton
          onPress={handleAddWord}
          disabled={isAdding}
          loading={isAdding}
          icon="checkmark"
          label={`Add to ${selectedCollection?.name || 'Collection'}`}
        />
      )}

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
    </ViewThemed>
  )
}

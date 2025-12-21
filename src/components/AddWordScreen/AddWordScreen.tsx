import React, { useState, useEffect } from 'react'
import { Keyboard, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from '@react-navigation/native'
import { ViewThemed, TextThemed } from '@/components/Themed'
import { BlurView } from 'expo-blur'
import { usePreferReducedTransparency } from '@/hooks/usePreferReducedTransparency'
import ImageSelector from '@/components/ImageSelector'
import { FloatingActionButton } from '@/components/FloatingActionButton'
import { CompactWordInput } from './components/CompactWordInput'
import { DuplicateBanner } from './components/DuplicateBanner'
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
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { addWordScreenStyles } from './styles/AddWordScreen.styles'
import { Sentry } from '@/lib/sentry'
import { useHistoryStore } from '@/stores/useHistoryStore'
import { Colors } from '@/constants/Colors.ts'

interface DuplicateWordData {
  word_id: string
  dutch_lemma: string
  collection_id: string
  part_of_speech: string
  article?: string
}

interface AddWordScreenProps {
  preselectedCollectionId?: string
}

export function AddWordScreen({ preselectedCollectionId }: AddWordScreenProps) {
  const insets = useSafeAreaInsets()
  const reduceTransparency = usePreferReducedTransparency()
  const [inputWord, setInputWord] = useState('')
  const [isAlreadyInCollection, setIsAlreadyInCollection] = useState(false)
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false)
  const [duplicateWordInfo, setDuplicateWordInfo] =
    useState<DuplicateWordData | null>(null)
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
          ToastService.show(
            `Word "${analysisResult.dutch_lemma}" already exists in collection`,
            ToastType.ERROR
          )
        }
      } catch (error) {
        setIsAlreadyInCollection(false)
        setDuplicateWordInfo(null)
        Sentry.captureException(error, {
          tags: { operation: 'checkForDuplicates' },
          extra: {
            message: 'Error checking for duplicate word',
            dutchLemma: analysisResult?.dutch_lemma,
          },
        })
      } finally {
        setIsCheckingDuplicate(false)
      }
    }

    void checkForDuplicates()
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
    setIsCheckingDuplicate(false) // Don't set to true - useEffect will handle it after analysis
    setHasNavigatedToCollection(false)

    clearAnalysis()
    void analyzeWord(normalizedWord)
  }

  const handleAddWord = async () => {
    if (!analysisResult) return

    const success = await addWord(analysisResult)
    if (success) {
      setInputWord('')
      setIsAlreadyInCollection(true)

      // Add to word history with a collection name
      useHistoryStore
        .getState()
        .addAnalyzedWord(
          inputWord,
          analysisResult.dutch_lemma,
          selectedCollection?.name
        )
    }
  }

  const handleCancel = () => {
    setInputWord('')
    clearAnalysis()
    setIsAlreadyInCollection(false)
    setDuplicateWordInfo(null)
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
      <View
        style={{
          overflow: 'hidden',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
        }}
      >
        {reduceTransparency ? (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: Colors.transparent.white50,
            }}
          />
        ) : (
          <BlurView
            tint="default"
            intensity={25}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            experimentalBlurMethod={'dimezisBlurView'}
          />
        )}
        <View
          style={{
            paddingTop: insets.top + 12,
            paddingBottom: 12,
            paddingHorizontal: 16,
            backgroundColor: 'transparent',
          }}
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
            variant="glass"
          />
          {isAlreadyInCollection && duplicateWordInfo && (
            <DuplicateBanner
              duplicateWord={duplicateWordInfo}
              collections={collections}
              onNavigateToCollection={() => setHasNavigatedToCollection(true)}
            />
          )}
        </View>
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: 1,
            backgroundColor: Colors.transparent.hairlineLight,
          }}
        />
      </View>

      {analysisResult && (
        <ViewThemed style={{ flex: 1 }}>
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
            config={{
              extraHeightAddWord:
                120 + (isAlreadyInCollection && duplicateWordInfo ? 80 : 0),
            }}
          />

          {/* Loading indicator while checking duplicates */}
          {isCheckingDuplicate && (
            <ViewThemed
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: Colors.transparent.black10,
                justifyContent: 'center',
                alignItems: 'center',
                borderRadius: 12,
              }}
            >
              <TextThemed style={{ fontSize: 14, opacity: 0.7 }}>
                Checking for duplicates...
              </TextThemed>
            </ViewThemed>
          )}
        </ViewThemed>
      )}

      {analysisResult && !isAlreadyInCollection && !isCheckingDuplicate && (
        <FloatingActionButton
          testID="save-word-button"
          onPress={handleAddWord}
          disabled={isAdding}
          loading={isAdding}
          icon="checkmark"
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

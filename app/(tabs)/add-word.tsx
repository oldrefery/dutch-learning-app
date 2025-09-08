import React, { useState, useEffect } from 'react'
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native'
import { createAudioPlayer } from 'expo-audio'
import { Ionicons } from '@expo/vector-icons'
import Toast from 'react-native-toast-message'
import { Text, View } from '@/components/Themed'
import { useAppStore } from '@/stores/useAppStore'
import { wordService } from '@/lib/supabase'
import ImageSelector from '@/components/ImageSelector'
import CollectionSelector from '@/components/CollectionSelector'
import { useCollections } from '@/hooks/useCollections'
import type { Collection } from '@/types/database'

interface AnalysisResult {
  lemma: string
  part_of_speech: string
  is_irregular: boolean
  article?: 'de' | 'het' // Article for nouns
  is_reflexive?: boolean // For reflexive verbs
  is_expression?: boolean // For expressions/idioms
  expression_type?: 'idiom' | 'phrase' | 'collocation' | 'compound' // Type of expression
  is_separable?: boolean // For separable verbs
  prefix_part?: string // Separable prefix (op, aan, etc.)
  root_verb?: string // Root verb part
  translations: {
    en: string[]
    ru?: string[]
  }
  examples: {
    nl: string
    en: string
    ru?: string
  }[]
  tts_url?: string
  image_url?: string // Associated image for visual learning
}

export default function AddWordScreen() {
  const [inputWord, setInputWord] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  )
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)
  const [showImageSelector, setShowImageSelector] = useState(false)
  const [selectedCollection, setSelectedCollection] =
    useState<Collection | null>(null)

  const { addNewWord, clearError } = useAppStore()
  const { collections } = useCollections()

  // Auto-select first collection if available and none selected
  useEffect(() => {
    if (collections.length > 0 && !selectedCollection) {
      setSelectedCollection(collections[0])
    }
  }, [collections, selectedCollection])

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

  const handleAnalyze = async () => {
    if (!inputWord.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Please enter a Dutch word',
      })
      return
    }

    setIsAnalyzing(true)
    clearError()

    try {
      // Only analyze the word, don't add it yet
      const analysis = await wordService.analyzeWord(inputWord.trim())

      // Convert to display format
      const result: AnalysisResult = {
        lemma: analysis.lemma,
        part_of_speech: analysis.part_of_speech || 'unknown',
        is_irregular: analysis.is_irregular,
        article: analysis.article || undefined,
        is_reflexive: analysis.is_reflexive || false,
        is_expression: analysis.is_expression || false,
        expression_type: analysis.expression_type || undefined,
        is_separable: analysis.is_separable || false,
        prefix_part: analysis.prefix_part || undefined,
        root_verb: analysis.root_verb || undefined,
        translations: analysis.translations,
        examples: analysis.examples || [],
        tts_url: analysis.tts_url || undefined,
        image_url: analysis.image_url || undefined,
      }

      setAnalysisResult(result)
      Toast.show({
        type: 'success',
        text1: 'Analysis Complete',
        text2: 'Word has been analyzed successfully',
      })
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Analysis Failed',
        text2: error.message || 'Could not analyze word. Please try again.',
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleAddWord = async () => {
    if (!selectedCollection) {
      Toast.show({
        type: 'error',
        text1: 'Collection Required',
        text2: 'Please select a collection to add the word',
      })
      return
    }

    if (!analysisResult) {
      Toast.show({
        type: 'error',
        text1: 'No Analysis',
        text2: 'Please analyze a word first',
      })
      return
    }

    setIsAdding(true)

    try {
      // Add the analyzed word to the selected collection
      await addNewWord(inputWord.trim(), selectedCollection.collection_id)

      Toast.show({
        type: 'success',
        text1: 'Word Added',
        text2: `"${inputWord}" has been added to "${selectedCollection.name}"`,
      })

      // Clear everything after successful addition
      setAnalysisResult(null)
      setInputWord('')
      setSelectedCollection(null)
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Add Failed',
        text2: error.message || 'Could not add word. Please try again.',
      })
    } finally {
      setIsAdding(false)
    }
  }

  const handleAddAnother = () => {
    setInputWord('')
    setAnalysisResult(null)
  }

  const handleImageChange = (newImageUrl: string) => {
    if (analysisResult) {
      setAnalysisResult({
        ...analysisResult,
        image_url: newImageUrl,
      })
    }
  }

  const renderAnalysisResult = () => {
    if (!analysisResult) return null

    return (
      <ScrollView style={styles.resultContainer}>
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Analysis Result</Text>

          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Word:</Text>
            <View style={styles.wordWithPronunciation}>
              <Text style={styles.resultValue}>{analysisResult.lemma}</Text>
              {analysisResult.tts_url && (
                <TouchableOpacity
                  style={styles.pronunciationButton}
                  onPress={() => playPronunciation(analysisResult.tts_url!)}
                  disabled={isPlayingAudio}
                >
                  <Ionicons
                    name={isPlayingAudio ? 'volume-high' : 'volume-medium'}
                    size={20}
                    color="#2563eb"
                  />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>Type:</Text>
            <Text style={styles.resultValue}>
              {analysisResult.part_of_speech}
              {analysisResult.is_irregular ? ' (irregular)' : ''}
              {analysisResult.article ? ` (${analysisResult.article})` : ''}
              {analysisResult.is_reflexive ? ' (reflexive)' : ''}
              {analysisResult.is_expression
                ? ` (${analysisResult.expression_type || 'expression'})`
                : ''}
              {analysisResult.is_separable ? ' (separable)' : ''}
            </Text>
          </View>

          {analysisResult.is_separable &&
            analysisResult.prefix_part &&
            analysisResult.root_verb && (
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Parts:</Text>
                <Text style={styles.resultValue}>
                  <Text style={styles.prefixText}>
                    {analysisResult.prefix_part}
                  </Text>{' '}
                  + {analysisResult.root_verb}
                </Text>
              </View>
            )}

          <View style={styles.resultSection}>
            <Text style={styles.resultLabel}>English:</Text>
            {analysisResult.translations.en.map((translation, index) => (
              <Text key={index} style={styles.translationText}>
                • {translation}
              </Text>
            ))}
          </View>

          {analysisResult.translations.ru && (
            <View style={styles.resultSection}>
              <Text style={styles.resultLabel}>Russian:</Text>
              {analysisResult.translations.ru.map((translation, index) => (
                <Text key={index} style={styles.translationText}>
                  • {translation}
                </Text>
              ))}
            </View>
          )}

          {analysisResult.image_url && (
            <View style={styles.resultSection}>
              <Text style={styles.resultLabel}>Visual:</Text>
              <View style={styles.imageContainer}>
                <Image
                  source={{ uri: analysisResult.image_url }}
                  style={styles.associationImage}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.changeImageButton}
                  onPress={() => setShowImageSelector(true)}
                >
                  <Ionicons name="images" size={16} color="#3b82f6" />
                  <Text style={styles.changeImageText}>Change Image</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.resultSection}>
            <Text style={styles.resultLabel}>Examples:</Text>
            {analysisResult.examples.map((example, index) => (
              <View key={index} style={styles.exampleCard}>
                <Text style={styles.exampleDutch}>{example.nl}</Text>
                <Text style={styles.exampleTranslation}>{example.en}</Text>
                {example.ru && (
                  <Text style={styles.exampleTranslation}>{example.ru}</Text>
                )}
              </View>
            ))}
          </View>

          <View style={styles.addToCollectionSection}>
            <Text style={styles.addToCollectionTitle}>Add to Collection</Text>

            <View style={styles.collectionSelectorContainer}>
              <Text style={styles.collectionLabel}>Select Collection *</Text>
              <CollectionSelector
                selectedCollectionId={selectedCollection?.collection_id || null}
                onCollectionSelect={setSelectedCollection}
                placeholder="Choose a collection..."
              />
            </View>

            <TouchableOpacity
              style={[
                styles.addButton,
                (!selectedCollection || isAdding) && styles.addButtonDisabled,
              ]}
              onPress={handleAddWord}
              disabled={!selectedCollection || isAdding}
            >
              {isAdding ? (
                <View style={styles.addButtonLoading}>
                  <ActivityIndicator size="small" color="white" />
                  <Text style={styles.addButtonText}>Adding...</Text>
                </View>
              ) : (
                <Text
                  style={[
                    styles.addButtonText,
                    !selectedCollection && styles.addButtonTextDisabled,
                  ]}
                >
                  Add Word to Collection
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.cancelButton,
                isAdding && styles.cancelButtonDisabled,
              ]}
              onPress={handleAddAnother}
              disabled={isAdding}
            >
              <Text
                style={[
                  styles.cancelButtonText,
                  isAdding && styles.cancelButtonTextDisabled,
                ]}
              >
                Cancel & Start Over
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.inputSection}>
        <Text style={styles.title}>Add New Word</Text>
        <Text style={styles.subtitle}>
          Enter a Dutch word to analyze with AI
        </Text>

        <TextInput
          style={styles.textInput}
          value={inputWord}
          onChangeText={setInputWord}
          placeholder="Type a Dutch word..."
          placeholderTextColor="#9ca3af"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={[styles.analyzeButton, isAnalyzing && styles.buttonDisabled]}
          onPress={handleAnalyze}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.analyzeButtonText}>Analyze with AI</Text>
          )}
        </TouchableOpacity>
      </View>

      {renderAnalysisResult()}

      {analysisResult && (
        <ImageSelector
          visible={showImageSelector}
          onClose={() => setShowImageSelector(false)}
          onSelect={handleImageChange}
          currentImageUrl={analysisResult.image_url}
          englishTranslation={analysisResult.translations.en[0] || ''}
          partOfSpeech={analysisResult.part_of_speech}
          examples={analysisResult.examples}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  inputSection: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 20,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: 'white',
  },
  analyzeButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
  },
  analyzeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resultContainer: {
    flex: 1,
  },
  resultCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#1f2937',
  },
  resultRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  resultSection: {
    marginBottom: 16,
  },
  resultLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
    minWidth: 80,
  },
  resultValue: {
    fontSize: 14,
    color: '#1f2937',
    flex: 1,
  },
  wordWithPronunciation: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  pronunciationButton: {
    padding: 4,
    borderRadius: 4,
    backgroundColor: '#f3f4f6',
  },
  translationText: {
    fontSize: 14,
    color: '#1f2937',
    marginLeft: 16,
    marginBottom: 4,
  },
  exampleCard: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    marginLeft: 16,
  },
  exampleDutch: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  exampleTranslation: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 2,
  },
  saveButton: {
    backgroundColor: '#16a34a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  associationImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginLeft: 16,
    marginTop: 8,
  },
  prefixText: {
    fontWeight: 'bold',
    color: '#dc2626', // Red color to highlight the separable prefix
  },
  imageContainer: {
    marginLeft: 16,
    marginTop: 8,
  },
  changeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  changeImageText: {
    marginLeft: 6,
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  // Add to collection section
  addToCollectionSection: {
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  addToCollectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  collectionSelectorContainer: {
    marginBottom: 20,
  },
  collectionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  addButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  addButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  addButtonTextDisabled: {
    color: '#6B7280',
  },
  addButtonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '500',
  },
  cancelButtonDisabled: {
    opacity: 0.5,
  },
  cancelButtonTextDisabled: {
    color: '#9CA3AF',
  },
})

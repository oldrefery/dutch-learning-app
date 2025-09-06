import React, { useState } from 'react'
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { createAudioPlayer } from 'expo-audio'
import { Ionicons } from '@expo/vector-icons'
import Toast from 'react-native-toast-message'
import { Text, View } from '@/components/Themed'
import { useAppStore } from '@/stores/useAppStore'

interface AnalysisResult {
  lemma: string
  part_of_speech: string
  is_irregular: boolean
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
}

export default function AddWordScreen() {
  const [inputWord, setInputWord] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(
    null
  )
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)

  const { addNewWord, error, clearError } = useAppStore()

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

  const mockAnalyzeWord = async (word: string): Promise<AnalysisResult> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Mock response based on input
    const mockResponses: Record<string, AnalysisResult> = {
      spreken: {
        lemma: 'spreken',
        part_of_speech: 'verb',
        is_irregular: true,
        translations: {
          en: ['to speak', 'to talk'],
          ru: ['говорить', 'разговаривать'],
        },
        examples: [
          {
            nl: 'Kun je Nederlands spreken?',
            en: 'Can you speak Dutch?',
            ru: 'Умеешь ли ты говорить по-голландски?',
          },
          {
            nl: 'We spreken morgen af.',
            en: 'We will meet tomorrow.',
            ru: 'Мы встретимся завтра.',
          },
        ],
      },
      huis: {
        lemma: 'huis',
        part_of_speech: 'noun',
        is_irregular: false,
        translations: {
          en: ['house', 'home'],
          ru: ['дом'],
        },
        examples: [
          {
            nl: 'Mijn huis is groot.',
            en: 'My house is big.',
            ru: 'Мой дом большой.',
          },
        ],
      },
    }

    return (
      mockResponses[word.toLowerCase()] || {
        lemma: word,
        part_of_speech: 'unknown',
        is_irregular: false,
        translations: {
          en: ['[AI analysis would provide translation]'],
          ru: ['[перевод будет предоставлен ИИ]'],
        },
        examples: [
          {
            nl: `Example with ${word}...`,
            en: `Example with ${word}...`,
            ru: `Пример с ${word}...`,
          },
        ],
      }
    )
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
      // Use real AI analysis from the store
      const newWord = await addNewWord(inputWord.trim())

      // Convert to display format
      const result: AnalysisResult = {
        lemma: newWord.dutch_lemma,
        part_of_speech: newWord.part_of_speech,
        is_irregular: newWord.is_irregular,
        translations: newWord.translations,
        examples: newWord.examples,
        tts_url: newWord.tts_url,
      }

      setAnalysisResult(result)
      setInputWord('') // Clear input after successful analysis
      Toast.show({
        type: 'success',
        text1: 'Success!',
        text2: 'Word added successfully!',
      })
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Failed to analyze word. Please try again.',
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleAddAnother = () => {
    setInputWord('')
    setAnalysisResult(null)
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
            </Text>
          </View>

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

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleAddAnother}
          >
            <Text style={styles.saveButtonText}>Add Another Word</Text>
          </TouchableOpacity>
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
})

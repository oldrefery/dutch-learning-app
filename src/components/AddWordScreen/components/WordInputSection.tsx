import React from 'react'
import {
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import type { WordInputSectionProps } from '../types/AddWordTypes'
import { wordInputStyles } from '../styles/WordInputSection.styles'

export function WordInputSection({
  inputWord,
  setInputWord,
  onAnalyze,
  isAnalyzing,
  isCheckingDuplicate = false,
}: WordInputSectionProps) {
  const colorScheme = useColorScheme() ?? 'light'
  return (
    <ViewThemed
      style={wordInputStyles.container}
      lightColor={Colors.background.primary}
      darkColor={Colors.dark.background}
    >
      <TextThemed style={wordInputStyles.title}>Add New Dutch Word</TextThemed>
      <TextThemed style={wordInputStyles.subtitle}>
        Enter a Dutch word to analyze and add to your collection
      </TextThemed>

      <ViewThemed
        style={[
          wordInputStyles.inputContainer,
          {
            backgroundColor:
              colorScheme === 'dark'
                ? Colors.dark.backgroundSecondary
                : Colors.neutral[50],
            borderColor:
              colorScheme === 'dark'
                ? Colors.dark.backgroundTertiary
                : Colors.neutral[200],
          },
        ]}
      >
        <TextInput
          style={[
            wordInputStyles.textInput,
            {
              color:
                colorScheme === 'dark' ? Colors.dark.text : Colors.neutral[900],
            },
          ]}
          value={inputWord}
          onChangeText={setInputWord}
          placeholder="Enter Dutch word (e.g., 'hallo', 'fiets')"
          placeholderTextColor={
            colorScheme === 'dark'
              ? Colors.dark.textTertiary
              : Colors.neutral[400]
          }
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          textContentType="none"
          spellCheck={false}
          keyboardType="ascii-capable"
          returnKeyType="search"
          onSubmitEditing={onAnalyze}
        />
        <TouchableOpacity
          style={[
            wordInputStyles.analyzeButton,
            (isAnalyzing || isCheckingDuplicate) &&
              wordInputStyles.analyzeButtonDisabled,
          ]}
          onPress={onAnalyze}
          disabled={isAnalyzing || isCheckingDuplicate}
        >
          {isAnalyzing || isCheckingDuplicate ? (
            <ActivityIndicator size="small" color={Colors.background.primary} />
          ) : (
            <Ionicons
              name="search"
              size={20}
              color={Colors.background.primary}
            />
          )}
        </TouchableOpacity>
      </ViewThemed>

      {(isAnalyzing || isCheckingDuplicate) && (
        <ViewThemed style={wordInputStyles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.primary.DEFAULT} />
          <TextThemed style={wordInputStyles.loadingText}>
            {isCheckingDuplicate
              ? 'Checking for duplicates...'
              : 'Analyzing word with AI...'}
          </TextThemed>
        </ViewThemed>
      )}
    </ViewThemed>
  )
}

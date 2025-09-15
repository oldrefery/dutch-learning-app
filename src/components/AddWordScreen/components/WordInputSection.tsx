import React from 'react'
import { TextInput, TouchableOpacity, ActivityIndicator } from 'react-native'
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
  return (
    <ViewThemed style={wordInputStyles.container}>
      <TextThemed style={wordInputStyles.title}>Add New Dutch Word</TextThemed>
      <TextThemed style={wordInputStyles.subtitle}>
        Enter a Dutch word to analyze and add to your collection
      </TextThemed>

      <ViewThemed style={wordInputStyles.inputContainer}>
        <TextInput
          style={wordInputStyles.textInput}
          value={inputWord}
          onChangeText={setInputWord}
          placeholder="Enter Dutch word (e.g., 'hallo', 'fiets')"
          placeholderTextColor={Colors.neutral[400]}
          autoCapitalize="none"
          autoCorrect={false}
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

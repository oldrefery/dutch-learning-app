import React from 'react'
import { TextInput, ActivityIndicator, useColorScheme } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { AnalyzeButton } from './AnalyzeButton'
import type { WordInputSectionProps } from '../types/AddWordTypes'
import { wordInputStyles } from '../styles/WordInputSection.styles'

export const WordInputSection = ({
  inputWord,
  setInputWord,
  onAnalyze,
  isAnalyzing,
  isCheckingDuplicate = false,
}: WordInputSectionProps) => {
  const colorScheme = useColorScheme() ?? 'light'
  const isLoading = isAnalyzing || isCheckingDuplicate

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
        style={wordInputStyles.inputWithButtonWrapper}
        lightColor="transparent"
        darkColor="transparent"
      >
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
                  colorScheme === 'dark'
                    ? Colors.dark.text
                    : Colors.neutral[900],
              },
            ]}
            value={inputWord}
            onChangeText={setInputWord}
            placeholder="Enter Dutch word..."
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
            editable={!isLoading}
          />
        </ViewThemed>

        {isLoading ? (
          <ViewThemed style={wordInputStyles.analyzeButtonContainer}>
            <ActivityIndicator size="small" color={Colors.primary.DEFAULT} />
          </ViewThemed>
        ) : (
          <AnalyzeButton
            isAnalyzing={isAnalyzing}
            isCheckingDuplicate={isCheckingDuplicate}
            onPress={onAnalyze}
            size="medium"
          />
        )}
      </ViewThemed>

      {isLoading && (
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

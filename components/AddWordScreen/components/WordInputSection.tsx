import React from 'react'
import {
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Text, View } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import type { WordInputSectionProps } from '../types/AddWordTypes'
import { wordInputStyles } from '../styles/WordInputSection.styles'

export function WordInputSection({
  inputWord,
  setInputWord,
  onAnalyze,
  isAnalyzing,
}: WordInputSectionProps) {
  return (
    <View style={wordInputStyles.container}>
      <Text style={wordInputStyles.title}>Add New Dutch Word</Text>
      <Text style={wordInputStyles.subtitle}>
        Enter a Dutch word to analyze and add to your collection
      </Text>

      <View style={wordInputStyles.inputContainer}>
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
            isAnalyzing && wordInputStyles.analyzeButtonDisabled,
          ]}
          onPress={onAnalyze}
          disabled={isAnalyzing}
        >
          {isAnalyzing ? (
            <ActivityIndicator size="small" color={Colors.background.primary} />
          ) : (
            <Ionicons
              name="search"
              size={20}
              color={Colors.background.primary}
            />
          )}
        </TouchableOpacity>
      </View>

      {isAnalyzing && (
        <View style={wordInputStyles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.primary.DEFAULT} />
          <Text style={wordInputStyles.loadingText}>
            Analyzing word with AI...
          </Text>
        </View>
      )}
    </View>
  )
}

import React from 'react'
import {
  TextInput,
  ActivityIndicator,
  useColorScheme,
  ActionSheetIOS,
  Platform,
  type ViewStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { AnalyzeButton } from './AnalyzeButton'
import { CollectionSelector } from './CollectionSelector'
import type { Collection } from '@/types/database'

interface CompactWordInputProps {
  inputWord: string
  setInputWord: (word: string) => void
  onAnalyze: () => void
  isAnalyzing: boolean
  isCheckingDuplicate: boolean
  selectedCollection: Collection | null
  collections: Collection[]
  onCollectionSelect: (collection: Collection | null) => void
  onCancel?: () => void
  variant?: 'default' | 'glass'
}

// Styles helper to reduce complexity
const getStyles = (
  colorScheme: 'light' | 'dark',
  variant: 'default' | 'glass'
): {
  container: ViewStyle
  collectionRow: ViewStyle
  inputContainer: ViewStyle
  analyzeContainer: ViewStyle
  loadingContainer: ViewStyle
} => ({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  collectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
    backgroundColor:
      variant === 'glass'
        ? colorScheme === 'dark'
          ? Colors.transparent.white10
          : Colors.transparent.white20
        : colorScheme === 'dark'
          ? Colors.dark.backgroundSecondary
          : Colors.neutral[50],
    borderRadius: 9999,
    borderWidth: 1,
    borderColor:
      variant === 'glass'
        ? colorScheme === 'dark'
          ? Colors.transparent.hairlineDark
          : Colors.transparent.hairlineLight
        : colorScheme === 'dark'
          ? Colors.dark.backgroundTertiary
          : Colors.neutral[200],
  },
  analyzeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 4,
    backgroundColor: 'transparent',
  },
})

export function CompactWordInput({
  inputWord,
  setInputWord,
  onAnalyze,
  isAnalyzing,
  isCheckingDuplicate,
  selectedCollection,
  collections,
  onCollectionSelect,
  variant = 'default',
}: CompactWordInputProps) {
  const colorScheme = useColorScheme() ?? 'light'
  const styles = getStyles(colorScheme, variant)

  const handleCollectionPress = () => {
    if (Platform.OS === 'ios') {
      const options = collections.map(c => c.name)
      options.push('Cancel')

      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: options.length - 1,
          title: 'Select Collection',
        },
        buttonIndex => {
          if (buttonIndex < collections.length) {
            onCollectionSelect(collections[buttonIndex])
          }
        }
      )
    }
  }

  return (
    <ViewThemed style={styles.container}>
      <CollectionSelector
        selectedCollection={selectedCollection}
        onPress={handleCollectionPress}
        colorScheme={colorScheme}
      />

      <ViewThemed style={styles.analyzeContainer}>
        <ViewThemed style={styles.inputContainer}>
          <Ionicons
            name="search"
            size={20}
            color={
              colorScheme === 'dark'
                ? Colors.dark.textSecondary
                : Colors.neutral[400]
            }
            style={{ marginLeft: 12 }}
          />

          <TextInput
            testID="word-input"
            style={{
              flex: 1,
              paddingVertical: 12,
              paddingHorizontal: 8,
              fontSize: 16,
              color:
                colorScheme === 'dark' ? Colors.dark.text : Colors.neutral[900],
            }}
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
          />
        </ViewThemed>
        <AnalyzeButton
          isAnalyzing={isAnalyzing}
          isCheckingDuplicate={isCheckingDuplicate}
          onPress={onAnalyze}
          size="medium"
        />
      </ViewThemed>

      {(isAnalyzing || isCheckingDuplicate) && (
        <ViewThemed style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.primary.DEFAULT} />
          <TextThemed
            style={{
              marginLeft: 8,
              fontSize: 14,
              color:
                colorScheme === 'dark'
                  ? Colors.dark.textSecondary
                  : Colors.neutral[600],
            }}
          >
            {isCheckingDuplicate
              ? 'Checking for duplicates...'
              : 'Analyzing word with AI...'}
          </TextThemed>
        </ViewThemed>
      )}
    </ViewThemed>
  )
}

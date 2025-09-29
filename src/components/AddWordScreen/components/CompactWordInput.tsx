import React from 'react'
import {
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  ActionSheetIOS,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
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
}

// Styles helper to reduce complexity
const getStyles = (colorScheme: 'light' | 'dark') => ({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor:
      colorScheme === 'dark'
        ? Colors.dark.background
        : Colors.background.primary,
  },
  collectionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 8,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor:
      colorScheme === 'dark'
        ? Colors.dark.backgroundSecondary
        : Colors.neutral[50],
    borderRadius: 8,
    borderWidth: 1,
    borderColor:
      colorScheme === 'dark'
        ? Colors.dark.backgroundTertiary
        : Colors.neutral[200],
  },
  loadingContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: 8,
    paddingVertical: 4,
  },
})

const CollectionSelector = ({
  selectedCollection,
  onPress,
  colorScheme,
}: {
  selectedCollection: Collection | null
  onPress: () => void
  colorScheme: 'light' | 'dark'
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={getStyles(colorScheme).collectionRow}
  >
    <TextThemed
      style={{
        fontSize: 16,
        fontWeight: '500',
        color:
          colorScheme === 'dark'
            ? Colors.dark.textSecondary
            : Colors.neutral[600],
      }}
    >
      Adding to:{' '}
    </TextThemed>
    <TextThemed
      style={{
        fontSize: 16,
        fontWeight: '600',
        color:
          colorScheme === 'dark' ? Colors.dark.tint : Colors.primary.DEFAULT,
        flex: 1,
      }}
    >
      {selectedCollection?.name || 'Select Collection'}
    </TextThemed>
    <Ionicons
      name="chevron-down"
      size={16}
      color={
        colorScheme === 'dark' ? Colors.dark.textSecondary : Colors.neutral[600]
      }
    />
  </TouchableOpacity>
)

const AnalyzeButton = ({
  isAnalyzing,
  isCheckingDuplicate,
  onAnalyze,
  colorScheme,
}: {
  isAnalyzing: boolean
  isCheckingDuplicate: boolean
  onAnalyze: () => void
  colorScheme: 'light' | 'dark'
}) => (
  <TouchableOpacity
    style={{
      backgroundColor:
        colorScheme === 'dark' ? Colors.dark.tint : Colors.primary.DEFAULT,
      paddingHorizontal: 16,
      paddingVertical: 8,
      marginRight: 4,
      borderRadius: 6,
    }}
    onPress={onAnalyze}
    disabled={isAnalyzing || isCheckingDuplicate}
  >
    {isAnalyzing || isCheckingDuplicate ? (
      <ActivityIndicator size="small" color="white" />
    ) : (
      <Ionicons name="search" size={16} color="white" />
    )}
  </TouchableOpacity>
)

export function CompactWordInput({
  inputWord,
  setInputWord,
  onAnalyze,
  isAnalyzing,
  isCheckingDuplicate,
  selectedCollection,
  collections,
  onCollectionSelect,
  onCancel,
}: CompactWordInputProps) {
  const colorScheme = useColorScheme() ?? 'light'
  const styles = getStyles(colorScheme)

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

        <AnalyzeButton
          isAnalyzing={isAnalyzing}
          isCheckingDuplicate={isCheckingDuplicate}
          onAnalyze={onAnalyze}
          colorScheme={colorScheme}
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

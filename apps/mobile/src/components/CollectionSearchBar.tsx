import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Platform,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/constants/Colors'
import { SEARCH_DEBOUNCE_DELAY } from '@/constants/UIConstants'
import { ViewThemed, TextThemed } from '@/components/Themed'
import { useDebounce } from '@/hooks/useDebounce'

interface CollectionSearchBarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  placeholder?: string
  resultCount?: number
  totalCount?: number
}

export default function CollectionSearchBar({
  searchQuery,
  onSearchChange,
  placeholder = 'Search Dutch words...',
  resultCount,
  totalCount,
}: CollectionSearchBarProps) {
  const colorScheme = useColorScheme() ?? 'light'
  const [isFocused, setIsFocused] = useState(false)
  const [localValue, setLocalValue] = useState(searchQuery)
  const inputRef = useRef<TextInput>(null)

  // Sync local value with external searchQuery when it changes from outside
  useEffect(() => {
    setLocalValue(searchQuery)
  }, [searchQuery])

  // Debounce search to avoid excessive filtering while typing
  const debouncedSearch = useDebounce((query: string) => {
    onSearchChange(query)
  }, SEARCH_DEBOUNCE_DELAY)

  const handleTextChange = useCallback(
    (text: string) => {
      setLocalValue(text) // Update local display immediately
      debouncedSearch(text) // Debounce the search
    },
    [debouncedSearch]
  )

  const handleClearSearch = useCallback(() => {
    setLocalValue('')
    onSearchChange('')
    inputRef.current?.clear()
    inputRef.current?.blur()
  }, [onSearchChange])

  const handleFocus = useCallback(() => {
    setIsFocused(true)
  }, [])

  const handleBlur = useCallback(() => {
    setIsFocused(false)
  }, [])

  // Colors based on theme and state
  const backgroundColor =
    colorScheme === 'dark'
      ? Colors.dark.backgroundTertiary
      : Colors.background.secondary

  const borderColor = isFocused
    ? colorScheme === 'dark'
      ? Colors.dark.tint
      : Colors.primary.DEFAULT
    : colorScheme === 'dark'
      ? Colors.dark.backgroundTertiary
      : Colors.neutral[200]

  const textColor =
    colorScheme === 'dark' ? Colors.dark.text : Colors.neutral[900]

  const placeholderColor =
    colorScheme === 'dark' ? Colors.dark.textSecondary : Colors.neutral[500]

  const iconColor =
    colorScheme === 'dark' ? Colors.dark.textSecondary : Colors.neutral[600]

  const showResultCount =
    localValue.trim().length > 0 &&
    resultCount !== undefined &&
    totalCount !== undefined

  return (
    <ViewThemed style={styles.container}>
      <View
        style={[
          styles.searchContainer,
          {
            backgroundColor,
            borderColor,
            borderWidth: isFocused ? 2 : 1,
          },
        ]}
      >
        <Ionicons
          name="search"
          size={20}
          color={iconColor}
          style={styles.searchIcon}
        />

        <TextInput
          ref={inputRef}
          style={[
            styles.textInput,
            {
              color: textColor,
            },
          ]}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          value={localValue}
          onChangeText={handleTextChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
          returnKeyType="search"
          clearButtonMode={Platform.OS === 'ios' ? 'while-editing' : 'never'}
          selectionColor={
            colorScheme === 'dark' ? Colors.dark.tint : Colors.primary.DEFAULT
          }
        />

        {/* Custom clear button for Android or when we want consistent behavior */}
        {localValue.length > 0 && Platform.OS === 'android' && (
          <TouchableOpacity
            onPress={handleClearSearch}
            style={styles.clearButton}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={20} color={iconColor} />
          </TouchableOpacity>
        )}
      </View>

      {/* Search results count */}
      {showResultCount && (
        <TextThemed
          style={[
            styles.resultCount,
            {
              color: placeholderColor,
            },
          ]}
        >
          {resultCount} of {totalCount} words
        </TextThemed>
      )}
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44, // HIG minimum touch target
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  searchIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
    // Platform-specific font adjustments
    ...Platform.select({
      ios: {
        fontWeight: '400',
      },
      android: {
        fontFamily: 'System',
        includeFontPadding: false,
      },
    }),
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
  resultCount: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '500',
  },
})

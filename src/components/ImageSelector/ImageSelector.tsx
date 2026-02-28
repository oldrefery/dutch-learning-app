import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  ActivityIndicator,
  TextInput,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { IMAGE_CONFIG } from '@/constants/AppConfig'
import { supabase } from '@/lib/supabaseClient'
import { getImageSelectorStyles } from './styles'
import type { ImageOption, ImageSelectorProps } from './types'
import { Sentry } from '@/lib/sentry'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'

export default function ImageSelector({
  visible,
  onClose,
  onSelect,
  currentImageUrl,
  englishTranslation,
  partOfSpeech,
  examples,
}: ImageSelectorProps) {
  const [images, setImages] = useState<ImageOption[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [offset, setOffset] = useState(0)
  const [searchQuery, setSearchQuery] = useState(englishTranslation)
  const prevEnglishTranslation = useRef(englishTranslation)
  const colorScheme = useNormalizedColorScheme()
  const styles = getImageSelectorStyles(colorScheme)

  const loadImages = useCallback(async () => {
    if (!searchQuery.trim()) {
      setError('Please enter a search query')
      return
    }

    setLoading(true)
    setError(null)
    setImages([]) // Clear previous images
    setOffset(0) // Reset offset

    try {
      const { data, error } = await supabase.functions.invoke(
        'get-multiple-images',
        {
          body: {
            englishTranslation: searchQuery,
            partOfSpeech,
            examples,
            count: IMAGE_CONFIG.SELECTOR_OPTIONS_COUNT,
          },
        }
      )

      if (error) {
        Sentry.captureException(new Error(error.message), {
          tags: { operation: 'loadImages' },
          extra: { message: 'Edge function returned error' },
        })
      }

      setImages(data.images || [])
    } catch (err) {
      setError('Failed to load image options. Please try again.')
      Sentry.captureException(err, {
        tags: { operation: 'loadImages' },
        extra: {
          message: 'Failed to load images',
          searchQuery,
          partOfSpeech,
        },
      })
    } finally {
      setLoading(false)
    }
  }, [searchQuery, partOfSpeech, examples])

  const loadMoreImages = useCallback(async () => {
    setLoadingMore(true)
    setError(null)

    try {
      const nextOffset = offset + IMAGE_CONFIG.SELECTOR_OPTIONS_COUNT

      const { data, error } = await supabase.functions.invoke(
        'get-multiple-images',
        {
          body: {
            englishTranslation: searchQuery,
            partOfSpeech,
            examples,
            count: IMAGE_CONFIG.SELECTOR_OPTIONS_COUNT,
            offset: nextOffset,
          },
        }
      )

      if (error) {
        Sentry.captureException(new Error(error.message), {
          tags: { operation: 'loadMoreImages' },
          extra: { message: 'Edge function returned error' },
        })
      }

      const newImages = data.images || []

      if (newImages.length > 0) {
        setImages(prevImages => [...prevImages, ...newImages])
        setOffset(nextOffset)
      } else {
        setError('No more images available for this search.')
      }
    } catch (err) {
      setError('Failed to load more images. Please try again.')
      Sentry.captureException(err, {
        tags: { operation: 'loadMoreImages' },
        extra: {
          message: 'Failed to load more images',
          searchQuery,
          partOfSpeech,
          offset,
        },
      })
    } finally {
      setLoadingMore(false)
    }
  }, [searchQuery, partOfSpeech, examples, offset])

  // Handle modal open/close and word changes
  useEffect(() => {
    if (visible) {
      // Update the search query only if the word changed
      if (englishTranslation !== prevEnglishTranslation.current) {
        setSearchQuery(englishTranslation)
        prevEnglishTranslation.current = englishTranslation
        loadImages()
      } else if (images.length === 0) {
        // First time opening - load images
        loadImages()
      }
    } else {
      // Clear images when modal closes to save memory
      setImages([])
      setError(null)
      setOffset(0)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, englishTranslation])

  const handleImageSelect = (imageUrl: string) => {
    onSelect(imageUrl)
    onClose()
  }

  const renderLoadingState = () => (
    <ViewThemed style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={Colors.primary.DEFAULT} />
      <TextThemed style={styles.loadingText}>
        Finding better images...
      </TextThemed>
    </ViewThemed>
  )

  const renderErrorState = () => (
    <ViewThemed style={styles.errorContainer}>
      <TextThemed style={styles.errorText}>{error}</TextThemed>
      <TouchableOpacity onPress={loadImages} style={styles.retryButton}>
        <TextThemed style={styles.retryButtonText}>Try Again</TextThemed>
      </TouchableOpacity>
    </ViewThemed>
  )

  const renderImageGrid = () => (
    <ScrollView style={styles.imageGrid} showsVerticalScrollIndicator={false}>
      <ViewThemed style={styles.gridContainer}>
        {images.map((image, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.imageOption,
              currentImageUrl === image.url && styles.currentImage,
            ]}
            onPress={() => handleImageSelect(image.url)}
          >
            <Image source={{ uri: image.url }} style={styles.optionImage} />
            {currentImageUrl === image.url && (
              <ViewThemed style={styles.currentBadge}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={Colors.success.DEFAULT}
                />
                <TextThemed style={styles.currentText}>Current</TextThemed>
              </ViewThemed>
            )}
          </TouchableOpacity>
        ))}
      </ViewThemed>

      {/* Load More Button */}
      {images.length > 0 && (
        <ViewThemed style={styles.loadMoreContainer}>
          <TouchableOpacity
            style={[
              styles.loadMoreButton,
              loadingMore && styles.loadMoreButtonDisabled,
            ]}
            onPress={loadMoreImages}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <ActivityIndicator size="small" color={Colors.primary.DEFAULT} />
            ) : (
              <TextThemed style={styles.loadMoreText}>
                Load More Images
              </TextThemed>
            )}
          </TouchableOpacity>
        </ViewThemed>
      )}
    </ScrollView>
  )

  const renderContent = () => {
    if (loading) {
      return renderLoadingState()
    }

    if (error) {
      return renderErrorState()
    }

    return renderImageGrid()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <ViewThemed style={styles.container}>
        <ViewThemed style={styles.header}>
          <TextThemed style={styles.title}>Choose Image</TextThemed>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons
              name="close"
              size={24}
              color={
                colorScheme === 'dark'
                  ? Colors.dark.textSecondary
                  : Colors.light.textSecondary
              }
            />
          </TouchableOpacity>
        </ViewThemed>

        <TextThemed style={styles.subtitle}>
          Select a better image for &quot;{englishTranslation}&quot;
        </TextThemed>

        <ViewThemed style={styles.searchContainer}>
          <TextInput
            style={[
              styles.searchInput,
              {
                color:
                  colorScheme === 'dark' ? Colors.dark.text : Colors.light.text,
                backgroundColor:
                  colorScheme === 'dark'
                    ? Colors.dark.backgroundSecondary
                    : Colors.light.backgroundSecondary,
                borderColor:
                  colorScheme === 'dark'
                    ? Colors.dark.border
                    : Colors.light.border,
              },
            ]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Change search query..."
            placeholderTextColor={
              colorScheme === 'dark'
                ? Colors.dark.textSecondary
                : Colors.light.textSecondary
            }
            returnKeyType="search"
            onSubmitEditing={loadImages}
          />
          <TouchableOpacity
            style={styles.searchButton}
            onPress={loadImages}
            disabled={loading}
          >
            <Ionicons
              name="search"
              size={20}
              color={Colors.background.primary}
            />
          </TouchableOpacity>
        </ViewThemed>

        {renderContent()}
      </ViewThemed>
    </Modal>
  )
}

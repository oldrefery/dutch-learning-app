import React, { useState, useEffect, useCallback } from 'react'
import {
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { IMAGE_CONFIG } from '@/constants/AppConfig'
import { supabase } from '@/lib/supabaseClient'
import { imageSelectorStyles } from './styles'
import type { ImageOption, ImageSelectorProps } from './types'

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

  const loadImages = useCallback(async () => {
    setLoading(true)
    setError(null)
    setImages([]) // Clear previous images
    setOffset(0) // Reset offset

    try {
      const { data, error } = await supabase.functions.invoke(
        'get-multiple-images',
        {
          body: {
            englishTranslation,
            partOfSpeech,
            examples,
            count: IMAGE_CONFIG.SELECTOR_OPTIONS_COUNT,
          },
        }
      )

      if (error) {
        throw new Error(error.message)
      }

      setImages(data.images || [])
    } catch (err) {
      console.error('Failed to load images:', err)
      setError('Failed to load image options. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [englishTranslation, partOfSpeech, examples])

  const loadMoreImages = useCallback(async () => {
    setLoadingMore(true)
    setError(null)

    try {
      const nextOffset = offset + IMAGE_CONFIG.SELECTOR_OPTIONS_COUNT

      const { data, error } = await supabase.functions.invoke(
        'get-multiple-images',
        {
          body: {
            englishTranslation,
            partOfSpeech,
            examples,
            count: IMAGE_CONFIG.SELECTOR_OPTIONS_COUNT,
            offset: nextOffset,
          },
        }
      )

      if (error) {
        throw new Error(error.message)
      }

      const newImages = data.images || []

      if (newImages.length > 0) {
        setImages(prevImages => [...prevImages, ...newImages])
        setOffset(nextOffset)
      } else {
        setError('No more images available for this search.')
      }
    } catch (err) {
      console.error('Failed to load more images:', err)
      setError('Failed to load more images. Please try again.')
    } finally {
      setLoadingMore(false)
    }
  }, [englishTranslation, partOfSpeech, examples, offset])

  // Load images when modal opens or word changes
  useEffect(() => {
    if (visible && englishTranslation) {
      loadImages()
    } else if (!visible) {
      // Clear images when modal closes to save memory
      setImages([])
      setError(null)
      setOffset(0)
    }
  }, [visible, englishTranslation, partOfSpeech, loadImages])

  const handleImageSelect = (imageUrl: string) => {
    onSelect(imageUrl)
    onClose()
  }

  const renderLoadingState = () => (
    <ViewThemed style={imageSelectorStyles.loadingContainer}>
      <ActivityIndicator size="large" color={Colors.primary.DEFAULT} />
      <TextThemed style={imageSelectorStyles.loadingText}>
        Finding better images...
      </TextThemed>
    </ViewThemed>
  )

  const renderErrorState = () => (
    <ViewThemed style={imageSelectorStyles.errorContainer}>
      <TextThemed style={imageSelectorStyles.errorText}>{error}</TextThemed>
      <TouchableOpacity
        onPress={loadImages}
        style={imageSelectorStyles.retryButton}
      >
        <TextThemed style={imageSelectorStyles.retryButtonText}>
          Try Again
        </TextThemed>
      </TouchableOpacity>
    </ViewThemed>
  )

  const renderImageGrid = () => (
    <ScrollView
      style={imageSelectorStyles.imageGrid}
      showsVerticalScrollIndicator={false}
    >
      <ViewThemed style={imageSelectorStyles.gridContainer}>
        {images.map((image, index) => (
          <TouchableOpacity
            key={index}
            style={[
              imageSelectorStyles.imageOption,
              currentImageUrl === image.url && imageSelectorStyles.currentImage,
            ]}
            onPress={() => handleImageSelect(image.url)}
          >
            <Image
              source={{ uri: image.url }}
              style={imageSelectorStyles.optionImage}
            />
            {currentImageUrl === image.url && (
              <ViewThemed style={imageSelectorStyles.currentBadge}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={Colors.success.DEFAULT}
                />
                <TextThemed style={imageSelectorStyles.currentText}>
                  Current
                </TextThemed>
              </ViewThemed>
            )}
          </TouchableOpacity>
        ))}
      </ViewThemed>

      {/* Load More Button */}
      {images.length > 0 && (
        <ViewThemed style={imageSelectorStyles.loadMoreContainer}>
          <TouchableOpacity
            style={[
              imageSelectorStyles.loadMoreButton,
              loadingMore && imageSelectorStyles.loadMoreButtonDisabled,
            ]}
            onPress={loadMoreImages}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <ActivityIndicator size="small" color={Colors.primary.DEFAULT} />
            ) : (
              <TextThemed style={imageSelectorStyles.loadMoreText}>
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
      <ViewThemed style={imageSelectorStyles.container}>
        <ViewThemed style={imageSelectorStyles.header}>
          <TextThemed style={imageSelectorStyles.title}>
            Choose Image
          </TextThemed>
          <TouchableOpacity
            onPress={onClose}
            style={imageSelectorStyles.closeButton}
          >
            <Ionicons name="close" size={24} color={Colors.neutral[700]} />
          </TouchableOpacity>
        </ViewThemed>

        <TextThemed style={imageSelectorStyles.subtitle}>
          Select a better image for &quot;{englishTranslation}&quot;
        </TextThemed>

        {renderContent()}
      </ViewThemed>
    </Modal>
  )
}

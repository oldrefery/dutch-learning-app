import React, { useState, useEffect, useCallback } from 'react'
import {
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Text, View } from '@/components/Themed'
import { IMAGE_CONFIG, UI_CONFIG } from '@/constants/AppConfig'
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

  const handleImageSelect = (imageUrl: string) => {
    onSelect(imageUrl)
    onClose()
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={imageSelectorStyles.container}>
        <View style={imageSelectorStyles.header}>
          <Text style={imageSelectorStyles.title}>Choose Image</Text>
          <TouchableOpacity
            onPress={onClose}
            style={imageSelectorStyles.closeButton}
          >
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <Text style={imageSelectorStyles.subtitle}>
          Select a better image for &quot;{englishTranslation}&quot;
        </Text>

        {loading ? (
          <View style={imageSelectorStyles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={imageSelectorStyles.loadingText}>
              Finding better images...
            </Text>
          </View>
        ) : error ? (
          <View style={imageSelectorStyles.errorContainer}>
            <Text style={imageSelectorStyles.errorText}>{error}</Text>
            <TouchableOpacity
              onPress={loadImages}
              style={imageSelectorStyles.retryButton}
            >
              <Text style={imageSelectorStyles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={imageSelectorStyles.imageGrid}
            showsVerticalScrollIndicator={false}
          >
            <View style={imageSelectorStyles.gridContainer}>
              {images.map((image, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    imageSelectorStyles.imageOption,
                    currentImageUrl === image.url &&
                      imageSelectorStyles.currentImage,
                  ]}
                  onPress={() => handleImageSelect(image.url)}
                >
                  <Image
                    source={{ uri: image.url }}
                    style={imageSelectorStyles.optionImage}
                  />
                  {currentImageUrl === image.url && (
                    <View style={imageSelectorStyles.currentBadge}>
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#10b981"
                      />
                      <Text style={imageSelectorStyles.currentText}>
                        Current
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Load More Button */}
            {images.length > 0 && (
              <View style={imageSelectorStyles.loadMoreContainer}>
                <TouchableOpacity
                  style={[
                    imageSelectorStyles.loadMoreButton,
                    loadingMore && imageSelectorStyles.loadMoreButtonDisabled,
                  ]}
                  onPress={loadMoreImages}
                  disabled={loadingMore}
                >
                  {loadingMore ? (
                    <ActivityIndicator size="small" color="#3b82f6" />
                  ) : (
                    <Text style={imageSelectorStyles.loadMoreText}>
                      Load More Images
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  )
}

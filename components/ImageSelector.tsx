import React, { useState, useEffect } from 'react'
import {
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { Text, View } from '@/components/Themed'
import { IMAGE_CONFIG } from '@/constants/AppConfig'

interface ImageOption {
  url: string
  alt: string
}

interface ImageSelectorProps {
  visible: boolean
  onClose: () => void
  onSelect: (imageUrl: string) => void
  currentImageUrl?: string
  englishTranslation: string
  partOfSpeech: string
  examples?: {
    nl: string
    en: string
    ru?: string
  }[]
}

const { width } = Dimensions.get('window')

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
  const [error, setError] = useState<string | null>(null)

  // Load images when modal opens or word changes
  useEffect(() => {
    if (visible && englishTranslation) {
      loadImages()
    } else if (!visible) {
      // Clear images when modal closes to save memory
      setImages([])
      setError(null)
    }
  }, [visible, englishTranslation, partOfSpeech])

  const loadImages = async () => {
    setLoading(true)
    setError(null)
    setImages([]) // Clear previous images

    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

      const response = await fetch(
        `${supabaseUrl}/functions/v1/get-multiple-images`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            englishTranslation,
            partOfSpeech,
            examples,
            count: IMAGE_CONFIG.SELECTOR_OPTIONS_COUNT,
          }),
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      setImages(data.images || [])
    } catch (err) {
      console.error('Failed to load images:', err)
      setError('Failed to load image options. Please try again.')
    } finally {
      setLoading(false)
    }
  }

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
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Choose Image</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>
          Select a better image for &quot;{englishTranslation}&quot;
        </Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Finding better images...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={loadImages} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            style={styles.imageGrid}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.gridContainer}>
              {images.map((image, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.imageOption,
                    currentImageUrl === image.url && styles.currentImage,
                  ]}
                  onPress={() => handleImageSelect(image.url)}
                >
                  <Image
                    source={{ uri: image.url }}
                    style={styles.optionImage}
                  />
                  {currentImageUrl === image.url && (
                    <View style={styles.currentBadge}>
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#10b981"
                      />
                      <Text style={styles.currentText}>Current</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  imageGrid: {
    flex: 1,
    paddingHorizontal: 16,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  imageOption: {
    width: (width - 48) / 2, // 2 columns with padding
    aspectRatio: 1.5,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  optionImage: {
    width: '100%',
    height: '100%',
  },
  currentImage: {
    borderWidth: 3,
    borderColor: '#10b981',
  },
  currentBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  currentText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#10b981',
    marginLeft: 4,
  },
})

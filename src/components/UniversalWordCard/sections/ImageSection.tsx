import React from 'react'
import { TouchableOpacity, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { styles } from '../styles'
import type { WordSectionProps } from '../types'

export function ImageSection({
  word,
  config,
  onChangeImage,
}: WordSectionProps) {
  if (!config.showImage) return null

  const imageUrl = word.image_url
  if (!imageUrl && !config.enableImageChange) return null

  return (
    <ViewThemed
      style={[styles.section, config.compact && styles.compactSection]}
    >
      <TextThemed
        style={[
          styles.sectionTitle,
          config.compact && styles.compactSectionTitle,
        ]}
      >
        <TextThemed style={styles.sectionIcon}>🖼️</TextThemed>
        Visual
      </TextThemed>

      <ViewThemed style={styles.imageContainer}>
        {imageUrl && (
          <Image
            source={{ uri: imageUrl }}
            style={[
              styles.wordImage,
              config.compact && styles.compactWordImage,
            ]}
            resizeMode="cover"
          />
        )}

        {config.enableImageChange && onChangeImage && (
          <TouchableOpacity
            style={styles.changeImageButton}
            onPress={onChangeImage}
          >
            <Ionicons name="images" size={16} color={Colors.primary.DEFAULT} />
            <TextThemed style={styles.changeImageText}>
              {imageUrl ? 'Change Image' : 'Add Image'}
            </TextThemed>
          </TouchableOpacity>
        )}
      </ViewThemed>
    </ViewThemed>
  )
}

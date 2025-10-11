import React from 'react'
import { Image } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { GlassCapsuleButton } from '@/components/glass/buttons'
import { NonSwipeableArea } from '@/components/NonSwipeableArea'
import { styles } from '../styles'
import type { WordSectionProps } from '../types'

// Change the image button component following HIG guidelines
interface ChangeImageButtonProps {
  imageUrl: string | null | undefined
  onPress: () => void
}

function ChangeImageButton({ imageUrl, onPress }: ChangeImageButtonProps) {
  return (
    <GlassCapsuleButton
      icon="images"
      text={imageUrl ? 'Change Image' : 'Add Image'}
      onPress={onPress}
      variant="tinted"
      size="medium"
      accessibilityLabel={imageUrl ? 'Change image' : 'Add image'}
      accessibilityHint="Opens image selector to choose a new image"
    />
  )
}

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
          <NonSwipeableArea>
            <ChangeImageButton imageUrl={imageUrl} onPress={onChangeImage} />
          </NonSwipeableArea>
        )}
      </ViewThemed>
    </ViewThemed>
  )
}

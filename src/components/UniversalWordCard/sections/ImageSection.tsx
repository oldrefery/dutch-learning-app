import React from 'react'
import { Image, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { scheduleOnRN } from 'react-native-worklets'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { styles } from '../styles'
import type { WordSectionProps } from '../types'

// Change the image button component with gesture blocking
interface ChangeImageButtonProps {
  imageUrl: string | null | undefined
  onPress: () => void
}

function ChangeImageButton({ imageUrl, onPress }: ChangeImageButtonProps) {
  const handleChangeImagePress = () => {
    onPress()
  }

  const tapGesture = Gesture.Tap()
    .onEnd(() => {
      'worklet'
      scheduleOnRN(handleChangeImagePress)
    })
    .blocksExternalGesture()

  return (
    <GestureDetector gesture={tapGesture}>
      <View style={styles.changeImageButton}>
        <Ionicons name="images" size={16} color={Colors.primary.DEFAULT} />
        <TextThemed style={styles.changeImageText}>
          {imageUrl ? 'Change Image' : 'Add Image'}
        </TextThemed>
      </View>
    </GestureDetector>
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
          <ChangeImageButton imageUrl={imageUrl} onPress={onChangeImage} />
        )}
      </ViewThemed>
    </ViewThemed>
  )
}

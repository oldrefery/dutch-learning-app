import React, { useState } from 'react'
import { View, Image, ActivityIndicator } from 'react-native'
import { styles } from '../styles'

interface WordImageProps {
  imageUrl: string | null
}

export default function WordImage({ imageUrl }: WordImageProps) {
  const [imageLoading, setImageLoading] = useState(true)

  if (!imageUrl) return null

  return (
    <View style={styles.imageContainer}>
      {imageLoading && (
        <View style={styles.imageLoadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}
      <Image
        source={{ uri: imageUrl }}
        style={styles.image}
        onLoad={() => setImageLoading(false)}
        onError={() => setImageLoading(false)}
      />
    </View>
  )
}

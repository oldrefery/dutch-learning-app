import React from 'react'
import { StyleSheet, TouchableOpacity, Image } from 'react-native'
import { Text, View } from '@/components/Themed'
import { Ionicons } from '@expo/vector-icons'
import type { ImageSectionProps } from './types'

export function ImageSection({
  currentWord,
  onChangeImage,
}: ImageSectionProps) {
  if (!currentWord.image_url) return null

  return (
    <View style={styles.imageSection}>
      <View style={styles.imageSectionHeader}>
        <Text style={styles.sectionTitle}>🖼️ Visual</Text>
        <TouchableOpacity
          style={styles.changeImageButton}
          onPress={onChangeImage}
        >
          <Ionicons name="refresh" size={16} color="#6b7280" />
          <Text style={styles.changeImageText}>Change</Text>
        </TouchableOpacity>
      </View>
      <Image
        source={{ uri: currentWord.image_url }}
        style={styles.wordImage}
        resizeMode="cover"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  imageSection: {
    marginBottom: 20,
  },
  imageSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  changeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
  },
  changeImageText: {
    marginLeft: 4,
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  wordImage: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    backgroundColor: '#f3f4f6',
  },
})

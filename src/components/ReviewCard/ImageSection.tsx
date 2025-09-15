import React from 'react'
import { StyleSheet, TouchableOpacity, Image } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/constants/Colors'
import type { ImageSectionProps } from './types'

export function ImageSection({
  currentWord,
  onChangeImage,
}: ImageSectionProps) {
  if (!currentWord.image_url) return null

  return (
    <ViewThemed style={styles.imageSection}>
      <ViewThemed style={styles.imageSectionHeader}>
        <TextThemed style={styles.sectionTitle}>🖼️ Visual</TextThemed>
        <TouchableOpacity
          style={styles.changeImageButton}
          onPress={onChangeImage}
        >
          <Ionicons name="refresh" size={16} color={Colors.neutral[500]} />
          <TextThemed style={styles.changeImageText}>Change</TextThemed>
        </TouchableOpacity>
      </ViewThemed>
      <Image
        source={{ uri: currentWord.image_url }}
        style={styles.wordImage}
        resizeMode="cover"
      />
    </ViewThemed>
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
    color: Colors.neutral[700],
  },
  changeImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    backgroundColor: Colors.neutral[100],
  },
  changeImageText: {
    marginLeft: 4,
    fontSize: 14,
    color: Colors.neutral[500],
    fontWeight: '500',
  },
  wordImage: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    backgroundColor: Colors.neutral[100],
  },
})

import React from 'react'
import { View, TouchableOpacity } from 'react-native'
import { TextThemed } from '@/components/Themed'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/constants/Colors'
import { styles } from '../styles'

interface WordHeaderProps {
  dutchLemma: string | null
  article: string | null
  onClose: () => void
}

export default function WordHeader({
  dutchLemma,
  article,
  onClose,
}: WordHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <TextThemed style={styles.wordTitle}>{dutchLemma}</TextThemed>
        {article && (
          <TextThemed style={styles.articleText}>({article})</TextThemed>
        )}
      </View>
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Ionicons name="close" size={24} color={Colors.neutral[600]} />
      </TouchableOpacity>
    </View>
  )
}

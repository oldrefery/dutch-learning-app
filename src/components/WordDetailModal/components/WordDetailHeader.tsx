import React from 'react'
import { View, TouchableOpacity } from 'react-native'
import { Text } from '@/components/Themed'
import { Ionicons } from '@expo/vector-icons'
import { Colors } from '@/constants/Colors'
import { styles } from '../styles'

interface WordHeaderProps {
  dutchOriginal: string | null
  dutchLemma: string | null
  article: string | null
  onClose: () => void
}

export default function WordHeader({
  dutchOriginal,
  dutchLemma,
  article,
  onClose,
}: WordHeaderProps) {
  const displayWord = dutchOriginal || dutchLemma

  return (
    <View style={styles.header}>
      <View style={styles.headerContent}>
        <Text style={styles.wordTitle}>{displayWord}</Text>
        {article && <Text style={styles.articleText}>({article})</Text>}
      </View>
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Ionicons name="close" size={24} color={Colors.neutral[600]} />
      </TouchableOpacity>
    </View>
  )
}

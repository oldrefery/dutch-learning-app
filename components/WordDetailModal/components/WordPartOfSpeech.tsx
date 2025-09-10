import React from 'react'
import { View, Text } from '@/components/Themed'
import { styles } from '../styles'

interface WordPartOfSpeechProps {
  partOfSpeech: string | null
}

export default function WordPartOfSpeech({
  partOfSpeech,
}: WordPartOfSpeechProps) {
  if (!partOfSpeech) return null

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Part of Speech</Text>
      <Text style={styles.partOfSpeechText}>{partOfSpeech}</Text>
    </View>
  )
}

import React from 'react'
import { ViewThemed, TextThemed } from '@/components/Themed'
import { styles } from '../styles'

interface WordPartOfSpeechProps {
  partOfSpeech: string | null
}

export default function WordPartOfSpeech({
  partOfSpeech,
}: WordPartOfSpeechProps) {
  if (!partOfSpeech) return null

  return (
    <ViewThemed style={styles.section}>
      <TextThemed style={styles.sectionTitle}>Part of Speech</TextThemed>
      <TextThemed style={styles.partOfSpeechText}>{partOfSpeech}</TextThemed>
    </ViewThemed>
  )
}

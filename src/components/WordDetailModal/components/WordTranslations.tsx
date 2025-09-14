import React from 'react'
import { View, Text } from '@/components/Themed'
import { styles } from '../styles'

interface WordTranslationsProps {
  translations: {
    en?: string[]
    ru?: string[]
  }
}

export default function WordTranslations({
  translations,
}: WordTranslationsProps) {
  if (!translations) return null

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Translations</Text>
      <View style={styles.translationsContainer}>
        {translations.en?.map((translation, index) => (
          <View key={index} style={styles.translationItem}>
            <Text style={styles.translationText}>{translation}</Text>
          </View>
        ))}
        {translations.ru?.map((translation, index) => (
          <View key={`ru-${index}`} style={styles.translationItem}>
            <Text style={styles.translationTextRussian}>{translation}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

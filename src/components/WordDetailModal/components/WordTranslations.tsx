import React from 'react'
import { ViewThemed, TextThemed } from '@/components/Themed'
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
    <ViewThemed style={styles.section}>
      <TextThemed style={styles.sectionTitle}>Translations</TextThemed>
      <ViewThemed style={styles.translationsContainer}>
        {translations.en?.map((translation, index) => (
          <ViewThemed key={index} style={styles.translationItem}>
            <TextThemed style={styles.translationText}>
              {translation}
            </TextThemed>
          </ViewThemed>
        ))}
        {translations.ru?.map((translation, index) => (
          <ViewThemed key={`ru-${index}`} style={styles.translationItem}>
            <TextThemed style={styles.translationTextRussian}>
              {translation}
            </TextThemed>
          </ViewThemed>
        ))}
      </ViewThemed>
    </ViewThemed>
  )
}

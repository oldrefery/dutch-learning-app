import React from 'react'
import { StyleSheet } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import type { ReviewCardProps } from './types'

export function TranslationsSection({ currentWord }: ReviewCardProps) {
  const hasRussianTranslations =
    currentWord.translations.ru && currentWord.translations.ru.length > 0

  return (
    <ViewThemed style={styles.translationsSection}>
      <TextThemed style={styles.sectionTitle}>💬 Translations</TextThemed>

      <ViewThemed style={styles.translationGroup}>
        <TextThemed style={styles.languageLabel}>🇬🇧 English:</TextThemed>
        {currentWord.translations.en.map((translation, index) => (
          <TextThemed key={index} style={styles.translationText}>
            • {translation}
          </TextThemed>
        ))}
      </ViewThemed>

      {hasRussianTranslations && (
        <ViewThemed style={styles.translationGroup}>
          <TextThemed style={styles.languageLabel}>🇷🇺 Russian:</TextThemed>
          {currentWord.translations.ru!.map((translation, index) => (
            <TextThemed key={index} style={styles.translationText}>
              • {translation}
            </TextThemed>
          ))}
        </ViewThemed>
      )}
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  translationsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[700],
    marginBottom: 12,
  },
  translationGroup: {
    marginBottom: 12,
  },
  languageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.neutral[700],
    marginBottom: 4,
  },
  translationText: {
    fontSize: 16,
    color: Colors.neutral[600],
    marginBottom: 2,
    paddingLeft: 8,
  },
})

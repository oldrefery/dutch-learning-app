import React from 'react'
import { StyleSheet } from 'react-native'
import { Text, View } from '@/components/Themed'
import type { ReviewCardProps } from './types'

export function TranslationsSection({ currentWord }: ReviewCardProps) {
  const hasRussianTranslations =
    currentWord.translations.ru && currentWord.translations.ru.length > 0

  return (
    <View style={styles.translationsSection}>
      <Text style={styles.sectionTitle}>💬 Translations</Text>

      <View style={styles.translationGroup}>
        <Text style={styles.languageLabel}>🇬🇧 English:</Text>
        {currentWord.translations.en.map((translation, index) => (
          <Text key={index} style={styles.translationText}>
            • {translation}
          </Text>
        ))}
      </View>

      {hasRussianTranslations && (
        <View style={styles.translationGroup}>
          <Text style={styles.languageLabel}>🇷🇺 Russian:</Text>
          {currentWord.translations.ru!.map((translation, index) => (
            <Text key={index} style={styles.translationText}>
              • {translation}
            </Text>
          ))}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  translationsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  translationGroup: {
    marginBottom: 12,
  },
  languageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  translationText: {
    fontSize: 16,
    color: '#4b5563',
    marginBottom: 2,
    paddingLeft: 8,
  },
})

import React from 'react'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { styles } from '../styles'
import type { WordSectionProps } from '../types'

export function TranslationsSection({ word, config }: WordSectionProps) {
  if (!config.showTranslations || !word.translations) {
    return null
  }

  const hasEnglish = word.translations.en?.length > 0
  const hasRussian = word.translations.ru && word.translations.ru.length > 0

  if (!hasEnglish && !hasRussian) {
    return null
  }

  return (
    <ViewThemed
      style={[styles.section, config.compact && styles.compactSection]}
    >
      <TextThemed
        style={[
          styles.sectionTitle,
          config.compact && styles.compactSectionTitle,
        ]}
      >
        <TextThemed style={styles.sectionIcon}>💬</TextThemed>
        Translations
      </TextThemed>

      {hasEnglish && (
        <ViewThemed style={styles.translationGroup}>
          <TextThemed style={styles.languageLabel}>🇬🇧 English:</TextThemed>
          {word.translations.en!.map((translation, index) => (
            <ViewThemed key={index} style={styles.translationItem}>
              <TextThemed style={styles.translationBullet}>•</TextThemed>
              <TextThemed
                style={[
                  styles.translationText,
                  config.compact && styles.compactTranslationText,
                ]}
              >
                {translation}
              </TextThemed>
            </ViewThemed>
          ))}
        </ViewThemed>
      )}

      {hasRussian && (
        <ViewThemed style={styles.translationGroup}>
          <TextThemed style={styles.languageLabel}>🇷🇺 Russian:</TextThemed>
          {word.translations.ru!.map((translation, index) => (
            <ViewThemed key={index} style={styles.translationItem}>
              <TextThemed style={styles.translationBullet}>•</TextThemed>
              <TextThemed
                style={[
                  styles.translationText,
                  config.compact && styles.compactTranslationText,
                ]}
              >
                {translation}
              </TextThemed>
            </ViewThemed>
          ))}
        </ViewThemed>
      )}
    </ViewThemed>
  )
}

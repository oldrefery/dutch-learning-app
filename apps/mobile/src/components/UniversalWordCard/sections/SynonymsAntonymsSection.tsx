import React from 'react'
import { TouchableOpacity, useColorScheme } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { styles } from '../styles'
import type { WordSectionProps } from '../types'

export function SynonymsAntonymsSection({ word, config }: WordSectionProps) {
  const colorScheme = useColorScheme() ?? 'light'
  if (!config.showSynonyms && !config.showAntonyms) return null

  const synonyms = 'synonyms' in word ? word.synonyms : []
  const antonyms = 'antonyms' in word ? word.antonyms : []
  const hasSynonyms = synonyms && synonyms.length > 0
  const hasAntonyms = antonyms && antonyms.length > 0

  if (!hasSynonyms && !hasAntonyms) return null

  return (
    <>
      {config.showSynonyms && hasSynonyms && (
        <ViewThemed
          style={[styles.section, config.compact && styles.compactSection]}
        >
          <TextThemed
            style={[
              styles.sectionTitle,
              config.compact && styles.compactSectionTitle,
            ]}
          >
            <TextThemed style={styles.sectionIcon}>🔄</TextThemed>
            Synonyms
          </TextThemed>

          <ViewThemed style={styles.wordList}>
            {synonyms.map((synonym, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.wordChip,
                  styles.synonymChip,
                  colorScheme === 'dark' && {
                    backgroundColor: Colors.success.darkModeChip,
                    borderColor: Colors.success.darkModeChipText,
                  },
                ]}
                activeOpacity={0.7}
              >
                <TextThemed
                  style={[
                    styles.wordChipText,
                    styles.synonymChipText,
                    colorScheme === 'dark' && {
                      color: Colors.success.darkModeChipText,
                    },
                  ]}
                  selectable
                >
                  {synonym}
                </TextThemed>
              </TouchableOpacity>
            ))}
          </ViewThemed>
        </ViewThemed>
      )}

      {config.showAntonyms && hasAntonyms && (
        <ViewThemed
          style={[styles.section, config.compact && styles.compactSection]}
        >
          <TextThemed
            style={[
              styles.sectionTitle,
              config.compact && styles.compactSectionTitle,
            ]}
          >
            <TextThemed style={styles.sectionIcon}>↔️</TextThemed>
            Antonyms
          </TextThemed>

          <ViewThemed style={styles.wordList}>
            {antonyms.map((antonym, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.wordChip,
                  styles.antonymChip,
                  colorScheme === 'dark' && {
                    backgroundColor: Colors.error.darkModeChip,
                    borderColor: Colors.error.darkModeChipText,
                  },
                ]}
                activeOpacity={0.7}
              >
                <TextThemed
                  style={[
                    styles.wordChipText,
                    styles.antonymChipText,
                    colorScheme === 'dark' && {
                      color: Colors.error.darkModeChipText,
                    },
                  ]}
                  selectable
                >
                  {antonym}
                </TextThemed>
              </TouchableOpacity>
            ))}
          </ViewThemed>
        </ViewThemed>
      )}
    </>
  )
}

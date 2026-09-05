import React from 'react'
import { StyleSheet } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import type { ReviewCardProps } from './types'

export function ExamplesSection({ currentWord }: ReviewCardProps) {
  const hasExamples = currentWord.examples && currentWord.examples.length > 0

  if (!hasExamples) return null

  return (
    <ViewThemed style={styles.examplesSection}>
      <TextThemed style={styles.sectionTitle}>📝 Examples</TextThemed>
      {currentWord.examples!.map((example, index) => (
        <ViewThemed key={index} style={styles.exampleItem}>
          <TextThemed style={styles.exampleDutch}>{example.nl}</TextThemed>
          <TextThemed style={styles.exampleTranslation}>
            🇬🇧 {example.en}
          </TextThemed>
          {example.ru && (
            <TextThemed style={styles.exampleTranslation}>
              🇷🇺 {example.ru}
            </TextThemed>
          )}
        </ViewThemed>
      ))}
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  examplesSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[700],
    marginBottom: 12,
  },
  exampleItem: {
    backgroundColor: Colors.background.secondary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.primary.DEFAULT,
  },
  exampleDutch: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.neutral[700],
    marginBottom: 8,
  },
  exampleTranslation: {
    fontSize: 14,
    color: Colors.neutral[500],
    marginBottom: 4,
  },
})

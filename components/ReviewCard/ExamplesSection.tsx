import React from 'react'
import { StyleSheet } from 'react-native'
import { Text, View } from '@/components/Themed'
import type { ReviewCardProps } from './types'

export function ExamplesSection({ currentWord }: ReviewCardProps) {
  const hasExamples = currentWord.examples && currentWord.examples.length > 0

  if (!hasExamples) return null

  return (
    <View style={styles.examplesSection}>
      <Text style={styles.sectionTitle}>📝 Examples</Text>
      {currentWord.examples!.map((example, index) => (
        <View key={index} style={styles.exampleItem}>
          <Text style={styles.exampleDutch}>{example.nl}</Text>
          <Text style={styles.exampleTranslation}>🇬🇧 {example.en}</Text>
          {example.ru && (
            <Text style={styles.exampleTranslation}>🇷🇺 {example.ru}</Text>
          )}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  examplesSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  exampleItem: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  exampleDutch: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  exampleTranslation: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
})

import React from 'react'
import { StyleSheet } from 'react-native'
import { Text, View } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
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

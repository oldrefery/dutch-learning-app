import React from 'react'
import { View, Text } from '@/components/Themed'
import { styles } from '../styles'

interface WordExample {
  nl: string
  en: string
  ru?: string
}

interface WordExamplesProps {
  examples: WordExample[]
}

export default function WordExamples({ examples }: WordExamplesProps) {
  if (!examples || examples.length === 0) {
    return (
      <View style={styles.section}>
        <Text style={styles.noExamplesText}>No examples available.</Text>
      </View>
    )
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Examples</Text>
      {examples.map((example, index) => (
        <View key={index} style={styles.exampleItem}>
          <Text style={styles.exampleDutch}>{example.nl}</Text>
          <Text style={styles.exampleEnglish}>{example.en}</Text>
          {example.ru && (
            <Text style={styles.exampleRussian}>{example.ru}</Text>
          )}
        </View>
      ))}
    </View>
  )
}

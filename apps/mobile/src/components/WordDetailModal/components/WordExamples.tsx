import React from 'react'
import { ViewThemed, TextThemed } from '@/components/Themed'
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
      <ViewThemed style={styles.section}>
        <TextThemed style={styles.noExamplesText}>
          No examples available.
        </TextThemed>
      </ViewThemed>
    )
  }

  return (
    <ViewThemed style={styles.section}>
      <TextThemed style={styles.sectionTitle}>Examples</TextThemed>
      {examples.map((example, index) => (
        <ViewThemed key={index} style={styles.exampleItem}>
          <TextThemed style={styles.exampleDutch}>{example.nl}</TextThemed>
          <TextThemed style={styles.exampleEnglish}>{example.en}</TextThemed>
          {example.ru && (
            <TextThemed style={styles.exampleRussian}>{example.ru}</TextThemed>
          )}
        </ViewThemed>
      ))}
    </ViewThemed>
  )
}

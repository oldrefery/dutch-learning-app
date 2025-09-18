import React from 'react'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { styles } from '../styles'
import type { WordSectionProps } from '../types'

export function ExamplesSection({ word, config }: WordSectionProps) {
  if (!config.showExamples || !word.examples || word.examples.length === 0) {
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
        <TextThemed style={styles.sectionIcon}>📝</TextThemed>
        Examples
      </TextThemed>

      {word.examples.map((example, index) => (
        <ViewThemed
          key={index}
          style={[
            styles.exampleCard,
            config.compact && styles.compactExampleCard,
          ]}
        >
          <TextThemed
            style={[
              styles.exampleDutch,
              config.compact && styles.compactExampleDutch,
            ]}
          >
            {example.nl}
          </TextThemed>

          <TextThemed
            style={[
              styles.exampleTranslation,
              config.compact && styles.compactExampleTranslation,
            ]}
          >
            🇬🇧 {example.en}
          </TextThemed>

          {example.ru && (
            <TextThemed
              style={[
                styles.exampleTranslation,
                config.compact && styles.compactExampleTranslation,
              ]}
            >
              🇷🇺 {example.ru}
            </TextThemed>
          )}
        </ViewThemed>
      ))}
    </ViewThemed>
  )
}

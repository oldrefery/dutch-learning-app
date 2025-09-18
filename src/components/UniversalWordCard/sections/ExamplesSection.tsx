import React from 'react'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { SelectableText } from '@/components/SelectableText'
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
          <SelectableText
            style={[
              styles.exampleDutch,
              config.compact && styles.compactExampleDutch,
            ]}
            copyText={example.nl}
          >
            {example.nl}
          </SelectableText>

          <SelectableText
            style={[
              styles.exampleTranslation,
              config.compact && styles.compactExampleTranslation,
            ]}
            copyText={example.en}
          >
            🇬🇧 {example.en}
          </SelectableText>

          {example.ru && (
            <SelectableText
              style={[
                styles.exampleTranslation,
                config.compact && styles.compactExampleTranslation,
              ]}
              copyText={example.ru}
            >
              🇷🇺 {example.ru}
            </SelectableText>
          )}
        </ViewThemed>
      ))}
    </ViewThemed>
  )
}

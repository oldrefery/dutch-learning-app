import React from 'react'
import { useColorScheme } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { SelectableText } from '@/components/SelectableText'
import { styles } from '../styles'
import { Colors } from '@/constants/Colors'
import type { WordSectionProps } from '../types'

export function ExamplesSection({ word, config }: WordSectionProps) {
  const colorScheme = useColorScheme() ?? 'light'
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
          lightColor={Colors.background.secondary}
          darkColor={Colors.dark.backgroundSecondary}
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
              {
                color:
                  colorScheme === 'dark'
                    ? Colors.dark.textSecondary
                    : Colors.text.secondary,
              },
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
                {
                  color:
                    colorScheme === 'dark'
                      ? Colors.dark.textSecondary
                      : Colors.text.secondary,
                },
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

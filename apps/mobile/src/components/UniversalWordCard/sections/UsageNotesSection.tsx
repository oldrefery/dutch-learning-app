import React from 'react'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { SelectableText } from '@/components/SelectableText'
import { Colors } from '@/constants/Colors'
import { styles } from '../styles'
import type { WordSectionProps } from '../types'

export function UsageNotesSection({ word, config }: WordSectionProps) {
  const usageNotes = word.usage_notes

  if (!config.showUsageNotes || !usageNotes) return null

  return (
    <ViewThemed
      testID="usage-nuance-section"
      style={[styles.section, config.compact && styles.compactSection]}
    >
      <ViewThemed style={styles.usageTitleRow}>
        <TextThemed
          style={[
            styles.sectionTitle,
            styles.usageTitle,
            config.compact && styles.compactSectionTitle,
          ]}
          accessibilityRole="header"
        >
          <TextThemed style={styles.sectionIcon}>💡</TextThemed>
          Usage &amp; Nuance
        </TextThemed>
        <TextThemed
          style={styles.aiGuidanceLabel}
          lightColor={Colors.neutral[600]}
          darkColor={Colors.dark.textSecondary}
        >
          AI-generated guidance
        </TextThemed>
      </ViewThemed>

      <SelectableText style={styles.usageSummary} copyText={usageNotes.summary}>
        {usageNotes.summary}
      </SelectableText>

      {usageNotes.contrasts.map(contrast => (
        <ViewThemed
          key={`${contrast.term}-${contrast.distinction}`}
          style={styles.usageContrastCard}
          lightColor={Colors.light.backgroundSecondary}
          darkColor={Colors.dark.backgroundSecondary}
        >
          <TextThemed style={styles.usageContrastTerm} selectable>
            {contrast.term}
          </TextThemed>
          <TextThemed style={styles.usageDistinction} selectable>
            {contrast.distinction}
          </TextThemed>

          {contrast.example && (
            <ViewThemed style={styles.usageExample}>
              <TextThemed style={styles.usageExampleDutch} selectable>
                {contrast.example.nl}
              </TextThemed>
              <TextThemed
                style={styles.usageExampleTranslation}
                lightColor={Colors.neutral[600]}
                darkColor={Colors.dark.textSecondary}
                selectable
              >
                🇬🇧 {contrast.example.en}
              </TextThemed>
              {contrast.example.ru && (
                <TextThemed
                  style={styles.usageExampleTranslation}
                  lightColor={Colors.neutral[600]}
                  darkColor={Colors.dark.textSecondary}
                  selectable
                >
                  🇷🇺 {contrast.example.ru}
                </TextThemed>
              )}
            </ViewThemed>
          )}
        </ViewThemed>
      ))}
    </ViewThemed>
  )
}

import React from 'react'
import { View } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { styles } from '../styles'
import type { WordSectionProps } from '../types'

export function ConjugationSection({ word, config }: WordSectionProps) {
  const conjugation = 'conjugation' in word ? word.conjugation : null
  if (!config.showConjugation || !conjugation) return null

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
        <TextThemed style={styles.sectionIcon}>🔄</TextThemed>
        Conjugation
      </TextThemed>

      <ViewThemed
        style={styles.conjugationTable}
        lightColor={Colors.light.backgroundSecondary}
        darkColor={Colors.dark.backgroundSecondary}
      >
        {conjugation.present && (
          <View style={styles.conjugationRow}>
            <TextThemed style={styles.conjugationLabel}>
              Present (ik):
            </TextThemed>
            <TextThemed style={styles.conjugationValue}>
              {conjugation.present}
            </TextThemed>
          </View>
        )}

        {conjugation.simple_past && (
          <View style={styles.conjugationRow}>
            <TextThemed style={styles.conjugationLabel}>Past (ik):</TextThemed>
            <TextThemed style={styles.conjugationValue}>
              {conjugation.simple_past}
            </TextThemed>
          </View>
        )}

        {conjugation.simple_past_plural && (
          <View style={styles.conjugationRow}>
            <TextThemed style={styles.conjugationLabel}>
              Past (plural):
            </TextThemed>
            <TextThemed style={styles.conjugationValue}>
              {conjugation.simple_past_plural}
            </TextThemed>
          </View>
        )}

        {conjugation.past_participle && (
          <View style={styles.conjugationRow}>
            <TextThemed style={styles.conjugationLabel}>
              Past Participle:
            </TextThemed>
            <TextThemed style={styles.conjugationValue}>
              {conjugation.past_participle}
            </TextThemed>
          </View>
        )}
      </ViewThemed>
    </ViewThemed>
  )
}

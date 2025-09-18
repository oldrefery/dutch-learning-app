import React from 'react'
import { TextThemed, ViewThemed } from '@/components/Themed'
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

      <ViewThemed style={styles.conjugationTable}>
        {conjugation.present && (
          <ViewThemed style={styles.conjugationRow}>
            <TextThemed style={styles.conjugationLabel}>
              Present (ik):
            </TextThemed>
            <TextThemed style={styles.conjugationValue}>
              {conjugation.present}
            </TextThemed>
          </ViewThemed>
        )}

        {conjugation.simple_past && (
          <ViewThemed style={styles.conjugationRow}>
            <TextThemed style={styles.conjugationLabel}>Past (ik):</TextThemed>
            <TextThemed style={styles.conjugationValue}>
              {conjugation.simple_past}
            </TextThemed>
          </ViewThemed>
        )}

        {conjugation.past_participle && (
          <ViewThemed style={styles.conjugationRow}>
            <TextThemed style={styles.conjugationLabel}>
              Past Participle:
            </TextThemed>
            <TextThemed style={styles.conjugationValue}>
              {conjugation.past_participle}
            </TextThemed>
          </ViewThemed>
        )}
      </ViewThemed>
    </ViewThemed>
  )
}

import React from 'react'
import { StyleSheet } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'

interface CollectionStatsProps {
  stats: {
    totalWords: number
    masteredWords: number
    wordsForReview: number
    newWords: number
  }
}

export default function CollectionStats({ stats }: CollectionStatsProps) {
  return (
    <ViewThemed style={styles.statsCard}>
      <TextThemed style={styles.statsTitle}>Collection Statistics</TextThemed>
      <ViewThemed style={styles.statsGrid}>
        <ViewThemed style={styles.statItem}>
          <TextThemed style={styles.statNumber}>{stats.totalWords}</TextThemed>
          <TextThemed style={styles.statLabel}>Total Words</TextThemed>
        </ViewThemed>
        <ViewThemed style={styles.statItem}>
          <TextThemed style={styles.statNumber}>
            {stats.masteredWords}
          </TextThemed>
          <TextThemed style={styles.statLabel}>Mastered</TextThemed>
        </ViewThemed>
        <ViewThemed style={styles.statItem}>
          <TextThemed style={styles.statNumber}>
            {stats.wordsForReview}
          </TextThemed>
          <TextThemed style={styles.statLabel}>For Review</TextThemed>
        </ViewThemed>
        <ViewThemed style={styles.statItem}>
          <TextThemed style={styles.statNumber}>{stats.newWords}</TextThemed>
          <TextThemed style={styles.statLabel}>New</TextThemed>
        </ViewThemed>
      </ViewThemed>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  statsCard: {
    backgroundColor: Colors.background.primary,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.neutral[900],
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.neutral[900],
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.neutral[500],
  },
})

import React from 'react'
import { StyleSheet } from 'react-native'
import { Text, View } from '@/components/Themed'
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
    <View style={styles.statsCard}>
      <Text style={styles.statsTitle}>Collection Statistics</Text>
      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.totalWords}</Text>
          <Text style={styles.statLabel}>Total Words</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.masteredWords}</Text>
          <Text style={styles.statLabel}>Mastered</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.wordsForReview}</Text>
          <Text style={styles.statLabel}>For Review</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.newWords}</Text>
          <Text style={styles.statLabel}>New</Text>
        </View>
      </View>
    </View>
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

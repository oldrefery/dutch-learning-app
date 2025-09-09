import React from 'react'
import { StyleSheet } from 'react-native'
import { Text, View } from '@/components/Themed'
import { Colors } from '@/constants/Colors'

interface StatsCardProps {
  stats: {
    totalWords: number
    masteredWords: number
    wordsForReview: number
    streakDays: number
  }
}

export default function StatsCard({ stats }: StatsCardProps) {
  return (
    <View style={styles.statsCard}>
      <Text style={styles.statsTitle}>Today&apos;s Progress</Text>
      <Text style={styles.statsSubtitle}>Across all collections</Text>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.totalWords}</Text>
          <Text style={styles.statLabel}>Total Words</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.masteredWords}</Text>
          <Text style={styles.statLabel}>Mastered</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.wordsForReview}</Text>
          <Text style={styles.statLabel}>For Review</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{stats.streakDays}</Text>
          <Text style={styles.statLabel}>Day Streak</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  statsCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  statsSubtitle: {
    fontSize: 14,
    color: Colors.neutral[500],
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
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

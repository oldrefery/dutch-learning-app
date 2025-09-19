import React from 'react'
import { StyleSheet } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { SkeletonNumber } from '@/components/SkeletonLoader'

interface StatsCardProps {
  stats: {
    totalWords: number
    masteredWords: number
    wordsForReview: number
    streakDays: number
  }
  loading?: boolean
}

export default function StatsCard({ stats, loading = false }: StatsCardProps) {
  return (
    <ViewThemed
      style={styles.statsCard}
      lightColor={Colors.background.secondary}
      darkColor={Colors.dark.backgroundSecondary}
    >
      <TextThemed style={styles.statsTitle}>Today&apos;s Progress</TextThemed>
      <TextThemed
        style={styles.statsSubtitle}
        lightColor={Colors.neutral[500]}
        darkColor={Colors.dark.textSecondary}
      >
        Across all collections
      </TextThemed>
      <ViewThemed style={styles.statsRow}>
        <ViewThemed style={styles.statItem}>
          {loading ? (
            <SkeletonNumber width={48} height={32} style={styles.statNumber} />
          ) : (
            <TextThemed style={styles.statNumber}>
              {stats.totalWords}
            </TextThemed>
          )}
          <TextThemed
            style={styles.statLabel}
            lightColor={Colors.neutral[500]}
            darkColor={Colors.dark.textSecondary}
          >
            Total Words
          </TextThemed>
        </ViewThemed>
        <ViewThemed style={styles.statItem}>
          {loading ? (
            <SkeletonNumber
              width={42}
              height={32}
              delay={150}
              style={styles.statNumber}
            />
          ) : (
            <TextThemed style={styles.statNumber}>
              {stats.masteredWords}
            </TextThemed>
          )}
          <TextThemed
            style={styles.statLabel}
            lightColor={Colors.neutral[500]}
            darkColor={Colors.dark.textSecondary}
          >
            Mastered
          </TextThemed>
        </ViewThemed>
      </ViewThemed>
      <ViewThemed style={styles.statsRow}>
        <ViewThemed style={styles.statItem}>
          {loading ? (
            <SkeletonNumber
              width={36}
              height={32}
              delay={300}
              style={styles.statNumber}
            />
          ) : (
            <TextThemed style={styles.statNumber}>
              {stats.wordsForReview}
            </TextThemed>
          )}
          <TextThemed
            style={styles.statLabel}
            lightColor={Colors.neutral[500]}
            darkColor={Colors.dark.textSecondary}
          >
            For Review
          </TextThemed>
        </ViewThemed>
        <ViewThemed style={styles.statItem}>
          {loading ? (
            <SkeletonNumber
              width={28}
              height={32}
              delay={450}
              style={styles.statNumber}
            />
          ) : (
            <TextThemed style={styles.statNumber}>
              {stats.streakDays}
            </TextThemed>
          )}
          <TextThemed
            style={styles.statLabel}
            lightColor={Colors.neutral[500]}
            darkColor={Colors.dark.textSecondary}
          >
            Day Streak
          </TextThemed>
        </ViewThemed>
      </ViewThemed>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  statsCard: {
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
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
  },
})

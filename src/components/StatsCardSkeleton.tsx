import React from 'react'
import { StyleSheet } from 'react-native'
import { ViewThemed } from '@/components/Themed'
import { SkeletonNumber, SkeletonText } from '@/components/SkeletonLoader'
import { Colors } from '@/constants/Colors'

/**
 * StatsCardSkeleton - Loading skeleton for the StatsCard component
 *
 * Displays animated placeholders while statistics data is being fetched from a server.
 * Maintains the same layout structure as StatsCard to prevent layout shifts.
 */
export default function StatsCardSkeleton() {
  return (
    <ViewThemed style={styles.statsCard}>
      {/* Title skeleton */}
      <SkeletonText width={140} height={22} style={styles.titleSkeleton} />

      {/* Subtitle skeleton */}
      <SkeletonText
        width={120}
        height={16}
        delay={100}
        style={styles.subtitleSkeleton}
      />

      {/* First row of stats */}
      <ViewThemed style={styles.statsRow}>
        <ViewThemed style={styles.statItem}>
          <SkeletonNumber
            width={48}
            height={32}
            delay={200}
            style={styles.numberSkeleton}
          />
          <SkeletonText
            width={70}
            height={14}
            delay={300}
            style={styles.labelSkeleton}
          />
        </ViewThemed>
        <ViewThemed style={styles.statItem}>
          <SkeletonNumber
            width={42}
            height={32}
            delay={250}
            style={styles.numberSkeleton}
          />
          <SkeletonText
            width={60}
            height={14}
            delay={350}
            style={styles.labelSkeleton}
          />
        </ViewThemed>
      </ViewThemed>

      {/* Second row of stats */}
      <ViewThemed style={styles.statsRow}>
        <ViewThemed style={styles.statItem}>
          <SkeletonNumber
            width={36}
            height={32}
            delay={300}
            style={styles.numberSkeleton}
          />
          <SkeletonText
            width={64}
            height={14}
            delay={400}
            style={styles.labelSkeleton}
          />
        </ViewThemed>
        <ViewThemed style={styles.statItem}>
          <SkeletonNumber
            width={28}
            height={32}
            delay={350}
            style={styles.numberSkeleton}
          />
          <SkeletonText
            width={66}
            height={14}
            delay={450}
            style={styles.labelSkeleton}
          />
        </ViewThemed>
      </ViewThemed>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  statsCard: {
    backgroundColor: Colors.background.secondary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  titleSkeleton: {
    marginBottom: 4,
  },
  subtitleSkeleton: {
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
  numberSkeleton: {
    marginBottom: 4,
  },
  labelSkeleton: {
    // Label skeleton styles
  },
})

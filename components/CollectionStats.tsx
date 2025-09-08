import React from 'react'
import { StyleSheet, Animated } from 'react-native'
import { Text, View } from '@/components/Themed'

interface CollectionStatsProps {
  stats: {
    totalWords: number
    masteredWords: number
    wordsForReview: number
    newWords: number
  }
  scrollY: Animated.Value
}

export default function CollectionStats({
  stats,
  scrollY,
}: CollectionStatsProps) {
  const statsOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  })

  const statsTranslateY = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, -100],
    extrapolate: 'clamp',
  })

  const statsHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [280, 0], // Full height to 0
    extrapolate: 'clamp',
  })

  return (
    <Animated.View
      style={[
        styles.statsCard,
        {
          opacity: statsOpacity,
          transform: [{ translateY: statsTranslateY }],
          height: statsHeight,
          overflow: 'hidden',
        },
      ]}
    >
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
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  statsCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    zIndex: 10,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
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
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
})

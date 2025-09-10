import React from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  SharedValue,
} from 'react-native-reanimated'
import { Text, View } from '@/components/Themed'
import { Colors } from '@/constants/Colors'

interface CollectionStatsProps {
  stats: {
    totalWords: number
    masteredWords: number
    wordsForReview: number
    newWords: number
  }
  scrollY: SharedValue<number>
}

export default function CollectionStats({
  stats,
  scrollY,
}: CollectionStatsProps) {
  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, 100],
      [1, 0],
      Extrapolation.CLAMP
    )

    const translateY = interpolate(
      scrollY.value,
      [0, 100],
      [0, -50],
      Extrapolation.CLAMP
    )

    const height = interpolate(
      scrollY.value,
      [0, 100],
      [200, 0],
      Extrapolation.CLAMP
    )

    const marginBottom = interpolate(
      scrollY.value,
      [0, 100],
      [16, 0],
      Extrapolation.CLAMP
    )

    return {
      opacity,
      transform: [{ translateY }],
      height,
      marginBottom,
      overflow: 'hidden',
    }
  })

  return (
    <Animated.View style={[styles.statsCard, animatedStyle]}>
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

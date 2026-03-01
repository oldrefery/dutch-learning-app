import React from 'react'
import { StyleSheet, useColorScheme } from 'react-native'
import { PlatformBlurView } from '@/components/PlatformBlurView'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { SkeletonNumber } from '@/components/SkeletonLoader'
import ReviewButton from '@/components/ReviewButton'

interface StatsCardProps {
  stats: {
    totalWords: number
    masteredWords: number
    wordsForReview: number
    streakDays: number
  }
  loading?: boolean
  onStartReview?: () => void
}

export const StatsCard = ({
  stats,
  loading = false,
  onStartReview,
}: StatsCardProps) => {
  const colorScheme = useColorScheme() ?? 'light'
  const isDarkMode = colorScheme === 'dark'

  const blurBackgroundDark = Colors.transparent.iosDarkSurface95
  const blurBackgroundLight = Colors.transparent.white95
  const separatorDark = Colors.transparent.white10
  const separatorLight = Colors.transparent.black05

  return (
    <ViewThemed style={styles.statsCardContainer}>
      <PlatformBlurView
        style={styles.statsBlur}
        intensity={100}
        tint={colorScheme === 'dark' ? 'dark' : 'light'}
        blurMethod={'dimezisBlurView'}
      >
        <ViewThemed
          style={[
            styles.statsCard,
            {
              backgroundColor: isDarkMode
                ? blurBackgroundDark
                : blurBackgroundLight,
              borderColor: isDarkMode ? separatorDark : separatorLight,
            },
          ]}
        >
          <TextThemed style={styles.statsTitle}>
            Today&apos;s Progress
          </TextThemed>
          <TextThemed
            style={styles.statsSubtitle}
            lightColor={Colors.neutral[500]}
            darkColor={Colors.dark.textSecondary}
          >
            Across all collections
          </TextThemed>
          <ViewThemed
            style={styles.statsRow}
            lightColor={Colors.transparent.clear}
            darkColor={Colors.transparent.clear}
          >
            <ViewThemed
              style={styles.statItem}
              lightColor={Colors.transparent.clear}
              darkColor={Colors.transparent.clear}
            >
              {loading ? (
                <SkeletonNumber
                  width={48}
                  height={32}
                  style={styles.statNumber}
                />
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
            <ViewThemed
              style={styles.statItem}
              lightColor={Colors.transparent.clear}
              darkColor={Colors.transparent.clear}
            >
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
          <ViewThemed
            style={styles.statsRow}
            lightColor={Colors.transparent.clear}
            darkColor={Colors.transparent.clear}
          >
            <ViewThemed
              style={styles.statItem}
              lightColor={Colors.transparent.clear}
              darkColor={Colors.transparent.clear}
            >
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
            <ViewThemed
              style={styles.statItem}
              lightColor={Colors.transparent.clear}
              darkColor={Colors.transparent.clear}
            >
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

          {onStartReview && (
            <ViewThemed
              style={styles.reviewButtonContainer}
              lightColor={Colors.transparent.clear}
              darkColor={Colors.transparent.clear}
            >
              <ReviewButton
                wordsForReview={stats.wordsForReview}
                onPress={onStartReview}
              />
            </ViewThemed>
          )}
        </ViewThemed>
      </PlatformBlurView>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  statsCardContainer: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.legacy.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    backgroundColor: Colors.transparent.clear,
  },
  statsBlur: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  statsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  statsSubtitle: {
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
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
  reviewButtonContainer: {
    marginTop: 8,
  },
})

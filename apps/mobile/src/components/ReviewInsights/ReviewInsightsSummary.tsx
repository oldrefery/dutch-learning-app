import React from 'react'
import { Pressable, View } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { MASTERED_MIN_REPETITIONS } from '@/constants/ReviewConstants'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import type { ReviewInsights } from '@/utils/reviewInsights'
import { DistributionSection, ForecastBars } from './ReviewInsightBars'
import { reviewInsightsStyles as styles } from './ReviewInsights.styles'

interface ReviewInsightsSummaryProps {
  insights: ReviewInsights
  isStartingReview: boolean
  onStartDifficultReview: () => void | Promise<void>
  staleMessage?: string | null
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <ViewThemed style={styles.metric}>
      <TextThemed style={styles.metricValue}>{value}</TextThemed>
      <TextThemed
        style={styles.metricLabel}
        lightColor={Colors.neutral[600]}
        darkColor={Colors.dark.textSecondary}
      >
        {label}
      </TextThemed>
    </ViewThemed>
  )
}

export function ReviewInsightsEmptyState({
  onRefresh,
  errorMessage,
}: {
  onRefresh: () => void | Promise<void>
  errorMessage?: string | null
}) {
  const colorScheme = useNormalizedColorScheme()

  return (
    <ViewThemed
      style={styles.emptyState}
      testID="review-insights-empty-state"
      accessibilityRole={errorMessage ? 'alert' : undefined}
      accessibilityLiveRegion={errorMessage ? 'assertive' : undefined}
    >
      <TextThemed style={styles.emptyTitle}>
        {errorMessage ? 'Could not load insights' : 'No words to analyze yet'}
      </TextThemed>
      <TextThemed
        style={styles.emptyCopy}
        lightColor={Colors.neutral[600]}
        darkColor={Colors.dark.textSecondary}
      >
        {errorMessage ??
          'Add words to a collection or refresh your local library to see a review forecast.'}
      </TextThemed>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Refresh review insights"
        onPress={() => void onRefresh()}
        style={({ pressed }) => [
          styles.secondaryButton,
          {
            borderColor: Colors[colorScheme].border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <TextThemed style={styles.secondaryButtonText}>Refresh</TextThemed>
      </Pressable>
    </ViewThemed>
  )
}

export function ReviewInsightsSummary({
  insights,
  isStartingReview,
  onStartDifficultReview,
  staleMessage,
}: ReviewInsightsSummaryProps) {
  const colorScheme = useNormalizedColorScheme()
  const theme = Colors[colorScheme]
  const dueDifficultCount = insights.dueDifficultWords.length
  const reviewDisabled = dueDifficultCount === 0 || isStartingReview

  return (
    <View style={styles.summary}>
      <View>
        <TextThemed style={styles.title}>Your Scheduling Snapshot</TextThemed>
        <TextThemed
          style={styles.subtitle}
          lightColor={Colors.neutral[600]}
          darkColor={Colors.dark.textSecondary}
        >
          Current SRS state only. No retention history is inferred.
        </TextThemed>
      </View>

      {staleMessage && (
        <ViewThemed
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[
            styles.staleBanner,
            {
              backgroundColor:
                colorScheme === 'dark'
                  ? Colors.warning.darkTheme
                  : Colors.warning.light,
            },
          ]}
        >
          <TextThemed style={styles.staleTitle}>Showing cached data</TextThemed>
          <TextThemed style={styles.staleCopy}>{staleMessage}</TextThemed>
        </ViewThemed>
      )}

      <View style={styles.metricGrid}>
        <Metric label="Due Today" value={insights.forecast.today} />
        <Metric label="Overdue" value={insights.forecast.overdue} />
        <Metric label="Difficult" value={insights.difficultWords.length} />
        <Metric label="Mastered" value={insights.masteredWords.length} />
      </View>

      <TextThemed
        style={styles.definition}
        lightColor={Colors.neutral[600]}
        darkColor={Colors.dark.textSecondary}
      >
        Difficult means easiness factor ≤ 2.10. Mastered means at least{' '}
        {MASTERED_MIN_REPETITIONS} successful repetitions.
      </TextThemed>

      <ForecastBars forecast={insights.forecast} />
      <DistributionSection
        title="Current Intervals"
        buckets={insights.intervalDistribution}
      />
      <DistributionSection
        title="Current Easiness Factors"
        buckets={insights.easinessDistribution}
      />

      <ViewThemed style={styles.section}>
        <TextThemed style={styles.sectionTitle}>Difficult Words</TextThemed>
        <TextThemed
          style={styles.sectionSubtitle}
          lightColor={Colors.neutral[600]}
          darkColor={Colors.dark.textSecondary}
        >
          Browse any difficult word without changing its schedule. Review only
          starts words that are due now.
        </TextThemed>
        <Pressable
          testID="review-due-difficult-words"
          accessibilityRole="button"
          accessibilityLabel={`Review ${dueDifficultCount} due difficult words`}
          accessibilityHint="Starts a review session containing only difficult words that are due"
          accessibilityState={{ disabled: reviewDisabled }}
          disabled={reviewDisabled}
          onPress={() => void onStartDifficultReview()}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor: theme.tint,
              opacity: reviewDisabled ? 0.45 : pressed ? 0.75 : 1,
            },
          ]}
        >
          <TextThemed style={styles.primaryButtonText}>
            {isStartingReview
              ? 'Starting…'
              : `Review Due Difficult Words (${dueDifficultCount})`}
          </TextThemed>
        </Pressable>
        {insights.difficultWords.length === 0 && (
          <TextThemed
            style={styles.noDifficultWords}
            lightColor={Colors.neutral[600]}
            darkColor={Colors.dark.textSecondary}
          >
            No difficult words under the current heuristic.
          </TextThemed>
        )}
      </ViewThemed>
    </View>
  )
}

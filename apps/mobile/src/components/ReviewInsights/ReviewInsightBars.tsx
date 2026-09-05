import React from 'react'
import { View } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import type { DistributionBucket, ReviewForecast } from '@/utils/reviewInsights'
import { reviewInsightsStyles as styles } from './ReviewInsights.styles'

const formatForecastDate = (dateKey: string): string => {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day, 12).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function ForecastBars({ forecast }: { forecast: ReviewForecast }) {
  const colorScheme = useNormalizedColorScheme()
  const theme = Colors[colorScheme]
  const maxCount = Math.max(1, ...forecast.nextSevenDays.map(day => day.count))
  const summary = forecast.nextSevenDays
    .map(day => `${formatForecastDate(day.dateKey)}: ${day.count}`)
    .join(', ')

  return (
    <ViewThemed style={styles.section}>
      <TextThemed style={styles.sectionTitle}>Next 7 Days</TextThemed>
      <TextThemed
        testID="forecast-accessible-summary"
        accessibilityLabel={`Review forecast. ${summary}`}
        style={styles.sectionSubtitle}
        lightColor={Colors.neutral[600]}
        darkColor={Colors.dark.textSecondary}
      >
        {summary}
      </TextThemed>
      <View style={styles.bars}>
        {forecast.nextSevenDays.map(day => (
          <View
            key={day.dateKey}
            accessible
            accessibilityLabel={`${formatForecastDate(day.dateKey)}, ${day.count} words due`}
            style={styles.barRow}
          >
            <TextThemed style={styles.barLabel}>
              {formatForecastDate(day.dateKey)}
            </TextThemed>
            <View
              style={[
                styles.barTrack,
                { backgroundColor: theme.backgroundTertiary },
              ]}
              importantForAccessibility="no"
            >
              <View
                style={[
                  styles.barFill,
                  {
                    backgroundColor: theme.tint,
                    width: `${(day.count / maxCount) * 100}%`,
                  },
                ]}
              />
            </View>
            <TextThemed style={styles.barCount}>{day.count}</TextThemed>
          </View>
        ))}
      </View>
      <View style={styles.forecastFootnote}>
        <TextThemed
          style={styles.footnote}
          lightColor={Colors.neutral[600]}
          darkColor={Colors.dark.textSecondary}
        >
          Later: {forecast.later}
        </TextThemed>
        {forecast.unscheduled > 0 && (
          <TextThemed
            style={styles.footnote}
            lightColor={Colors.neutral[600]}
            darkColor={Colors.dark.textSecondary}
          >
            Unscheduled: {forecast.unscheduled}
          </TextThemed>
        )}
      </View>
    </ViewThemed>
  )
}

export function DistributionSection({
  title,
  buckets,
}: {
  title: string
  buckets: DistributionBucket[]
}) {
  const colorScheme = useNormalizedColorScheme()
  const theme = Colors[colorScheme]
  const maxCount = Math.max(1, ...buckets.map(bucket => bucket.count))

  return (
    <ViewThemed style={styles.section}>
      <TextThemed style={styles.sectionTitle}>{title}</TextThemed>
      <View style={styles.bars}>
        {buckets.map(bucket => (
          <View
            key={bucket.id}
            accessible
            accessibilityLabel={`${bucket.label}, ${bucket.count} words`}
            style={styles.barRow}
          >
            <TextThemed style={styles.distributionLabel}>
              {bucket.label}
            </TextThemed>
            <View
              style={[
                styles.barTrack,
                { backgroundColor: theme.backgroundTertiary },
              ]}
              importantForAccessibility="no"
            >
              <View
                style={[
                  styles.barFill,
                  {
                    backgroundColor: theme.tint,
                    width: `${(bucket.count / maxCount) * 100}%`,
                  },
                ]}
              />
            </View>
            <TextThemed style={styles.barCount}>{bucket.count}</TextThemed>
          </View>
        ))}
      </View>
    </ViewThemed>
  )
}

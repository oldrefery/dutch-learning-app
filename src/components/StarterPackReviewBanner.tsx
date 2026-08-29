import React from 'react'
import { StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import type { StarterPackManifest } from '@/types/StarterPackTypes'

interface StarterPackReviewBannerProps {
  manifest: StarterPackManifest
  importEnabled: boolean
}

export function StarterPackReviewBanner({
  manifest,
  importEnabled,
}: StarterPackReviewBannerProps) {
  const colorScheme = useNormalizedColorScheme()
  const isApproved = manifest.content_review.status === 'approved'
  const accentColor = isApproved
    ? colorScheme === 'dark'
      ? Colors.success.dark
      : Colors.success.DEFAULT
    : colorScheme === 'dark'
      ? Colors.warning.dark
      : Colors.warning.DEFAULT
  const backgroundColor = isApproved
    ? colorScheme === 'dark'
      ? Colors.success.darkModeChip
      : Colors.success.light
    : colorScheme === 'dark'
      ? Colors.warning.darkModeBadge
      : Colors.warning.light

  return (
    <ViewThemed
      testID="starter-pack-review-banner"
      style={[styles.container, { backgroundColor, borderColor: accentColor }]}
    >
      <Ionicons
        name={isApproved ? 'shield-checkmark-outline' : 'construct-outline'}
        size={22}
        color={accentColor}
      />
      <ViewThemed
        style={styles.content}
        lightColor="transparent"
        darkColor="transparent"
      >
        <TextThemed style={[styles.title, { color: accentColor }]}>
          {isApproved
            ? 'Human language review complete'
            : 'Development preview'}
        </TextThemed>
        <TextThemed style={styles.message}>
          {isApproved
            ? `Reviewed by ${manifest.content_review.reviewed_by}.`
            : importEnabled
              ? 'The content is awaiting human Dutch review. Import is enabled only for development QA.'
              : 'The content is awaiting human Dutch review. Production import is disabled.'}
        </TextThemed>
      </ViewThemed>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
})

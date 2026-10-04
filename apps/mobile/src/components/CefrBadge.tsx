import React from 'react'
import { StyleSheet } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import type { CefrAssessmentStatus, CefrLevel } from '@woordenaar/domain'

interface CefrBadgeProps {
  level?: CefrLevel | null
  status?: CefrAssessmentStatus
  compact?: boolean
}

interface CefrBadgePalette {
  background: string
  border: string
  text: string
}

const getLabel = (
  level: CefrLevel | null,
  status: CefrAssessmentStatus,
  compact: boolean
) => {
  if (level === null) return compact ? 'CEFR —' : 'CEFR level unknown'
  const estimated = status === 'estimated'
  if (compact) return `${level}${estimated ? ' ~' : ''}`
  return `CEFR ${level}${estimated ? ' · estimated' : ''}`
}

const getPalette = (
  status: CefrAssessmentStatus,
  isDark: boolean
): CefrBadgePalette => {
  const palettes: Record<CefrAssessmentStatus, CefrBadgePalette> = {
    reviewed: {
      background: isDark ? Colors.success.darkModeChip : Colors.success.light,
      border: isDark ? Colors.success.dark : Colors.success.border,
      text: isDark ? Colors.success.darkModeChipText : Colors.success.DEFAULT,
    },
    estimated: {
      background: isDark ? Colors.warning.darkModeBadge : Colors.warning.light,
      border: isDark ? Colors.warning.dark : Colors.warning.DEFAULT,
      text: isDark
        ? Colors.warning.darkModeBadgeText
        : Colors.warning.darkTheme,
    },
    unknown: {
      background: isDark ? Colors.transparent.white08 : Colors.neutral[100],
      border: isDark ? Colors.neutral[600] : Colors.neutral[300],
      text: isDark ? Colors.dark.textSecondary : Colors.neutral[600],
    },
  }
  return palettes[status]
}

export function CefrBadge({
  level = null,
  status = 'unknown',
  compact = false,
}: CefrBadgeProps) {
  const colorScheme = useNormalizedColorScheme()
  const isDark = colorScheme === 'dark'
  const resolvedStatus = level === null ? 'unknown' : status
  const label = getLabel(level, resolvedStatus, compact)
  const palette = getPalette(resolvedStatus, isDark)

  return (
    <ViewThemed
      style={[
        styles.badge,
        compact && styles.compactBadge,
        { backgroundColor: palette.background, borderColor: palette.border },
      ]}
      accessible
      accessibilityLabel={label.replace(' ~', ', estimated')}
    >
      <TextThemed
        style={[
          styles.text,
          compact && styles.compactText,
          { color: palette.text },
        ]}
      >
        {label}
      </TextThemed>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  compactBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
  compactText: {
    fontSize: 11,
  },
})

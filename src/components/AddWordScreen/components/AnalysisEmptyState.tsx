import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'

const TIPS = [
  { icon: 'language-outline' as const, text: 'Type any Dutch word or phrase' },
  {
    icon: 'book-outline' as const,
    text: 'Get translations, examples & conjugations',
  },
  { icon: 'mic-outline' as const, text: 'Listen to native pronunciation' },
  { icon: 'images-outline' as const, text: 'Associate words with images' },
]

export function AnalysisEmptyState() {
  const colorScheme = useNormalizedColorScheme()
  const iconColor =
    colorScheme === 'dark' ? Colors.primary.darkMode : Colors.primary.DEFAULT

  return (
    <ViewThemed style={styles.container}>
      <Ionicons
        name="sparkles-outline"
        size={48}
        color={iconColor}
        style={styles.icon}
      />
      <TextThemed
        style={styles.title}
        lightColor={Colors.neutral[700]}
        darkColor={Colors.dark.text}
      >
        Analyze any Dutch word
      </TextThemed>
      <TextThemed
        style={styles.subtitle}
        lightColor={Colors.neutral[500]}
        darkColor={Colors.dark.textSecondary}
      >
        AI-powered analysis in seconds
      </TextThemed>

      <View style={styles.tipsContainer}>
        {TIPS.map(tip => (
          <View key={tip.icon} style={styles.tipRow}>
            <Ionicons
              name={tip.icon}
              size={18}
              color={iconColor}
              style={styles.tipIcon}
            />
            <TextThemed
              style={styles.tipText}
              lightColor={Colors.neutral[600]}
              darkColor={Colors.dark.textSecondary}
            >
              {tip.text}
            </TextThemed>
          </View>
        ))}
      </View>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  icon: {
    marginBottom: 16,
    opacity: 0.8,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 32,
    textAlign: 'center',
  },
  tipsContainer: {
    alignSelf: 'stretch',
    gap: 16,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  tipIcon: {
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  tipText: {
    fontSize: 15,
    flex: 1,
  },
})

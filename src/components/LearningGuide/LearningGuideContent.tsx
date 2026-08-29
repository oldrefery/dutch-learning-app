import React from 'react'
import { Pressable, ScrollView, StyleSheet, View } from 'react-native'
import { TextThemed, ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import {
  LEARNING_GUIDE_SECTIONS,
  type LearningGuideActionRoute,
} from './content'

interface LearningGuideContentProps {
  onComplete: () => void
  onNavigate: (route: LearningGuideActionRoute) => void
}

export function LearningGuideContent({
  onComplete,
  onNavigate,
}: LearningGuideContentProps) {
  const colorScheme = useNormalizedColorScheme()
  const theme = Colors[colorScheme]

  return (
    <ViewThemed style={styles.screen} testID="screen-learning-guide">
      <ScrollView
        testID="learning-guide-scroll-view"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
      >
        <TextThemed accessibilityRole="header" style={styles.heroTitle}>
          How Learning Works
        </TextThemed>
        <TextThemed
          style={styles.heroDescription}
          lightColor={Colors.neutral[600]}
          darkColor={Colors.dark.textSecondary}
        >
          A practical guide to building vocabulary and choosing the right kind
          of review.
        </TextThemed>

        <View style={styles.sections}>
          {LEARNING_GUIDE_SECTIONS.map((section, index) => (
            <View
              key={section.id}
              testID={`learning-guide-section-${section.id}`}
              style={[
                styles.section,
                {
                  backgroundColor: theme.backgroundSecondary,
                  borderColor: theme.border,
                },
              ]}
            >
              <TextThemed
                accessibilityRole="header"
                accessibilityLabel={`Section ${index + 1} of ${LEARNING_GUIDE_SECTIONS.length}: ${section.title}`}
                style={styles.sectionTitle}
              >
                {index + 1}. {section.title}
              </TextThemed>
              <TextThemed
                style={styles.sectionDescription}
                lightColor={Colors.neutral[600]}
                darkColor={Colors.dark.textSecondary}
              >
                {section.description}
              </TextThemed>
              <View style={styles.bullets}>
                {section.bullets.map(bullet => (
                  <View key={bullet} style={styles.bulletRow}>
                    <TextThemed
                      accessible={false}
                      importantForAccessibility="no"
                      style={[styles.bulletMark, { color: theme.tint }]}
                    >
                      •
                    </TextThemed>
                    <TextThemed
                      style={styles.bulletText}
                      lightColor={Colors.neutral[600]}
                      darkColor={Colors.dark.textSecondary}
                    >
                      {bullet}
                    </TextThemed>
                  </View>
                ))}
              </View>
              {section.action && (
                <Pressable
                  testID={`learning-guide-action-${section.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={section.action.label}
                  accessibilityHint={section.action.accessibilityHint}
                  onPress={() => {
                    if (section.action) onNavigate(section.action.route)
                  }}
                  style={({ pressed }) => [
                    styles.sectionAction,
                    {
                      borderColor: theme.border,
                      opacity: pressed ? 0.65 : 1,
                    },
                  ]}
                >
                  <TextThemed
                    style={[styles.sectionActionText, { color: theme.tint }]}
                  >
                    {section.action.label}
                  </TextThemed>
                </Pressable>
              )}
            </View>
          ))}
        </View>

        <Pressable
          testID="complete-learning-guide-button"
          accessibilityRole="button"
          accessibilityLabel="Finish Learning Guide"
          accessibilityHint="Marks this guide version as seen and returns to the previous screen"
          onPress={onComplete}
          style={({ pressed }) => [
            styles.completeButton,
            {
              backgroundColor: theme.tint,
              opacity: pressed ? 0.75 : 1,
            },
          ]}
        >
          <TextThemed style={styles.completeButtonText}>Done</TextThemed>
        </Pressable>
      </ScrollView>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  heroTitle: {
    fontSize: 30,
    fontWeight: '800',
    lineHeight: 38,
  },
  heroDescription: {
    fontSize: 17,
    lineHeight: 25,
    marginTop: 8,
  },
  sections: {
    gap: 16,
    marginTop: 24,
  },
  section: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
  },
  sectionDescription: {
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
  },
  bullets: {
    gap: 8,
    marginTop: 12,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  bulletMark: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 23,
  },
  sectionAction: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sectionActionText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  completeButton: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingHorizontal: 16,
  },
  completeButtonText: {
    color: Colors.legacy.white,
    fontSize: 17,
    fontWeight: '700',
  },
})

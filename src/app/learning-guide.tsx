import React, { useEffect } from 'react'
import { ActivityIndicator, StyleSheet } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import {
  LearningGuideContent,
  LEARNING_GUIDE_VERSION,
  type LearningGuideActionRoute,
} from '@/components/LearningGuide'
import { ViewThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { ROUTES } from '@/constants/Routes'
import { useSettingsStore } from '@/stores/useSettingsStore'

export default function LearningGuideScreen() {
  const router = useRouter()
  const { resetForE2E } = useLocalSearchParams<{ resetForE2E?: string }>()
  const markLearningGuideVersionSeen = useSettingsStore(
    state => state.markLearningGuideVersionSeen
  )
  const resetLearningGuideVersionSeenForTesting = useSettingsStore(
    state => state.resetLearningGuideVersionSeenForTesting
  )
  const isE2EReset =
    process.env.EXPO_PUBLIC_E2E_TEST_MODE === 'true' && resetForE2E === '1'

  useEffect(() => {
    if (!isE2EReset) return

    resetLearningGuideVersionSeenForTesting()
    router.replace(ROUTES.TABS.REVIEW)
  }, [isE2EReset, resetLearningGuideVersionSeenForTesting, router])

  if (isE2EReset) {
    return (
      <ViewThemed style={styles.loading} testID="learning-guide-e2e-reset">
        <ActivityIndicator size="large" color={Colors.primary.DEFAULT} />
      </ViewThemed>
    )
  }

  const handleComplete = () => {
    markLearningGuideVersionSeen(LEARNING_GUIDE_VERSION)
    router.back()
  }

  const handleNavigate = (route: LearningGuideActionRoute) => {
    router.push(route)
  }

  return (
    <LearningGuideContent
      onComplete={handleComplete}
      onNavigate={handleNavigate}
    />
  )
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

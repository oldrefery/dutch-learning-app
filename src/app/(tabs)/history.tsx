import React from 'react'
import { StyleSheet, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ViewThemed } from '@/components/Themed'
import { NotificationHistorySection } from '@/components/HistorySections/NotificationHistorySection'
import { WordAnalysisHistorySection } from '@/components/HistorySections/WordAnalysisHistorySection'

export default function HistoryScreen() {
  const insets = useSafeAreaInsets()

  return (
    <ViewThemed
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 80,
        },
      ]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <WordAnalysisHistorySection />

        <NotificationHistorySection />
      </ScrollView>
    </ViewThemed>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingTop: 16,
  },
})

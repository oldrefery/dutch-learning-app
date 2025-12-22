import React, { useState } from 'react'
import { StyleSheet, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ViewThemed } from '@/components/Themed'
import { NotificationHistorySection } from '@/components/HistorySections/NotificationHistorySection'
import { WordAnalysisHistorySection } from '@/components/HistorySections/WordAnalysisHistorySection'
import WordDetailModal from '@/components/WordDetailModal'
import { useApplicationStore } from '@/stores/useApplicationStore'
import type { Word } from '@/types/database'

export default function HistoryScreen() {
  const insets = useSafeAreaInsets()
  const words = useApplicationStore(state => state.words)
  const [selectedWord, setSelectedWord] = useState<Word | null>(null)
  const [modalVisible, setModalVisible] = useState(false)

  const handleWordPress = (dutchLemma: string) => {
    const word = words.find(w => w.dutch_lemma === dutchLemma)
    if (word) {
      setSelectedWord(word)
      setModalVisible(true)
    }
  }

  const handleCloseModal = () => {
    setModalVisible(false)
    setSelectedWord(null)
  }

  return (
    <>
      <ViewThemed
        testID="screen-history"
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
          <WordAnalysisHistorySection onWordPress={handleWordPress} />

          <NotificationHistorySection />
        </ScrollView>
      </ViewThemed>

      <WordDetailModal
        visible={modalVisible}
        onClose={handleCloseModal}
        word={selectedWord}
      />
    </>
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

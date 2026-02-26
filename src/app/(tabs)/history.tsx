import React, { useState, useCallback } from 'react'
import { StyleSheet, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ViewThemed } from '@/components/Themed'
import { NotificationHistorySection } from '@/components/HistorySections/NotificationHistorySection'
import { WordAnalysisHistorySection } from '@/components/HistorySections/WordAnalysisHistorySection'
import WordDetailModal from '@/components/WordDetailModal'
import { ToastService } from '@/components/AppToast'
import { ToastType } from '@/constants/ToastConstants'
import { useApplicationStore } from '@/stores/useApplicationStore'
import type { Word } from '@/types/database'

export default function HistoryScreen() {
  const insets = useSafeAreaInsets()
  const { words, reanalyzeWord } = useApplicationStore()
  const [selectedWord, setSelectedWord] = useState<Word | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [isReanalyzing, setIsReanalyzing] = useState(false)

  const handleWordPress = useCallback(
    (dutchLemma: string) => {
      const word = words.find(w => w.dutch_lemma === dutchLemma)
      if (word) {
        setSelectedWord(word)
        setModalVisible(true)
      }
    },
    [words]
  )

  const handleCloseModal = useCallback(() => {
    setModalVisible(false)
    setSelectedWord(null)
  }, [])

  const handleReanalyzeWord = useCallback(async () => {
    if (!selectedWord) return

    setIsReanalyzing(true)
    try {
      const updatedWord = await reanalyzeWord(selectedWord.word_id)
      if (updatedWord) {
        setSelectedWord(updatedWord)
        ToastService.show('Word re-analyzed successfully', ToastType.SUCCESS)
      } else {
        ToastService.show('Failed to re-analyze word', ToastType.ERROR)
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Could not re-analyze word'
      ToastService.show(errorMessage, ToastType.ERROR)
    } finally {
      setIsReanalyzing(false)
    }
  }, [selectedWord, reanalyzeWord])

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
        onReanalyzeWord={handleReanalyzeWord}
        isReanalyzing={isReanalyzing}
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

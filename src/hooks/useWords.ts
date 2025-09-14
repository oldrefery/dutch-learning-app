import { useAppStore } from '@/stores/useAppStore'

export interface UseWordsReturn {
  words: any[]
  wordsLoading: boolean
  fetchWords: () => Promise<void>
  addNewWord: (word: string) => Promise<any>
  updateWordAfterReview: (wordId: string, assessment: any) => Promise<void>
  deleteWord: (wordId: string) => Promise<void>
}

export function useWords(): UseWordsReturn {
  const {
    words,
    wordsLoading,
    fetchWords,
    addNewWord,
    updateWordAfterReview,
    deleteWord,
  } = useAppStore()

  return {
    words,
    wordsLoading,
    fetchWords,
    addNewWord,
    updateWordAfterReview,
    deleteWord,
  }
}

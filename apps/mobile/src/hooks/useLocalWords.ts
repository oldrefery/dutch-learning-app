import { useCallback, useState, useEffect } from 'react'
import { wordRepository, type LocalWord } from '@/db/wordRepository'
import { useApplicationStore } from '@/stores/useApplicationStore'

export function useLocalWords() {
  const { currentUserId } = useApplicationStore()
  const [words, setWords] = useState<LocalWord[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(currentUserId))

  const [previousUserId, setPreviousUserId] = useState(currentUserId)
  if (previousUserId !== currentUserId) {
    setPreviousUserId(currentUserId)
    setWords([])
    setIsLoading(Boolean(currentUserId))
  }

  const fetchWords = useCallback(async () => {
    if (!currentUserId) return

    setIsLoading(true)
    try {
      const fetchedWords = await wordRepository.getWordsByUserId(currentUserId)
      setWords(fetchedWords)
    } catch (error) {
      console.error('[LocalWords] Error fetching words:', error)
      setWords([])
    } finally {
      setIsLoading(false)
    }
  }, [currentUserId])

  const fetchWordsByCollection = useCallback(async (collectionId: string) => {
    setIsLoading(true)
    try {
      const fetchedWords =
        await wordRepository.getWordsByCollectionId(collectionId)
      setWords(fetchedWords)
    } catch (error) {
      console.error('[LocalWords] Error fetching words by collection:', error)
      setWords([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getWord = useCallback(
    async (wordId: string): Promise<LocalWord | null> => {
      if (!currentUserId) return null

      try {
        return await wordRepository.getWordByIdAndUserId(wordId, currentUserId)
      } catch (error) {
        console.error('[LocalWords] Error fetching word:', error)
        return null
      }
    },
    [currentUserId]
  )

  const updateWordProgress = useCallback(
    async (wordId: string, progress: Partial<LocalWord>) => {
      if (!currentUserId) return

      try {
        await wordRepository.updateWordProgress(wordId, currentUserId, progress)
        // Refresh local state
        await fetchWords()
      } catch (error) {
        console.error('[LocalWords] Error updating word progress:', error)
        throw error
      }
    },
    [currentUserId, fetchWords]
  )

  useEffect(() => {
    if (!currentUserId) return
    let active = true
    void wordRepository.getWordsByUserId(currentUserId).then(
      result => {
        if (active) {
          setWords(result)
          setIsLoading(false)
        }
      },
      error => {
        console.error('[LocalWords] Error fetching words:', error)
        if (active) {
          setWords([])
          setIsLoading(false)
        }
      }
    )
    return () => {
      active = false
    }
  }, [currentUserId])

  return {
    words,
    isLoading,
    fetchWords,
    fetchWordsByCollection,
    getWord,
    updateWordProgress,
  }
}

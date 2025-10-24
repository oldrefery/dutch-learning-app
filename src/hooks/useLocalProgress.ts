import { useCallback, useState, useEffect } from 'react'
import { progressRepository, type UserProgress } from '@/db/progressRepository'
import { useApplicationStore } from '@/stores/useApplicationStore'

export function useLocalProgress() {
  const { currentUserId } = useApplicationStore()
  const [progress, setProgress] = useState<UserProgress[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchProgress = useCallback(async () => {
    if (!currentUserId) return

    setIsLoading(true)
    try {
      const fetchedProgress =
        await progressRepository.getProgressByUserId(currentUserId)
      setProgress(fetchedProgress)
    } catch (error) {
      console.error('[LocalProgress] Error fetching progress:', error)
      setProgress([])
    } finally {
      setIsLoading(false)
    }
  }, [currentUserId])

  const getProgressForWord = useCallback(
    async (wordId: string): Promise<UserProgress[]> => {
      try {
        return await progressRepository.getProgressByWordId(wordId)
      } catch (error) {
        console.error(
          '[LocalProgress] Error fetching progress for word:',
          error
        )
        return []
      }
    },
    []
  )

  const updateProgress = useCallback(
    async (
      progressId: string,
      updates: Partial<
        Omit<UserProgress, 'progress_id' | 'user_id' | 'sync_status'>
      >
    ) => {
      if (!currentUserId) return

      try {
        await progressRepository.updateProgress(
          progressId,
          currentUserId,
          updates
        )
        // Refresh local state
        await fetchProgress()
      } catch (error) {
        console.error('[LocalProgress] Error updating progress:', error)
        throw error
      }
    },
    [currentUserId, fetchProgress]
  )

  // Load progress on mount if a user is available
  useEffect(() => {
    if (currentUserId) {
      fetchProgress()
    }
  }, [currentUserId, fetchProgress])

  return {
    progress,
    isLoading,
    fetchProgress,
    getProgressForWord,
    updateProgress,
  }
}

import { useAppStore } from '@/stores/useAppStore'

export interface UseAppInitializationReturn {
  currentUserId: string | null
  error: any
  initializeApp: () => Promise<void>
  clearError: () => void
}

export function useAppInitialization(): UseAppInitializationReturn {
  const { currentUserId, error, initializeApp, clearError } = useAppStore()

  return {
    currentUserId,
    error,
    initializeApp,
    clearError,
  }
}

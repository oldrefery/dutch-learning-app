import type { WordAnalysisResult } from '@/features/analysis/analysis-contract'

const STORAGE_PREFIX = 'woordenaar:web:analysis-history'
const MAX_HISTORY_ITEMS = 10
const EMPTY_HISTORY: readonly AnalysisHistoryEntry[] = []
const snapshots = new Map<string, readonly AnalysisHistoryEntry[]>()
const listeners = new Map<string, Set<() => void>>()

export interface AnalysisHistoryEntry {
  analyzedAt: string
  cacheHit: boolean
  dutchLemma: string
  id: string
  input: string
  source: 'cache' | 'gemini'
}

const getStorageKey = (userId: string) => `${STORAGE_PREFIX}:${userId}`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parseEntry = (value: unknown): AnalysisHistoryEntry | null => {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.input !== 'string' ||
    typeof value.dutchLemma !== 'string' ||
    typeof value.analyzedAt !== 'string' ||
    typeof value.cacheHit !== 'boolean' ||
    (value.source !== 'cache' && value.source !== 'gemini') ||
    Number.isNaN(new Date(value.analyzedAt).getTime())
  ) {
    return null
  }

  return {
    id: value.id,
    input: value.input.slice(0, 120),
    dutchLemma: value.dutchLemma.slice(0, 120),
    analyzedAt: value.analyzedAt,
    cacheHit: value.cacheHit,
    source: value.source,
  }
}

export const parseAnalysisHistory = (
  serialized: string | null
): readonly AnalysisHistoryEntry[] => {
  if (!serialized) return EMPTY_HISTORY

  try {
    const parsed: unknown = JSON.parse(serialized)
    if (!Array.isArray(parsed)) return EMPTY_HISTORY
    return parsed
      .flatMap(item => {
        const entry = parseEntry(item)
        return entry ? [entry] : []
      })
      .slice(0, MAX_HISTORY_ITEMS)
  } catch {
    return EMPTY_HISTORY
  }
}

const readHistory = (userId: string): readonly AnalysisHistoryEntry[] => {
  const cached = snapshots.get(userId)
  if (cached) return cached
  if (typeof window === 'undefined') return EMPTY_HISTORY

  try {
    const history = parseAnalysisHistory(
      window.localStorage.getItem(getStorageKey(userId))
    )
    snapshots.set(userId, history)
    return history
  } catch {
    return EMPTY_HISTORY
  }
}

const emitChange = (userId: string) => {
  listeners.get(userId)?.forEach(listener => listener())
}

export const recordAnalysisHistory = (
  userId: string,
  input: string,
  result: WordAnalysisResult
) => {
  if (typeof window === 'undefined') return

  try {
    const entry: AnalysisHistoryEntry = {
      id: window.crypto.randomUUID(),
      input: input.trim().slice(0, 120),
      dutchLemma: result.analysis.dutchLemma,
      analyzedAt: new Date().toISOString(),
      cacheHit: result.metadata.cacheHit,
      source: result.metadata.source,
    }
    const current = readHistory(userId)
    const next = [
      entry,
      ...current.filter(item => item.dutchLemma !== entry.dutchLemma),
    ].slice(0, MAX_HISTORY_ITEMS)

    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(next))
    snapshots.set(userId, next)
    emitChange(userId)
  } catch {
    return
  }
}

export const subscribeToAnalysisHistory = (
  userId: string,
  listener: () => void
) => {
  const userListeners = listeners.get(userId) ?? new Set<() => void>()
  userListeners.add(listener)
  listeners.set(userId, userListeners)

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== getStorageKey(userId)) return
    snapshots.delete(userId)
    listener()
  }
  window.addEventListener('storage', handleStorage)

  return () => {
    userListeners.delete(listener)
    if (userListeners.size === 0) listeners.delete(userId)
    window.removeEventListener('storage', handleStorage)
  }
}

export const getAnalysisHistorySnapshot = (userId: string) =>
  readHistory(userId)

export const getAnalysisHistoryServerSnapshot = () => EMPTY_HISTORY

export const clearAnalysisHistory = (userId: string): void => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(getStorageKey(userId))
  } catch {
    return
  }
  snapshots.delete(userId)
  emitChange(userId)
}

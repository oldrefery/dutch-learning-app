import type {
  BatchCaptureDraftItem,
  BatchCaptureItemStatus,
} from '@woordenaar/domain'
import {
  parseWordAnalysis,
  toAnalysisJson,
} from '../analysis/analysis-contract'
import type {
  AnalysisMetadata,
  WordAnalysis,
} from '../analysis/analysis-contract'
import type { WebBatchCaptureItem, WebBatchCaptureState } from './types'

type UnknownRecord = Record<string, unknown>

const ACTIVE_NETWORK_STATUSES: BatchCaptureItemStatus[] = [
  'checking_duplicate',
  'analyzing',
]

const ITEM_STATUSES = new Set<BatchCaptureItemStatus>([
  'queued',
  'checking_duplicate',
  'possible_duplicate',
  'analyzing',
  'awaiting_review',
  'failed',
  'completed',
  'skipped',
  'cancelled',
])

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isStatus = (value: unknown): value is BatchCaptureItemStatus =>
  typeof value === 'string' &&
  ITEM_STATUSES.has(value as BatchCaptureItemStatus)

const optionalText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null

const parseDuplicate = (value: unknown) => {
  if (!isRecord(value) || typeof value.wordId !== 'string') return null
  return {
    wordId: value.wordId,
    collectionId: optionalText(value.collectionId),
    collectionName: optionalText(value.collectionName),
  }
}

const parseAnalysis = (value: unknown): WordAnalysis | null => {
  if (value === null || value === undefined) return null
  try {
    return parseWordAnalysis(value)
  } catch {
    return null
  }
}

const parseMetadata = (value: unknown): AnalysisMetadata | null => {
  if (!isRecord(value)) return null
  const source = value.source === 'cache' ? 'cache' : 'gemini'
  return {
    source,
    cacheHit: value.cacheHit === true,
    forceRefresh: value.forceRefresh === true,
    usageCount: typeof value.usageCount === 'number' ? value.usageCount : null,
  }
}

const parsePersistedItem = (
  value: unknown,
  now: string
): WebBatchCaptureItem | null => {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.dutchText !== 'string' ||
    typeof value.sourceLine !== 'number' ||
    !isStatus(value.status)
  ) {
    return null
  }

  const analysis = parseAnalysis(value.analysis)
  const interrupted = ACTIVE_NETWORK_STATUSES.includes(value.status)
  const awaitingReviewWithoutAnalysis =
    value.status === 'awaiting_review' && !analysis
  const status =
    interrupted || awaitingReviewWithoutAnalysis ? 'queued' : value.status

  return {
    id: value.id,
    dutchText: value.dutchText,
    translationHint: optionalText(value.translationHint),
    sourceLine: value.sourceLine,
    status,
    error:
      interrupted || awaitingReviewWithoutAnalysis
        ? 'Previous analysis was interrupted. Ready to resume.'
        : optionalText(value.error),
    duplicate: parseDuplicate(value.duplicate),
    semanticDuplicate: parseDuplicate(value.semanticDuplicate),
    bypassLemmaDuplicate: value.bypassLemmaDuplicate === true,
    analysis: status === 'awaiting_review' ? analysis : null,
    analysisMetadata:
      status === 'awaiting_review'
        ? parseMetadata(value.analysisMetadata)
        : null,
    createdAt: optionalText(value.createdAt) ?? now,
    updatedAt: now,
  }
}

export const createEmptyBatchCaptureState = (
  userId: string,
  targetCollectionId: string
): WebBatchCaptureState => ({
  version: 1,
  ownerUserId: userId,
  targetCollectionId,
  items: [],
  isPaused: true,
  activeItemId: null,
})

export const createBatchCaptureState = (
  userId: string,
  targetCollectionId: string,
  drafts: BatchCaptureDraftItem[],
  createId: () => string,
  now: string
): WebBatchCaptureState => ({
  version: 1,
  ownerUserId: userId,
  targetCollectionId,
  isPaused: true,
  activeItemId: null,
  items: drafts.map(draft => ({
    ...draft,
    id: createId(),
    status: 'queued',
    error: null,
    duplicate: null,
    semanticDuplicate: null,
    bypassLemmaDuplicate: false,
    analysis: null,
    analysisMetadata: null,
    createdAt: now,
    updatedAt: now,
  })),
})

export const recoverBatchCaptureState = (
  value: unknown,
  userId: string,
  collectionIds: string[],
  fallbackCollectionId: string,
  now: string
): WebBatchCaptureState => {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    value.ownerUserId !== userId ||
    !Array.isArray(value.items)
  ) {
    return createEmptyBatchCaptureState(userId, fallbackCollectionId)
  }

  const requestedTarget = optionalText(value.targetCollectionId)
  const targetCollectionId =
    requestedTarget && collectionIds.includes(requestedTarget)
      ? requestedTarget
      : fallbackCollectionId
  const items = value.items.flatMap(item => {
    const parsed = parsePersistedItem(item, now)
    return parsed ? [parsed] : []
  })

  return {
    version: 1,
    ownerUserId: userId,
    targetCollectionId,
    items,
    isPaused: true,
    activeItemId: null,
  }
}

export const updateBatchCaptureItem = (
  items: WebBatchCaptureItem[],
  itemId: string,
  update: Partial<WebBatchCaptureItem>,
  now: string
): WebBatchCaptureItem[] =>
  items.map(item =>
    item.id === itemId ? { ...item, ...update, updatedAt: now } : item
  )

export const isWebBatchCaptureFinished = (
  items: WebBatchCaptureItem[]
): boolean =>
  items.length > 0 &&
  items.every(item =>
    ['completed', 'skipped', 'cancelled'].includes(item.status)
  )

export const serializeBatchCaptureState = (
  state: WebBatchCaptureState
): unknown => ({
  ...state,
  items: state.items.map(item => ({
    ...item,
    analysis: item.analysis ? toAnalysisJson(item.analysis) : null,
  })),
})

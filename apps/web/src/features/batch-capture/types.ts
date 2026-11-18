import type {
  DictionaryCollectionExportV2,
  BatchCaptureDuplicate,
  BatchCaptureDraftItem,
  BatchCaptureItemStatus,
} from '@woordenaar/domain'
import type {
  AnalysisMetadata,
  WordAnalysis,
} from '../analysis/analysis-contract'

export interface WebBatchCaptureItem extends BatchCaptureDraftItem {
  published?: DictionaryCollectionExportV2 | null
  analysis: WordAnalysis | null
  analysisMetadata: AnalysisMetadata | null
  bypassLemmaDuplicate: boolean
  createdAt: string
  duplicate: BatchCaptureDuplicate | null
  error: string | null
  id: string
  semanticDuplicate: BatchCaptureDuplicate | null
  status: BatchCaptureItemStatus
  updatedAt: string
}

export interface WebBatchCaptureState {
  activeItemId: string | null
  isPaused: boolean
  items: WebBatchCaptureItem[]
  ownerUserId: string
  targetCollectionId: string
  version: 1
}

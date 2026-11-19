import type {
  DictionaryCollectionExportV2,
  FollowingImportOperation,
  BatchCaptureDuplicate,
  BatchCaptureDraftItem,
  BatchCaptureItemStatus,
} from '@woordenaar/domain'
import type {
  AnalysisMetadata,
  WordAnalysis,
} from '../analysis/analysis-contract'

export interface WebBatchCaptureItem extends BatchCaptureDraftItem {
  meaningIndex?: number
  importIntent?: FollowingImportOperation
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
  autoSave?: boolean
  activeItemId: string | null
  isPaused: boolean
  items: WebBatchCaptureItem[]
  ownerUserId: string
  targetCollectionId: string
  version: 1
}

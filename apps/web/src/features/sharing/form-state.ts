export interface CollectionSharingState {
  isShared: boolean
  message: string | null
  shareUrl: string | null
  status: 'idle' | 'error' | 'success'
}

export interface SharedCollectionImportState {
  collectionId?: string
  collectionName?: string
  importedCount?: number
  message: string | null
  status: 'idle' | 'error' | 'success'
}

export const INITIAL_SHARED_COLLECTION_IMPORT_STATE: SharedCollectionImportState =
  {
    status: 'idle',
    message: null,
  }

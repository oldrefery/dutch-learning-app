export interface StarterPackImportState {
  collectionId?: string
  collectionName?: string
  importedCount?: number
  message: string | null
  status: 'idle' | 'success' | 'error'
}

export const INITIAL_STARTER_PACK_IMPORT_STATE: StarterPackImportState = {
  status: 'idle',
  message: null,
}

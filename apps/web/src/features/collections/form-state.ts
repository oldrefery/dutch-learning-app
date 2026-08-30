export interface CollectionFormState {
  status: 'idle' | 'success' | 'error'
  message: string | null
  fieldErrors?: {
    name?: string
  }
}

export const INITIAL_COLLECTION_FORM_STATE: CollectionFormState = {
  status: 'idle',
  message: null,
}

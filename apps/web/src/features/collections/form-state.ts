export interface CollectionFormState {
  status: 'idle' | 'success' | 'error'
  message: string | null
  fieldErrors?: {
    confirmation?: string
    name?: string
  }
}

export const INITIAL_COLLECTION_FORM_STATE: CollectionFormState = {
  status: 'idle',
  message: null,
}

export interface WordActionState {
  fieldErrors?: {
    confirmation?: string
    targetCollectionId?: string
  }
  message: string | null
  status: 'idle' | 'success' | 'error'
}

export const INITIAL_WORD_ACTION_STATE: WordActionState = {
  status: 'idle',
  message: null,
}

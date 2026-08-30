export interface AddWordActionState {
  fieldErrors?: {
    analysis?: string
    collectionId?: string
  }
  message: string | null
  status: 'idle' | 'error'
}

export const INITIAL_ADD_WORD_ACTION_STATE: AddWordActionState = {
  status: 'idle',
  message: null,
}

export interface DuplicateWordResult {
  collectionId: string | null
  collectionName: string | null
  wordId: string
}

import { create } from 'zustand'
import type { ApplicationState } from '@/types/ApplicationStoreTypes'
import { createWordActions } from './actions/wordActions'
import { createCollectionActions } from './actions/collectionActions'
import { createReviewActions } from './actions/reviewActions'
import { createAppInitializationActions } from './actions/appInitializationActions'

export const useApplicationStore = create<ApplicationState>((set, get) => {
  return {
    // Initial state
    currentUserId: null,
    userAccessLevel: null,
    words: [],
    wordsLoading: false,
    collections: [],
    collectionsLoading: false,
    reviewSession: null,
    reviewLoading: false,
    currentWord: null,
    reviewWordsCount: 0,
    error: null,

    // Actions
    ...createAppInitializationActions(set, get),
    ...createWordActions(set, get),
    ...createCollectionActions(set, get),
    ...createReviewActions(set, get),
  }
})

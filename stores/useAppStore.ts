import { create } from 'zustand'
import type { AppState } from '@/types/AppStoreTypes'
import { createWordActions } from './actions/wordActions'
import { createCollectionActions } from './actions/collectionActions'
import { createReviewActions } from './actions/reviewActions'
import { createAppInitializationActions } from './actions/appInitializationActions'

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  currentUserId: null,
  words: [],
  wordsLoading: false,
  collections: [],
  collectionsLoading: false,
  reviewSession: null,
  reviewLoading: false,
  currentWord: null,
  error: null,

  // Actions
  ...createAppInitializationActions(set, get),
  ...createWordActions(set, get),
  ...createCollectionActions(set, get),
  ...createReviewActions(set, get),
}))

/**
 * Shared test factory helpers
 *
 * Provides reusable factory functions for creating mock data objects
 * used across multiple test files.
 */

import type { Collection, Word, ReviewSession } from '@/types/database'
import type { UserProgress } from '@/db/progressRepository'
import type {
  NotificationHistoryEntry,
  WordAnalysisHistoryEntry,
} from '@/types/HistoryTypes'
import { ToastType } from '@/constants/ToastConstants'

/**
 * Generates a unique ID with the given prefix
 */
export const generateId = (prefix: string): string =>
  `${prefix}_${Math.random().toString(36).substring(2, 9)}`

/**
 * Creates a mock Word with sensible defaults
 */
export const createMockWord = (overrides: Partial<Word> = {}): Word => ({
  word_id: generateId('word'),
  user_id: 'test-user-id',
  collection_id: generateId('col'),
  dutch_lemma: 'huis',
  dutch_original: 'het huis',
  part_of_speech: 'noun',
  is_irregular: false,
  is_reflexive: false,
  is_expression: false,
  expression_type: null,
  is_separable: false,
  prefix_part: null,
  root_verb: null,
  article: 'het',
  plural: 'huizen',
  register: null,
  translations: { en: ['house'] },
  examples: [{ nl: 'Het huis is groot.', en: 'The house is big.' }],
  synonyms: [],
  antonyms: [],
  conjugation: null,
  preposition: null,
  image_url: null,
  tts_url: null,
  interval_days: 1,
  repetition_count: 0,
  easiness_factor: 2.5,
  next_review_date: new Date().toISOString(),
  last_reviewed_at: null,
  analysis_notes: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

/**
 * Creates a mock Collection with sensible defaults
 */
export const createMockCollection = (
  overrides: Partial<Collection> = {}
): Collection => ({
  collection_id: generateId('col'),
  user_id: 'test-user-id',
  name: 'Test Collection',
  description: null,
  updated_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  is_shared: false,
  shared_with: null,
  share_token: null,
  shared_at: null,
  ...overrides,
})

/**
 * Creates a mock UserProgress with sensible defaults
 */
export const createMockProgress = (
  overrides: Partial<UserProgress> = {}
): UserProgress => ({
  progress_id: generateId('prog'),
  user_id: 'test-user-id',
  word_id: generateId('word'),
  status: 'learning',
  reviewed_count: 0,
  last_reviewed_at: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  sync_status: 'synced',
  ...overrides,
})

/**
 * Creates a mock NotificationHistoryEntry
 */
export const createMockNotificationEntry = (
  overrides: Partial<NotificationHistoryEntry> = {}
): NotificationHistoryEntry => ({
  id: generateId('notif'),
  message: 'Test notification',
  type: ToastType.SUCCESS,
  timestamp: new Date(),
  ...overrides,
})

/**
 * Creates a mock WordAnalysisHistoryEntry
 */
export const createMockAnalyzedWordEntry = (
  overrides: Partial<WordAnalysisHistoryEntry> = {}
): WordAnalysisHistoryEntry => ({
  id: generateId('analyzed'),
  word: 'huis',
  dutchLemma: 'huis',
  addedToCollection: undefined,
  timestamp: new Date(),
  wasAdded: false,
  ...overrides,
})

/**
 * Creates a mock ReviewSession
 */
export const createMockReviewSession = (
  overrides: Partial<ReviewSession> = {}
): ReviewSession => ({
  words: [createMockWord(), createMockWord(), createMockWord()],
  currentIndex: 0,
  completedCount: 0,
  ...overrides,
})

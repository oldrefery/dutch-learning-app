import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { DictionaryConflictResolver } from '../DictionaryConflictResolver'
import {
  dictionaryContentSync,
  type DictionaryConflictSnapshot,
} from '@/services/dictionaryContentSync'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { wordToDictionaryContent } from '@/db/dictionaryContentMapping'
import type { Word } from '@/types/database'

jest.mock('@/services/dictionaryContentSync', () => ({
  dictionaryContentSync: {
    readConflict: jest.fn(),
    resolveConflict: jest.fn(),
  },
}))
jest.mock('@/services/syncManager', () => ({
  syncManager: { performSync: jest.fn().mockResolvedValue({ success: true }) },
}))
jest.mock('@/stores/useApplicationStore', () => {
  const state = {
    currentUserId: 'owner',
    words: [] as Word[],
    fetchWords: jest.fn().mockResolvedValue(undefined),
  }
  return {
    useApplicationStore: Object.assign(
      jest.fn(selector => selector(state)),
      { getState: () => state }
    ),
  }
})

const TEST_DATE = '2026-09-21'
const COMPARE_VERSIONS = 'Compare versions'
const KEEP_MY_VERSION = 'Keep my version'

const word: Word = {
  word_id: 'word',
  user_id: 'owner',
  collection_id: 'collection',
  dutch_lemma: 'huis',
  dutch_original: null,
  part_of_speech: 'noun',
  article: 'het',
  translations: { en: ['house'] },
  examples: [],
  is_irregular: false,
  is_reflexive: false,
  is_expression: false,
  expression_type: null,
  is_separable: false,
  prefix_part: null,
  root_verb: null,
  plural: 'huizen',
  register: null,
  synonyms: [],
  antonyms: [],
  conjugation: null,
  preposition: null,
  analysis_notes: null,
  usage_notes: null,
  image_url: null,
  tts_url: null,
  interval_days: 7,
  repetition_count: 3,
  easiness_factor: 2.5,
  next_review_date: '2026-09-28',
  last_reviewed_at: null,
  created_at: TEST_DATE,
  updated_at: TEST_DATE,
  dictionary_content_conflict: true,
}
const content = wordToDictionaryContent(word)
const snapshot: DictionaryConflictSnapshot = {
  userId: 'owner',
  wordId: 'word',
  operationIds: ['operation'],
  localContent: content,
  remoteContent: { ...content, translations: { en: ['home'], ru: [] } },
  remoteState: {
    word_id: 'word',
    user_id: 'owner',
    content_version: 2,
    reference: null,
    fallback_content: content,
    overrides: {},
    updated_at: TEST_DATE,
  },
}

beforeEach(() => {
  jest.clearAllMocks()
  const state = useApplicationStore.getState()
  state.currentUserId = word.user_id
  state.words = [word]
  jest.mocked(state.fetchWords).mockImplementation(async () => {
    state.words = [{ ...word, dictionary_content_conflict: false }]
  })
  jest.mocked(dictionaryContentSync.readConflict).mockResolvedValue(snapshot)
  jest.mocked(dictionaryContentSync.resolveConflict).mockResolvedValue()
})

it.each(['local', 'server'] as const)(
  'requires an explicit %s choice after comparison',
  async choice => {
    const screen = render(<DictionaryConflictResolver word={word} />)
    expect(screen.queryByText(KEEP_MY_VERSION)).toBeNull()
    fireEvent.press(screen.getByText(COMPARE_VERSIONS))
    await waitFor(() => expect(screen.getByText('Server version')).toBeTruthy())
    expect(dictionaryContentSync.resolveConflict).not.toHaveBeenCalled()
    fireEvent.press(
      screen.getByText(
        choice === 'local' ? KEEP_MY_VERSION : 'Use server version'
      )
    )
    await waitFor(() =>
      expect(dictionaryContentSync.resolveConflict).toHaveBeenCalledWith(
        snapshot,
        choice
      )
    )
    expect(useApplicationStore.getState().fetchWords).toHaveBeenCalled()
  }
)

it('keeps the decision available after a failed comparison request', async () => {
  jest
    .mocked(dictionaryContentSync.readConflict)
    .mockRejectedValueOnce(new Error('Offline'))
  const screen = render(<DictionaryConflictResolver word={word} />)
  fireEvent.press(screen.getByText(COMPARE_VERSIONS))
  await waitFor(() => expect(screen.getByText('Offline')).toBeTruthy())
  expect(screen.getByText(COMPARE_VERSIONS)).toBeTruthy()
  expect(dictionaryContentSync.resolveConflict).not.toHaveBeenCalled()
})

it('does not expose another account’s conflict', () => {
  const screen = render(
    <DictionaryConflictResolver word={{ ...word, user_id: 'other' }} />
  )
  expect(screen.queryByText(COMPARE_VERSIONS)).toBeNull()
})

it('shows a new conflict even when the open detail has an older word snapshot', () => {
  const screen = render(
    <DictionaryConflictResolver
      word={{ ...word, dictionary_content_conflict: false }}
    />
  )
  expect(screen.getByText(COMPARE_VERSIONS)).toBeTruthy()
})

it('allows resolving a second conflict without closing the word details', async () => {
  const screen = render(<DictionaryConflictResolver word={word} />)
  fireEvent.press(screen.getByText(COMPARE_VERSIONS))
  await waitFor(() => expect(screen.getByText(KEEP_MY_VERSION)).toBeTruthy())
  fireEvent.press(screen.getByText(KEEP_MY_VERSION))
  await waitFor(() =>
    expect(useApplicationStore.getState().fetchWords).toHaveBeenCalled()
  )
  screen.rerender(<DictionaryConflictResolver word={word} />)
  expect(screen.queryByText(COMPARE_VERSIONS)).toBeNull()

  useApplicationStore.getState().words = [word]
  screen.rerender(<DictionaryConflictResolver word={word} />)
  expect(screen.getByText(COMPARE_VERSIONS)).toBeTruthy()
  expect(screen.queryByText(KEEP_MY_VERSION)).toBeNull()
})

it('hides a removed word instead of resolving its stale modal snapshot', () => {
  useApplicationStore.getState().words = []
  const screen = render(<DictionaryConflictResolver word={word} />)
  expect(screen.queryByText(COMPARE_VERSIONS)).toBeNull()
})

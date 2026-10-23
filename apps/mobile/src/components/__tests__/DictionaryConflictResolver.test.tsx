import { parseDictionaryReadContent } from '@woordenaar/domain'
import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { DictionaryConflictResolver } from '../DictionaryConflictResolver'
import {
  dictionaryContentSync,
  type DictionaryConflictSnapshot,
} from '@/services/dictionaryContentSync'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { wordToDictionaryContent } from '@/db/dictionaryContentMapping'
import type { Word } from '@/types/database'
import { supabase } from '@/lib/supabase'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { followingBatch } from '@/db/__tests__/dictionaryFollowing.fixture'
import {
  dictionaryModeReconciliation,
  type DictionaryModeConflictSnapshot,
} from '@/services/dictionaryModeReconciliation'
jest.mock('@/services/dictionaryModeReconciliation', () => ({
  dictionaryModeReconciliation: {
    apply: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock('@/hooks/useNormalizedColorScheme', () => ({
  useNormalizedColorScheme: jest.fn(() => 'light'),
}))
jest.mock('@/lib/supabase')
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
const HOLD_FOR_REVIEW = 'Keep pending for review'
const SERVER_VERSION = 'Server version'

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
  jest.mocked(useNormalizedColorScheme).mockReturnValue('light')
  jest.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
    data: { subscription: { unsubscribe: jest.fn() } },
  } as unknown as ReturnType<typeof supabase.auth.onAuthStateChange>)
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
    await waitFor(() => expect(screen.getByText(SERVER_VERSION)).toBeTruthy())
    expect(dictionaryContentSync.resolveConflict).not.toHaveBeenCalled()
    fireEvent.press(
      screen.getByText(
        choice === 'local' ? KEEP_MY_VERSION : 'Use server version'
      )
    )
    await waitFor(() =>
      expect(dictionaryContentSync.resolveConflict).toHaveBeenCalledWith(
        snapshot,
        choice,
        expect.any(Function)
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

const readContent = (value: unknown) => {
  const parsed = parseDictionaryReadContent(value)
  if (!parsed.success) throw new Error('Invalid fixture')
  return parsed.data
}
const modeSnapshot = (): DictionaryModeConflictSnapshot => ({
  kind: 'mode-reconciliation',
  operationId: 'decision',
  userId: word.user_id,
  wordId: word.word_id,
  localContent: readContent(content),
  remoteContent: readContent(snapshot.remoteContent),
  local: {
    word: {
      word_id: word.word_id,
      user_id: word.user_id,
      collection_id: word.collection_id,
    },
    wordContent: {},
    privateRevision: null,
    cachedRevision: null,
    requiredState: null,
    privateState: null,
    cachedState: null,
    commands: [{ payload_json: 'saved private command' }],
  },
  remote: {
    card: { ...followingBatch().cards[0], word_id: word.word_id },
    revision: followingBatch().revisions[0],
    watermark: '9',
  },
})

it('shows a shared-mode comparison with hold only; no private resolution or sync', async () => {
  jest
    .mocked(dictionaryContentSync.readConflict)
    .mockResolvedValue(modeSnapshot())
  const screen = render(<DictionaryConflictResolver word={word} />)
  expect(dictionaryContentSync.readConflict).not.toHaveBeenCalled()
  fireEvent.press(screen.getByText(COMPARE_VERSIONS))
  await waitFor(() => expect(screen.getByText(HOLD_FOR_REVIEW)).toBeTruthy())
  expect(screen.queryByText(KEEP_MY_VERSION)).toBeNull()
  expect(screen.queryByText('Use server version')).toBeNull()
  fireEvent.press(screen.getByText(HOLD_FOR_REVIEW))
  expect(
    screen.getByText(
      'Your saved content and pending edits are retained for review.'
    )
  ).toBeTruthy()
  expect(dictionaryContentSync.resolveConflict).not.toHaveBeenCalled()
  expect(useApplicationStore.getState().fetchWords).not.toHaveBeenCalled()
})

it('discards a comparison completed after the word was removed', async () => {
  let finish: (value: DictionaryConflictSnapshot) => void = () => {}
  jest.mocked(dictionaryContentSync.readConflict).mockImplementation(
    () =>
      new Promise(resolve => {
        finish = resolve
      })
  )
  const screen = render(<DictionaryConflictResolver word={word} />)
  fireEvent.press(screen.getByText(COMPARE_VERSIONS))
  useApplicationStore.getState().words = []
  await act(async () => {
    finish(snapshot)
  })
  expect(screen.queryByText(SERVER_VERSION)).toBeNull()
  expect(dictionaryContentSync.resolveConflict).not.toHaveBeenCalled()
})

it('latches A -> B -> A across an open comparison', async () => {
  const screen = render(<DictionaryConflictResolver word={word} />)
  fireEvent.press(screen.getByText(COMPARE_VERSIONS))
  await waitFor(() => expect(screen.getByText(SERVER_VERSION)).toBeTruthy())
  const listener = jest.mocked(supabase.auth.onAuthStateChange).mock.calls[0][0]
  await act(async () => {
    listener('SIGNED_OUT', null)
    listener('SIGNED_IN', { user: { id: word.user_id } } as Parameters<
      typeof listener
    >[1])
  })
  expect(screen.queryByText(KEEP_MY_VERSION)).toBeNull()
  fireEvent.press(screen.getByText(COMPARE_VERSIONS))
  expect(dictionaryContentSync.readConflict).toHaveBeenCalledTimes(1)
  expect(dictionaryContentSync.resolveConflict).not.toHaveBeenCalled()
})

it('never resolves an old comparison for a replacement word in the same component', async () => {
  const screen = render(<DictionaryConflictResolver word={word} />)
  fireEvent.press(screen.getByText(COMPARE_VERSIONS))
  await waitFor(() => expect(screen.getByText(SERVER_VERSION)).toBeTruthy())
  const replacement = { ...word, word_id: 'replacement' }
  useApplicationStore.getState().words = [replacement]
  screen.rerender(<DictionaryConflictResolver word={replacement} />)
  expect(screen.queryByText(KEEP_MY_VERSION)).toBeNull()
  expect(dictionaryContentSync.resolveConflict).not.toHaveBeenCalled()
})

it.each(['light', 'dark'] as const)(
  'shows the held comparison in the %s theme without a private write choice',
  async theme => {
    jest.mocked(useNormalizedColorScheme).mockReturnValue(theme)
    jest
      .mocked(dictionaryContentSync.readConflict)
      .mockResolvedValue(modeSnapshot())
    const screen = render(<DictionaryConflictResolver word={word} />)
    fireEvent.press(screen.getByText(COMPARE_VERSIONS))
    await waitFor(() => expect(screen.getByText(HOLD_FOR_REVIEW)).toBeTruthy())
    expect(screen.queryByText(KEEP_MY_VERSION)).toBeNull()
  }
)

it('adds no Auth subscription for a word without a conflict', () => {
  useApplicationStore.getState().words = [
    { ...word, dictionary_content_conflict: false },
  ]
  render(<DictionaryConflictResolver word={word} />)
  expect(supabase.auth.onAuthStateChange).not.toHaveBeenCalled()
})

const LOAD_RETAINED = 'Load server version and retain saved edits'
it.each(['light', 'dark'] as const)(
  'applies the reviewed mode only after an explicit choice in %s theme',
  async theme => {
    jest.mocked(useNormalizedColorScheme).mockReturnValue(theme)
    const reviewed = modeSnapshot()
    reviewed.localContent.plural = 'private plural'
    reviewed.remoteContent.plural = 'server plural'
    jest.mocked(dictionaryContentSync.readConflict).mockResolvedValue(reviewed)
    const screen = render(<DictionaryConflictResolver word={word} />)
    expect(dictionaryModeReconciliation.apply).not.toHaveBeenCalled()
    fireEvent.press(screen.getByText(COMPARE_VERSIONS))
    await waitFor(() => expect(screen.getByText(LOAD_RETAINED)).toBeTruthy())
    expect(screen.getByText(/plural: "private plural"/)).toBeTruthy()
    expect(screen.getByText(/plural: "server plural"/)).toBeTruthy()
    expect(dictionaryModeReconciliation.apply).not.toHaveBeenCalled()
    fireEvent.press(screen.getByText(LOAD_RETAINED))
    await waitFor(() =>
      expect(dictionaryModeReconciliation.apply).toHaveBeenCalledWith(
        reviewed,
        expect.any(Function)
      )
    )
    expect(dictionaryContentSync.resolveConflict).not.toHaveBeenCalled()
    expect(useApplicationStore.getState().fetchWords).toHaveBeenCalled()
  }
)

it('retains the exact decision after refresh failure and reloads comparison separately', async () => {
  const reviewed = modeSnapshot()
  jest.mocked(dictionaryContentSync.readConflict).mockResolvedValue(reviewed)
  jest
    .mocked(useApplicationStore.getState().fetchWords)
    .mockRejectedValueOnce(new Error('Refresh failed'))
  const screen = render(<DictionaryConflictResolver word={word} />)
  fireEvent.press(screen.getByText(COMPARE_VERSIONS))
  await waitFor(() => expect(screen.getByText(LOAD_RETAINED)).toBeTruthy())
  fireEvent.press(screen.getByText(LOAD_RETAINED))
  await waitFor(() => expect(screen.getByText('Refresh failed')).toBeTruthy())
  fireEvent.press(screen.getByText(LOAD_RETAINED))
  await waitFor(() =>
    expect(dictionaryModeReconciliation.apply).toHaveBeenCalledTimes(2)
  )
  expect(
    jest
      .mocked(dictionaryModeReconciliation.apply)
      .mock.calls.map(call => call[0])
  ).toEqual([reviewed, reviewed])
})

it('never refreshes another account after an explicit mode load finishes late', async () => {
  let finish: () => void = () => {}
  jest.mocked(dictionaryModeReconciliation.apply).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve
      })
  )
  jest
    .mocked(dictionaryContentSync.readConflict)
    .mockResolvedValue(modeSnapshot())
  const screen = render(<DictionaryConflictResolver word={word} />)
  fireEvent.press(screen.getByText(COMPARE_VERSIONS))
  await waitFor(() => expect(screen.getByText(LOAD_RETAINED)).toBeTruthy())
  fireEvent.press(screen.getByText(LOAD_RETAINED))
  useApplicationStore.getState().currentUserId = 'other'
  screen.unmount()
  await act(async () => finish())
  expect(useApplicationStore.getState().fetchWords).not.toHaveBeenCalled()
})

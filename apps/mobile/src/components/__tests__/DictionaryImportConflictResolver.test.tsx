import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react-native'
import { DictionaryImportConflictResolver } from '../DictionaryImportConflictResolver'
import { DictionaryImportRecoveryLink } from '../DictionaryImportRecoveryLink'
import DictionaryRecoveryScreen from '@/app/dictionary-recovery'
import { router } from 'expo-router'
import { ROUTES } from '@/constants/Routes'
import {
  dictionaryImportRecovery,
  type ImportRecoverySnapshot,
} from '@/services/dictionaryImportRecovery'
import { syncManager } from '@/services/syncManager'
import { supabase } from '@/lib/supabase'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import {
  createMockWord,
  createMockCollection,
} from '@/__tests__/helpers/factories'
import { wordToDictionaryContent } from '@/db/dictionaryContentMapping'
import type { Word, Collection } from '@/types/database'

jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryContentEnabled: () => true,
}))
jest.mock('@/hooks/useNormalizedColorScheme', () => ({
  useNormalizedColorScheme: jest.fn(() => 'light'),
}))
jest.mock('@/services/dictionaryImportRecovery', () => ({
  dictionaryImportRecovery: { readCurrent: jest.fn(), prepare: jest.fn() },
}))
jest.mock('@/services/syncManager', () => ({
  syncManager: { performSync: jest.fn() },
}))
jest.mock('@/lib/supabase')
jest.mock('expo-router', () => ({
  Color: { android: { dynamic: {} }, ios: {} },
  router: { push: jest.fn() },
  Stack: { Screen: () => null },
}))
jest.mock('@/stores/useApplicationStore', () => {
  const state = {
    currentUserId: 'owner',
    words: [] as Word[],
    collections: [] as Collection[],
    fetchWords: jest.fn().mockResolvedValue(undefined),
  }
  return {
    useApplicationStore: Object.assign(
      jest.fn(selector => selector(state)),
      { getState: () => state }
    ),
  }
})
const READ = 'Read current server state'
const CONFIRM = 'Confirm recovery'
const TARGET_NAME = 'Saved target'
const word = createMockWord({
  user_id: 'owner',
  word_id: 'word',
  dictionary_import_recovery: 'placement-conflict',
})
const collection = createMockCollection({
  user_id: word.user_id,
  collection_id: 'target',
  name: TARGET_NAME,
})
const snapshot: ImportRecoverySnapshot = {
  userId: word.user_id,
  intent: {
    protocol_version: 1,
    operation_id: 'original',
    word_id: word.word_id,
    collection_id: collection.collection_id,
    source: { kind: 'private-copy', content: wordToDictionaryContent(word) },
  },
  state: {
    protocol_version: 1,
    original_operation_id: 'original',
    word_id: word.word_id,
    recovery_version: 2,
    inserted_once: true,
    state: 'active',
    collection_id: null,
  },
  previousOperationId: 'previous',
  localPlacementRevision: 1,
}
const SYNC_ERROR = 'No network connection'
beforeEach(() => {
  jest.clearAllMocks()
  useApplicationStore.getState().currentUserId = word.user_id
  useApplicationStore.getState().words = [word]
  useApplicationStore.getState().collections = [
    collection,
    createMockCollection({ user_id: 'foreign', name: 'Foreign target' }),
  ]
  jest.mocked(dictionaryImportRecovery.readCurrent).mockResolvedValue(snapshot)
  jest.mocked(dictionaryImportRecovery.prepare).mockResolvedValue()
  jest.mocked(syncManager.performSync).mockResolvedValue({
    success: false,
    userId: word.user_id,
    error: SYNC_ERROR,
    timestamp: '2026-10-02',
    wordsSynced: 0,
    progressSynced: 0,
  })
})

it.each(['light', 'dark'] as const)(
  'requires a read, owned target and explicit confirmation in %s theme, retaining offline recovery',
  async theme => {
    jest.mocked(useNormalizedColorScheme).mockReturnValue(theme)
    const screen = render(<DictionaryImportConflictResolver word={word} />)
    expect(dictionaryImportRecovery.readCurrent).not.toHaveBeenCalled()
    expect(screen.queryByText(CONFIRM)).toBeNull()
    fireEvent.press(screen.getByText(READ))
    await waitFor(() =>
      expect(
        screen.getByText('Current server placement: No collection')
      ).toBeTruthy()
    )
    expect(screen.queryByText('Foreign target')).toBeNull()
    fireEvent.press(screen.getByText(CONFIRM))
    expect(dictionaryImportRecovery.prepare).not.toHaveBeenCalled()
    fireEvent.press(screen.getByText(TARGET_NAME))
    fireEvent.press(screen.getByText(CONFIRM))
    await waitFor(() => expect(screen.getByText(SYNC_ERROR)).toBeTruthy())
    expect(dictionaryImportRecovery.prepare).toHaveBeenCalledWith(
      snapshot,
      'target',
      expect.any(Function)
    )
    expect(syncManager.performSync).toHaveBeenCalledWith(word.user_id)
    expect(
      screen.getByText('Recovery saved on this device. Waiting for sync.')
    ).toBeTruthy()
    expect(useApplicationStore.getState().words).toEqual([word])
  }
)

it('keeps semantic conflicts visible and requires another read after a stale proposal fails', async () => {
  const conflict = {
    ...word,
    dictionary_import_recovery: 'identity-conflict' as const,
  }
  useApplicationStore.getState().words = [conflict]
  jest
    .mocked(dictionaryImportRecovery.prepare)
    .mockRejectedValueOnce(new Error('Recovery changed'))
  const screen = render(<DictionaryImportConflictResolver word={conflict} />)
  expect(screen.getByText(/Resolve that card on its device/)).toBeTruthy()
  fireEvent.press(screen.getByText(READ))
  await waitFor(() => expect(screen.getByText(TARGET_NAME)).toBeTruthy())
  fireEvent.press(screen.getByText(TARGET_NAME))
  fireEvent.press(screen.getByText(CONFIRM))
  await waitFor(() => expect(screen.getByText('Recovery changed')).toBeTruthy())
  expect(screen.queryByText(CONFIRM)).toBeNull()
  expect(dictionaryImportRecovery.readCurrent).toHaveBeenCalledTimes(1)
  expect(syncManager.performSync).not.toHaveBeenCalled()
})

it.each(['unavailable', 'cancelled'] as const)(
  'offers no recovery for a %s identity',
  async state => {
    jest
      .mocked(dictionaryImportRecovery.readCurrent)
      .mockResolvedValue({ ...snapshot, state: { ...snapshot.state, state } })
    const screen = render(<DictionaryImportConflictResolver word={word} />)
    fireEvent.press(screen.getByText(READ))
    await waitFor(() =>
      expect(screen.getByText(/cannot be recreated by recovery/)).toBeTruthy()
    )
    expect(screen.queryByText(CONFIRM)).toBeNull()
    expect(dictionaryImportRecovery.prepare).not.toHaveBeenCalled()
  }
)

it('retains marker-only pre-upgrade data with a visible gate and no inferred recovery', () => {
  const old = { ...word, dictionary_import_recovery: 'unverified' as const }
  useApplicationStore.getState().words = [old]
  const screen = render(<DictionaryImportConflictResolver word={old} />)
  expect(screen.getByText(/exact import record is missing/)).toBeTruthy()
  expect(screen.queryByText(READ)).toBeNull()
  expect(dictionaryImportRecovery.readCurrent).not.toHaveBeenCalled()
})

it('suppresses a late read after account change and hides deleted-card controls', async () => {
  let finish!: (value: ImportRecoverySnapshot) => void
  jest.mocked(dictionaryImportRecovery.readCurrent).mockReturnValue(
    new Promise(resolve => {
      finish = resolve
    })
  )
  const screen = render(<DictionaryImportConflictResolver word={word} />)
  fireEvent.press(screen.getByText(READ))
  useApplicationStore.getState().currentUserId = 'another-owner'
  screen.rerender(<DictionaryImportConflictResolver word={word} />)
  await act(async () => finish(snapshot))
  expect(screen.queryByText(CONFIRM)).toBeNull()
  useApplicationStore.getState().currentUserId = word.user_id
  useApplicationStore.getState().words = []
  screen.rerender(<DictionaryImportConflictResolver word={word} />)
  expect(screen.queryByText(READ)).toBeNull()
  screen.unmount()
  expect(dictionaryImportRecovery.prepare).not.toHaveBeenCalled()
})

it('invalidates an open snapshot on sign-out even if the same owner signs back in', async () => {
  let listener!: Parameters<typeof supabase.auth.onAuthStateChange>[0]
  jest
    .mocked(supabase.auth.onAuthStateChange)
    .mockImplementationOnce(callback => {
      listener = callback
      return {
        data: {
          subscription: { id: 'view-watch', callback, unsubscribe: jest.fn() },
        },
      }
    })
  const screen = render(<DictionaryImportConflictResolver word={word} />)
  fireEvent.press(screen.getByText(READ))
  await waitFor(() => expect(screen.getByText(CONFIRM)).toBeTruthy())
  act(() => listener('SIGNED_OUT', null))
  act(() =>
    listener('SIGNED_IN', { user: { id: word.user_id } } as NonNullable<
      Parameters<typeof listener>[1]
    >)
  )
  expect(screen.getByText(/Authentication changed/)).toBeTruthy()
  expect(screen.queryByText(CONFIRM)).toBeNull()
  expect(dictionaryImportRecovery.prepare).not.toHaveBeenCalled()
})

it('keeps an orphaned retained import reachable from the collection screen without exposing another owner', () => {
  const orphan = { ...word, collection_id: null }
  useApplicationStore.getState().words = [
    orphan,
    {
      ...word,
      word_id: 'foreign-card',
      user_id: 'foreign',
      dutch_lemma: 'secret-word',
    },
  ]
  const link = render(<DictionaryImportRecoveryLink />)
  fireEvent.press(link.getByText('Saved imports (1)'))
  expect(router.push).toHaveBeenCalledWith(ROUTES.DICTIONARY_RECOVERY)
  const screen = render(<DictionaryRecoveryScreen />)
  expect(screen.getByText(new RegExp(word.dutch_lemma))).toBeTruthy()
  expect(screen.queryByText(/secret-word/)).toBeNull()
  expect(screen.getByText(READ)).toBeTruthy()
})

it('has no recovery write path without an existing owned target', async () => {
  useApplicationStore.getState().collections = []
  const screen = render(<DictionaryImportConflictResolver word={word} />)
  fireEvent.press(screen.getByText(READ))
  await waitFor(() =>
    expect(
      screen.getByText('No existing collection is available for recovery.')
    ).toBeTruthy()
  )
  fireEvent.press(screen.getByText(CONFIRM))
  expect(dictionaryImportRecovery.prepare).not.toHaveBeenCalled()
})

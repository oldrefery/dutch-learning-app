import React from 'react'
import { fireEvent, render, waitFor } from '@testing-library/react-native'
import { DictionaryImportConflictResolver } from '../DictionaryImportConflictResolver'
import { dictionaryImportSync } from '@/services/dictionaryImportSync'
import { syncManager } from '@/services/syncManager'
import { useApplicationStore } from '@/stores/useApplicationStore'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { createMockWord } from '@/__tests__/helpers/factories'
import type { Word } from '@/types/database'

jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryContentEnabled: () => true,
}))
jest.mock('@/hooks/useNormalizedColorScheme', () => ({
  useNormalizedColorScheme: jest.fn(() => 'light'),
}))
jest.mock('@/services/dictionaryImportSync', () => ({
  dictionaryImportSync: { retryConflict: jest.fn() },
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
const RETRY = 'Retry saved import'
const word = createMockWord({
  user_id: 'owner',
  word_id: 'word',
  dictionary_import_conflict: true,
})
beforeEach(() => {
  jest.clearAllMocks()
  useApplicationStore.getState().currentUserId = word.user_id
  useApplicationStore.getState().words = [word]
  jest.mocked(dictionaryImportSync.retryConflict).mockResolvedValue()
})

it.each(['light', 'dark'] as const)(
  'requires an explicit retry in %s theme and preserves the local card',
  async theme => {
    jest.mocked(useNormalizedColorScheme).mockReturnValue(theme)
    const screen = render(<DictionaryImportConflictResolver word={word} />)
    expect(dictionaryImportSync.retryConflict).not.toHaveBeenCalled()
    fireEvent.press(screen.getByText(RETRY))
    await waitFor(() =>
      expect(syncManager.performSync).toHaveBeenCalledWith(word.user_id)
    )
    expect(dictionaryImportSync.retryConflict).toHaveBeenCalledWith(
      word.user_id,
      word.word_id
    )
    expect(useApplicationStore.getState().words).toEqual([word])
  }
)

it('retains the conflict and displays the reason when the other card still exists', async () => {
  const reason =
    'The other card still exists. Your local history remains saved.'
  jest
    .mocked(dictionaryImportSync.retryConflict)
    .mockRejectedValue(new Error(reason))
  const screen = render(<DictionaryImportConflictResolver word={word} />)
  fireEvent.press(screen.getByText(RETRY))
  await waitFor(() => expect(screen.getByText(reason)).toBeTruthy())
  expect(syncManager.performSync).not.toHaveBeenCalled()
  expect(useApplicationStore.getState().words).toEqual([word])
})

it('hides stale conflict controls after account change or card deletion', () => {
  const screen = render(<DictionaryImportConflictResolver word={word} />)
  useApplicationStore.getState().currentUserId = 'another-owner'
  screen.rerender(<DictionaryImportConflictResolver word={word} />)
  expect(screen.queryByText(RETRY)).toBeNull()
  useApplicationStore.getState().currentUserId = word.user_id
  useApplicationStore.getState().words = []
  screen.rerender(<DictionaryImportConflictResolver word={word} />)
  expect(screen.queryByText(RETRY)).toBeNull()
})

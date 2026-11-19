import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { randomUUID } from 'crypto'
import { clearPersistentBatchCapture } from './usePersistentBatchCapture'
import { BatchCaptureWorkspace } from './BatchCaptureWorkspace'
import { analyzeForCollection } from '@/features/analysis/analyze-for-collection'
import { saveWordToCollection } from '@/features/analysis/actions'
import { parseWordAnalysis } from '@/features/analysis/analysis-contract'
import {
  transferSession,
  TRANSFER_OTHER,
  TRANSFER_OWNER,
} from '@/features/sharing/__fixtures__/following-transfer'

jest.mock('@/features/analysis/analyze-for-collection', () => ({
  analyzeForCollection: jest.fn(),
}))
jest.mock('@/features/analysis/actions', () => ({
  saveWordToCollection: jest.fn(),
  findOwnedSemanticDuplicate: jest.fn(),
}))
jest.mock('./actions', () => ({ findOwnedLemmaDuplicateForBatch: jest.fn() }))
jest.mock('@/features/words/AudioButton', () => ({ AudioButton: () => null }))
jest.mock('@/features/settings/useWebSettings', () => ({
  useWebSettings: () => ({
    isHydrated: true,
    settings: { lastSelectedCollectionId: null },
  }),
}))

beforeEach(() => {
  jest.clearAllMocks()
  clearPersistentBatchCapture()
})

async function startBatch(autoSave = false, ambiguous = false) {
  Object.defineProperty(window.crypto, 'randomUUID', {
    configurable: true,
    value: randomUUID,
  })
  delete process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED
  const original = transferSession().document
  const first = original.entries[0]
  const second = {
    ...first,
    content: { ...first.content, translations: { en: ['household'], ru: [] } },
  }
  const document = {
    ...original,
    entries: ambiguous ? [first, second] : [first],
  }
  jest
    .mocked(analyzeForCollection)
    .mockResolvedValueOnce({ kind: 'published', document })
    .mockResolvedValueOnce({
      kind: 'analysis',
      analysis: parseWordAnalysis({
        ...document.entries[0].content,
        dutch_lemma: 'fiets',
      }),
      metadata: {
        source: 'gemini',
        cacheHit: false,
        forceRefresh: false,
        usageCount: null,
      },
    })
  jest
    .mocked(saveWordToCollection)
    .mockResolvedValue({ success: true, wordId: 'saved' })
  render(
    <BatchCaptureWorkspace
      userId={TRANSFER_OWNER}
      collections={[{ id: TRANSFER_OTHER, name: 'Dutch' }]}
      followingEnabled
    />
  )
  fireEvent.change(screen.getByLabelText('Dutch words'), {
    target: { value: 'huis\nfiets' },
  })
  if (autoSave) {
    fireEvent.click(
      screen.getByRole('checkbox', { name: /Automatically save ready words/ })
    )
  }
  await act(async () => {
    fireEvent.click(
      screen.getByRole('button', {
        name: autoSave ? 'Analyze and save 2 words' : 'Analyze 2 words',
      })
    )
  })
}

it('analyzes the entire list before saving all ready results on one click', async () => {
  await startBatch()
  const save = await screen.findByRole('button', { name: 'Save 2 ready words' })
  expect(analyzeForCollection).toHaveBeenCalledTimes(2)
  expect(saveWordToCollection).not.toHaveBeenCalled()
  fireEvent.click(save)
  await screen.findByText('0 ready · 2 saved · 0 remaining')
  expect(saveWordToCollection).toHaveBeenCalledTimes(2)
})

it('automatically saves ready results after analyzing the entire list', async () => {
  await startBatch(true)
  await screen.findByText('0 ready · 2 saved · 0 remaining')
  expect(analyzeForCollection).toHaveBeenCalledTimes(2)
  expect(saveWordToCollection).toHaveBeenCalledTimes(2)
})

it('continues after a save failure and retries only the unsaved result', async () => {
  await startBatch()
  jest
    .mocked(saveWordToCollection)
    .mockResolvedValueOnce({ success: false, message: 'Try again' })
    .mockResolvedValue({ success: true, wordId: 'saved' })
  fireEvent.click(
    await screen.findByRole('button', { name: 'Save 2 ready words' })
  )
  await screen.findByText('1 ready · 1 saved · 1 remaining')
  await screen.findByText('Try again')
  fireEvent.click(screen.getByRole('button', { name: 'Save 1 ready word' }))
  await waitFor(() =>
    expect(
      screen.getByText('0 ready · 2 saved · 0 remaining')
    ).toBeInTheDocument()
  )
  expect(saveWordToCollection).toHaveBeenCalledTimes(3)
  expect(analyzeForCollection).toHaveBeenCalledTimes(2)
})

it('leaves ambiguous meanings for selection while automatically saving the rest', async () => {
  await startBatch(true, true)
  await screen.findByText('0 ready · 1 saved · 1 remaining')
  expect(saveWordToCollection).toHaveBeenCalledTimes(1)
  fireEvent.change(screen.getByLabelText('Meaning for huis'), {
    target: { value: '1' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save 1 ready word' }))
  await screen.findByText('0 ready · 2 saved · 0 remaining')
  expect(saveWordToCollection).toHaveBeenLastCalledWith(
    TRANSFER_OWNER,
    TRANSFER_OTHER,
    expect.stringContaining('household')
  )
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { randomUUID } from 'crypto'
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

it('previews each line and advances on save or skip, starting from Analyze', async () => {
  Object.defineProperty(window.crypto, 'randomUUID', {
    configurable: true,
    value: randomUUID,
  })
  delete process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED
  const original = transferSession().document
  const document = { ...original, entries: [original.entries[0]] }
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
  fireEvent.click(screen.getByRole('button', { name: 'Analyze 2 words' }))
  const save = await screen.findByRole('button', { name: 'Save personal copy' })
  expect(analyzeForCollection).toHaveBeenCalledTimes(1)
  expect(saveWordToCollection).not.toHaveBeenCalled()
  fireEvent.click(save)
  await screen.findByRole('button', { name: 'Approve and save' })
  const skip = screen.getByRole('button', { name: 'Skip this item' })
  expect(analyzeForCollection).toHaveBeenLastCalledWith(
    TRANSFER_OWNER,
    'fiets',
    true
  )
  fireEvent.click(skip)
  await waitFor(() =>
    expect(screen.getByText('1 saved · 0 remaining')).toBeInTheDocument()
  )
  expect(saveWordToCollection).toHaveBeenCalledTimes(1)
})

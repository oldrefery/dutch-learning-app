import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { randomUUID } from 'crypto'
import { refreshPublishedMeaning } from './refresh-published-meaning'
import { PublishedWordReview } from './PublishedWordReview'
import { saveWordToCollection } from './actions'
import { createWebFollowingImportService } from '@/features/sharing/following-import-client'
import {
  transferSession,
  TRANSFER_OWNER,
  TRANSFER_OTHER,
} from '@/features/sharing/__fixtures__/following-transfer'
jest.mock('./refresh-published-meaning', () => ({
  refreshPublishedMeaning: jest.fn(),
}))
jest.mock('./actions', () => ({ saveWordToCollection: jest.fn() }))
jest.mock('@/features/sharing/following-import-client', () => ({
  createWebFollowingImportService: jest.fn(),
}))
jest.mock('@/features/words/AudioButton', () => ({ AudioButton: () => null }))
afterEach(() => {
  delete process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED
})
it('imports the chosen published reference with the same intent on retry and never creates a private copy on failure', async () => {
  process.env.NEXT_PUBLIC_DICTIONARY_FOLLOWING_IMPORTS_ENABLED = 'true'
  Object.defineProperty(window.crypto, 'randomUUID', {
    configurable: true,
    value: randomUUID,
  })
  const original = transferSession().document
  const first = original.entries[0]
  const second = {
    content: { ...first.content, translations: { en: ['household'], ru: [] } },
    shared_reference: {
      ...first.shared_reference!,
      reference: { entry_id: randomUUID(), revision_id: randomUUID() },
    },
  }
  const prepare = jest.fn(async value => value)
  const deliver = jest
    .fn()
    .mockRejectedValueOnce(new Error('Offline'))
    .mockResolvedValueOnce({
      kind: 'import',
      result: { outcome: 'inserted', word_id: 'saved' },
    })
  jest
    .mocked(createWebFollowingImportService)
    .mockReturnValue({ prepare, deliver } as never)
  const onSaved = jest.fn()
  render(
    <PublishedWordReview
      document={{ ...original, entries: [first, second] }}
      collectionId={TRANSFER_OTHER}
      userId={TRANSFER_OWNER}
      onSaved={onSaved}
    />
  )
  fireEvent.change(screen.getByLabelText('Choose a meaning'), {
    target: { value: '1' },
  })
  expect(prepare).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: 'Save word' }))
  await screen.findByText('Offline')
  fireEvent.click(screen.getByRole('button', { name: 'Save word' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith('saved'))
  expect(prepare.mock.calls[0][0]).toMatchObject({
    user_id: TRANSFER_OWNER,
    request: { collection_id: TRANSFER_OTHER, source: second.shared_reference },
  })
  expect(prepare.mock.calls[1]).toEqual(prepare.mock.calls[0])
  expect(saveWordToCollection).not.toHaveBeenCalled()
})

it('refreshes the selected shared meaning without saving a personal word', async () => {
  const doc = transferSession().document
  const first = doc.entries[0]
  const second = {
    ...first,
    shared_reference: {
      ...first.shared_reference!,
      reference: { entry_id: randomUUID(), revision_id: randomUUID() },
    },
  }
  const updated = {
    ...second,
    content: {
      ...second.content,
      translations: { en: ['new shared analysis'], ru: [] },
    },
  }
  jest
    .mocked(refreshPublishedMeaning)
    .mockResolvedValue({ updated, message: 'Shared analysis published.' })
  const onUpdated = jest.fn()
  render(
    <PublishedWordReview
      document={{ ...doc, entries: [first, second] }}
      userId={TRANSFER_OWNER}
      collectionId=""
      onSaved={jest.fn()}
      onUpdated={onUpdated}
    />
  )
  fireEvent.change(screen.getByLabelText('Choose a meaning'), {
    target: { value: '1' },
  })
  fireEvent.click(
    screen.getByRole('button', { name: 'Refresh shared analysis' })
  )
  expect(await screen.findByRole('status')).toHaveTextContent(
    'Shared analysis published.'
  )
  expect(refreshPublishedMeaning).toHaveBeenCalledWith(TRANSFER_OWNER, second)
  expect(onUpdated).toHaveBeenCalledWith({ ...doc, entries: [first, updated] })
  expect(saveWordToCollection).not.toHaveBeenCalled()
})

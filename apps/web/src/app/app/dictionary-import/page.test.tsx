import { render, screen } from '@testing-library/react'
import { notFound } from 'next/navigation'
import { requireAuthContext } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { getTransferContext } from '@/features/sharing/dictionary-transfer-commands'
import {
  getOwnedCollectionDetail,
  listCollectionOverviews,
  getReviewStreak,
} from '@/features/collections/repository'
import {
  OWNER,
  OTHER_OWNER,
  TARGET,
} from '@/features/sharing/__fixtures__/dictionary-transfer'
import DictionaryImportPage from './page'
import CollectionDetailPage from '../collections/[collectionId]/page'
import CollectionsPage from '../collections/page'

jest.mock('server-only', () => ({}))
jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('Not found')
  }),
}))
jest.mock('@/lib/auth/session', () => ({ requireAuthContext: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/features/sharing/dictionary-transfer-commands', () => ({
  getTransferContext: jest.fn(),
}))
jest.mock('@/features/collections/repository', () => ({
  getOwnedCollectionDetail: jest.fn(),
  listCollectionOverviews: jest.fn(),
  getReviewStreak: jest.fn(),
}))
jest.mock('@/features/collections/CreateCollectionForm', () => ({
  CreateCollectionForm: () => null,
}))
jest.mock('@/features/collections/CollectionWordList', () => ({
  CollectionWordList: () => null,
}))
jest.mock('@/features/collections/DeleteCollectionForm', () => ({
  DeleteCollectionForm: () => null,
}))
jest.mock('@/features/collections/RenameCollectionForm', () => ({
  RenameCollectionForm: () => null,
}))
jest.mock('@/features/sharing/CollectionSharingPanel', () => ({
  CollectionSharingPanel: () => null,
}))
jest.mock('@/features/sharing/DictionaryExportPanel', () => ({
  DictionaryExportPanel: ({
    ownerId,
    collectionId,
  }: {
    ownerId: string
    collectionId: string
  }) => (
    <p>
      Export: {ownerId}/{collectionId}
    </p>
  ),
}))
jest.mock('@/features/sharing/DictionaryDocumentImport', () => {
  const React = jest.requireActual<typeof import('react')>('react')
  return {
    DictionaryDocumentImport: ({ ownerId }: { ownerId: string }) => {
      const [initialOwner] = React.useState(ownerId)
      return (
        <p>
          Import: {ownerId}/{initialOwner}
        </p>
      )
    },
  }
})
const priorFlag = process.env.DICTIONARY_CONTENT_ENABLED
beforeEach(() => {
  jest.clearAllMocks()
  process.env.DICTIONARY_CONTENT_ENABLED = 'true'
  jest.mocked(requireAuthContext).mockResolvedValue({
    userId: OWNER,
    email: 'fixture@example.invalid',
    accessLevel: 'readonly',
  } as never)
  jest.mocked(createClient).mockResolvedValue({} as never)
  jest.mocked(getTransferContext).mockResolvedValue({
    collections: [{ id: TARGET, name: 'Owned' }],
    existingWords: [],
  })
  jest.mocked(getOwnedCollectionDetail).mockResolvedValue({
    id: TARGET,
    name: 'Owned',
    words: [],
    totalWords: 0,
    masteredWords: 0,
    dueWords: 0,
    progressPercentage: 0,
    isShared: false,
  } as never)
  jest.mocked(listCollectionOverviews).mockResolvedValue([])
  jest.mocked(getReviewStreak).mockResolvedValue(0)
})
afterAll(() => {
  if (priorFlag === undefined) delete process.env.DICTIONARY_CONTENT_ENABLED
  else process.env.DICTIONARY_CONTENT_ENABLED = priorFlag
})
it('mounts the production document importer for an authenticated readonly owner', async () => {
  render(await DictionaryImportPage())
  expect(screen.getByText(`Import: ${OWNER}/${OWNER}`)).toBeVisible()
  expect(getTransferContext).toHaveBeenCalledWith({}, OWNER)
})
it('defaults the import route to not found before context access', async () => {
  delete process.env.DICTIONARY_CONTENT_ENABLED
  await expect(DictionaryImportPage()).rejects.toThrow('Not found')
  expect(notFound).toHaveBeenCalled()
  expect(getTransferContext).not.toHaveBeenCalled()
})
it('does not expose an import when authentication redirects', async () => {
  jest.mocked(requireAuthContext).mockRejectedValue(new Error('Redirect login'))
  await expect(DictionaryImportPage()).rejects.toThrow('Redirect login')
  expect(getTransferContext).not.toHaveBeenCalled()
})
it('keys importer state by owner so refreshed pages cannot retain another account document', async () => {
  const view = render(await DictionaryImportPage())
  jest.mocked(requireAuthContext).mockResolvedValue({
    userId: OTHER_OWNER,
    email: null,
    accessLevel: 'readonly',
  } as never)
  view.rerender(await DictionaryImportPage())
  expect(
    screen.getByText(`Import: ${OTHER_OWNER}/${OTHER_OWNER}`)
  ).toBeVisible()
  expect(
    screen.queryByText(`Import: ${OTHER_OWNER}/${OWNER}`)
  ).not.toBeInTheDocument()
})
it.each([true, false])(
  'connects collection settings and overview navigation only when enabled: %s',
  async enabled => {
    process.env.DICTIONARY_CONTENT_ENABLED = String(enabled)
    const detail = render(
      await CollectionDetailPage({
        params: Promise.resolve({ collectionId: TARGET }),
      })
    )
    expect(Boolean(screen.queryByText(`Export: ${OWNER}/${TARGET}`))).toBe(
      enabled
    )
    detail.unmount()
    render(await CollectionsPage())
    expect(Boolean(screen.queryByRole('link', { name: 'Import JSON' }))).toBe(
      enabled
    )
    if (enabled)
      expect(screen.getByRole('link', { name: 'Import JSON' })).toHaveAttribute(
        'href',
        '/app/dictionary-import'
      )
  }
)

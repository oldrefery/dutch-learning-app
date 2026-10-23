import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import { SharedCollectionImport } from './SharedCollectionImport'
import SharedCollectionPage from '@/app/share/[shareToken]/page'
import { requireAuthContext } from '@/lib/auth/session'
import { getSharedCollectionImportContext } from './repository'
import { DictionaryFollowingTransferPanel } from './DictionaryFollowingTransferPanel'
import { importSharedCollection } from './actions'
import {
  TRANSFER_OWNER,
  TRANSFER_OTHER,
  transferSession,
} from './__fixtures__/following-transfer'
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  notFound: () => {
    throw new Error('Not found')
  },
}))
jest.mock('./actions', () => ({ importSharedCollection: jest.fn() }))
jest.mock('./repository', () => ({
  getSharedCollectionImportContext: jest.fn(),
}))
jest.mock('@/lib/auth/session', () => ({ requireAuthContext: jest.fn() }))
jest.mock('./DictionaryFollowingTransferPanel', () => ({
  DictionaryFollowingTransferPanel: jest.fn(() => (
    <div>Retained shared panel</div>
  )),
}))
const original = {
  schema_version: 2 as const,
  collection: { collection_id: TRANSFER_OTHER, name: 'Shared' },
  words: [
    { ...transferSession().document.entries[0], word_id: TRANSFER_OWNER },
  ],
}
const props = {
  shareToken: TRANSFER_OTHER,
  collectionName: 'Shared',
  collections: [{ id: TRANSFER_OTHER, name: 'Owned' }],
  words: [
    {
      id: TRANSFER_OWNER,
      dutchLemma: 'huis',
      article: 'het',
      partOfSpeech: 'noun',
      translation: 'house',
      isDuplicate: true,
      duplicateCollectionName: 'Owned',
    },
  ],
}
beforeEach(() => {
  jest.clearAllMocks()
  jest
    .mocked(DictionaryFollowingTransferPanel)
    .mockImplementation(() => <div>Retained shared panel</div>)
})
it('routes all original meanings to the retained flow even with a legacy spelling duplicate', () => {
  render(
    <SharedCollectionImport
      {...props}
      ownerId={TRANSFER_OWNER}
      followingEnabled
      sharedCollection={original}
    />
  )
  expect(screen.getByText('Retained shared panel')).toBeInTheDocument()
  expect(
    jest.mocked(DictionaryFollowingTransferPanel).mock.calls[0][0]
  ).toMatchObject({
    ownerId: TRANSFER_OWNER,
    sharedSource: { shareToken: props.shareToken, original },
    followingEnabled: true,
  })
  expect(importSharedCollection).not.toHaveBeenCalled()
  expect(
    screen.queryByRole('button', { name: 'Import 0 words' })
  ).not.toBeInTheDocument()
})
it.each(['owner', 'source'] as const)(
  'fails closed with a missing %s without a private form',
  field => {
    render(
      <SharedCollectionImport
        {...props}
        followingEnabled
        ownerId={field === 'owner' ? undefined : TRANSFER_OWNER}
        sharedCollection={field === 'source' ? undefined : original}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Reload')
    expect(DictionaryFollowingTransferPanel).not.toHaveBeenCalled()
  }
)
it('retains the old duplicate-aware form with following opt-in off', () => {
  render(<SharedCollectionImport {...props} />)
  expect(screen.getByRole('button', { name: 'Import 0 words' })).toBeDisabled()
  expect(DictionaryFollowingTransferPanel).not.toHaveBeenCalled()
})
it('passes the captured owner and full v2 snapshot from the route', async () => {
  jest
    .mocked(requireAuthContext)
    .mockResolvedValue({ userId: TRANSFER_OWNER } as never)
  jest.mocked(getSharedCollectionImportContext).mockResolvedValue({
    collection: original.collection,
    collections: props.collections,
    previewWords: [],
    followingShared: original,
  })
  render(
    await SharedCollectionPage({
      params: Promise.resolve({ shareToken: props.shareToken }),
    })
  )
  expect(getSharedCollectionImportContext).toHaveBeenCalledWith(
    TRANSFER_OWNER,
    props.shareToken
  )
  expect(
    jest.mocked(DictionaryFollowingTransferPanel).mock.calls[0][0]
  ).toMatchObject({
    ownerId: TRANSFER_OWNER,
    sharedSource: { shareToken: props.shareToken, original },
  })
})

it('remounts the retained panel for another owner or share token', () => {
  jest
    .mocked(DictionaryFollowingTransferPanel)
    .mockImplementation(({ ownerId, sharedSource }) => {
      const [captured] = useState(`${ownerId}:${sharedSource?.shareToken}`)
      return <div>{captured}</div>
    })
  const view = render(
    <SharedCollectionImport
      {...props}
      ownerId={TRANSFER_OWNER}
      followingEnabled
      sharedCollection={original}
    />
  )
  expect(
    screen.getByText(`${TRANSFER_OWNER}:${props.shareToken}`)
  ).toBeInTheDocument()
  view.rerender(
    <SharedCollectionImport
      {...props}
      ownerId={TRANSFER_OTHER}
      followingEnabled
      sharedCollection={original}
    />
  )
  expect(
    screen.getByText(`${TRANSFER_OTHER}:${props.shareToken}`)
  ).toBeInTheDocument()
  view.rerender(
    <SharedCollectionImport
      {...props}
      shareToken={TRANSFER_OWNER}
      ownerId={TRANSFER_OTHER}
      followingEnabled
      sharedCollection={original}
    />
  )
  expect(
    screen.getByText(`${TRANSFER_OTHER}:${TRANSFER_OWNER}`)
  ).toBeInTheDocument()
})

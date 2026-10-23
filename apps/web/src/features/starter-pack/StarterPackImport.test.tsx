import { render, screen } from '@testing-library/react'
import { StarterPackImport } from './StarterPackImport'
import {
  loadBundledOfficialManifest,
  toStarterPackManifest,
} from './starter-pack-domain'
import { DictionaryFollowingTransferPanel } from '@/features/sharing/DictionaryFollowingTransferPanel'
import { importStarterPack } from './actions'
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('./actions', () => ({ importStarterPack: jest.fn() }))
jest.mock('@/features/sharing/DictionaryFollowingTransferPanel', () => ({
  DictionaryFollowingTransferPanel: jest.fn(() => (
    <div>Official shared pack panel</div>
  )),
}))
const raw = loadBundledOfficialManifest()
const manifest = toStarterPackManifest(raw)
const props = {
  canCreateCollection: true,
  collections: [{ id: 'owned', name: 'Owned' }],
  entries: [
    {
      entry: manifest.entries[0],
      isDuplicate: true,
      duplicateCollectionName: 'Owned',
    },
  ],
  packId: manifest.packId,
  packTitle: manifest.title,
  packVersion: manifest.version,
}
beforeEach(() => jest.clearAllMocks())
it('routes following packs with every original entry despite legacy spelling duplicates', () => {
  render(
    <StarterPackImport
      {...props}
      ownerId="owner"
      followingEnabled
      officialManifest={raw}
    />
  )
  expect(screen.getByText('Official shared pack panel')).toBeInTheDocument()
  expect(
    jest.mocked(DictionaryFollowingTransferPanel).mock.calls[0][0]
  ).toMatchObject({
    ownerId: 'owner',
    officialManifest: raw,
    collections: props.collections,
    followingEnabled: true,
  })
  expect(importStarterPack).not.toHaveBeenCalled()
  expect(
    screen.queryByRole('button', { name: 'Import 0 words' })
  ).not.toBeInTheDocument()
})
it.each(['owner', 'manifest'] as const)(
  'fails closed with missing %s instead of showing a private fallback',
  field => {
    render(
      <StarterPackImport
        {...props}
        followingEnabled
        ownerId={field === 'owner' ? undefined : 'owner'}
        officialManifest={field === 'manifest' ? undefined : raw}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent('unavailable')
    expect(DictionaryFollowingTransferPanel).not.toHaveBeenCalled()
    expect(importStarterPack).not.toHaveBeenCalled()
  }
)
it('retains the legacy preview when following mode is off', () => {
  render(<StarterPackImport {...props} />)
  expect(DictionaryFollowingTransferPanel).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Import 0 words' })).toBeDisabled()
})

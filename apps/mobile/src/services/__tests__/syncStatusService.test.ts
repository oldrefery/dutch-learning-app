import { wordRepository } from '@/db/wordRepository'
import { createMockWord } from '@/__tests__/helpers/factories'
import { syncStatusService } from '../syncStatusService'
import { getLastSyncTimestamp } from '@/utils/network'
import { dictionaryContentRepository } from '@/db/dictionaryContentRepository'
import { isDictionaryContentEnabled } from '@/constants/dictionaryContent'

jest.mock('@/constants/dictionaryContent', () => ({
  isDictionaryContentEnabled: jest.fn(() => false),
}))
jest.mock('@/db/dictionaryContentRepository', () => ({
  dictionaryContentRepository: {
    getPendingCommands: jest.fn(),
    getMissingCardWordIds: jest.fn(),
  },
}))

jest.mock('@/utils/network', () => ({
  getLastSyncTimestamp: jest.fn(),
  isNetworkAvailable: jest.fn().mockResolvedValue(true),
}))
jest.mock('@/db/wordRepository', () => ({
  wordRepository: {
    getWordsByUserId: jest.fn().mockResolvedValue([]),
    getPendingSyncWords: jest.fn().mockResolvedValue([]),
  },
}))
jest.mock('@/db/collectionRepository', () => ({
  collectionRepository: {
    getCollectionsByUserId: jest.fn().mockResolvedValue([]),
    getPendingSyncCollections: jest.fn().mockResolvedValue([]),
  },
}))
jest.mock('@/db/progressRepository', () => ({
  progressRepository: {
    getProgressByUserId: jest.fn().mockResolvedValue([]),
    getPendingSyncProgress: jest.fn().mockResolvedValue([]),
  },
}))

const SHARED_WORD_ID = 'shared-word'

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(isDictionaryContentEnabled).mockReturnValue(false)
  jest
    .mocked(dictionaryContentRepository.getPendingCommands)
    .mockResolvedValue([])
  jest
    .mocked(dictionaryContentRepository.getMissingCardWordIds)
    .mockResolvedValue([])
  jest.mocked(wordRepository.getPendingSyncWords).mockResolvedValue([])
})

it('reads the last successful sync only for the requested account', async () => {
  const timestamp = '2026-09-06T12:00:00.000Z'
  jest
    .mocked(getLastSyncTimestamp)
    .mockImplementation(async userId =>
      userId === 'user-1' ? timestamp : null
    )
  expect((await syncStatusService.getSnapshot('user-1')).lastSyncAt).toBe(
    timestamp
  )
  expect((await syncStatusService.getSnapshot('user-2')).lastSyncAt).toBeNull()
  expect(getLastSyncTimestamp).toHaveBeenNthCalledWith(1, 'user-1')
  expect(getLastSyncTimestamp).toHaveBeenNthCalledWith(2, 'user-2')
})

it('counts unresolved content edits even when legacy metadata was acknowledged', async () => {
  jest.mocked(isDictionaryContentEnabled).mockReturnValue(true)
  jest
    .mocked(dictionaryContentRepository.getPendingCommands)
    .mockResolvedValue([
      {
        sequence: 1,
        queued_at: '2026-09-21',
        status: 'conflict',
        last_error: 'stale',
        command: {
          protocol_version: 1,
          word_id: 'word',
          operation_id: 'operation',
          expected_content_version: 2,
          kind: 'edit-private',
          overrides: {},
        },
      },
    ])
  expect(await syncStatusService.getSnapshot('owner')).toMatchObject({
    pendingWords: 1,
    totalPending: 1,
  })
})

it('counts owner-scoped dictionary hydration debt after a dependency fetch fails', async () => {
  jest.mocked(isDictionaryContentEnabled).mockReturnValue(true)
  jest
    .mocked(dictionaryContentRepository.getPendingCommands)
    .mockResolvedValue([])
  jest
    .mocked(dictionaryContentRepository.getMissingCardWordIds)
    .mockResolvedValue(['linked-word'])

  expect(await syncStatusService.getSnapshot('hydration-owner')).toMatchObject({
    pendingWords: 1,
    totalPending: 1,
  })
  expect(
    dictionaryContentRepository.getMissingCardWordIds
  ).toHaveBeenCalledWith('hydration-owner')
})

it('counts each word once across metadata, content commands and hydration debt', async () => {
  jest.mocked(isDictionaryContentEnabled).mockReturnValue(true)
  jest.mocked(wordRepository.getPendingSyncWords).mockResolvedValue([
    {
      ...createMockWord({ word_id: SHARED_WORD_ID }),
      sync_status: 'pending',
      deleted_at: null,
      last_sync_attempt_at: null,
      synced_at: null,
    },
  ])
  jest
    .mocked(dictionaryContentRepository.getPendingCommands)
    .mockResolvedValue([
      {
        sequence: 1,
        queued_at: '2026-10-01',
        status: 'error',
        last_error: 'offline',
        command: {
          protocol_version: 1,
          word_id: SHARED_WORD_ID,
          operation_id: 'operation',
          expected_content_version: 2,
          kind: 'edit-private',
          overrides: {},
        },
      },
    ])
  jest
    .mocked(dictionaryContentRepository.getMissingCardWordIds)
    .mockResolvedValue([SHARED_WORD_ID, 'hydration-only', 'hydration-only'])
  expect(await syncStatusService.getSnapshot('owner')).toMatchObject({
    pendingWords: 2,
    totalPending: 2,
  })
})

it('isolates hydration debt by account and clears the status after recovery', async () => {
  jest.mocked(isDictionaryContentEnabled).mockReturnValue(true)
  jest
    .mocked(dictionaryContentRepository.getMissingCardWordIds)
    .mockImplementation(async owner => (owner === 'owner' ? ['word'] : []))
  expect((await syncStatusService.getSnapshot('owner')).totalPending).toBe(1)
  expect(
    (await syncStatusService.getSnapshot('other-owner')).totalPending
  ).toBe(0)
  jest
    .mocked(dictionaryContentRepository.getMissingCardWordIds)
    .mockResolvedValue([])
  expect((await syncStatusService.getSnapshot('owner')).totalPending).toBe(0)
})

it('does not read dictionary queues while the runtime feature is dormant', async () => {
  expect((await syncStatusService.getSnapshot('owner')).totalPending).toBe(0)
  expect(dictionaryContentRepository.getPendingCommands).not.toHaveBeenCalled()
  expect(
    dictionaryContentRepository.getMissingCardWordIds
  ).not.toHaveBeenCalled()
})

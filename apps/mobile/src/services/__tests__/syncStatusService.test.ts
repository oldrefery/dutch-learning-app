import { syncStatusService } from '../syncStatusService'
import { getLastSyncTimestamp } from '@/utils/network'

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

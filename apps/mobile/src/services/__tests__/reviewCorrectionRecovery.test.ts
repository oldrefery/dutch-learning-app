import { recoverConfirmedReviewCorrections } from '../reviewCorrectionRecovery'
import { reviewCorrectionRecoveryRepository as recovery } from '@/db/reviewCorrectionRecoveryRepository'
import { readCanonicalCorrectionProgress } from '../reviewCorrectionResolution'
jest.mock('@/db/reviewCorrectionRecoveryRepository')
jest.mock('../reviewCorrectionResolution')
const command = {
  correction_id: 'edit',
  user_id: 'qa',
  event_id: 'event',
  word_id: 'word',
  expected_revision: 0,
  assessment: 'hard' as const,
  status: 'synced' as const,
  resolved_at: null,
  error: null,
}
beforeEach(() => {
  jest.resetAllMocks()
  jest.mocked(recovery.pending).mockResolvedValue([command])
})
it('recovers a receipt acknowledged in a previous process even with no new uploads', async () => {
  jest.mocked(readCanonicalCorrectionProgress).mockResolvedValue(null)
  await recoverConfirmedReviewCorrections('qa')
  expect(recovery.finish).toHaveBeenCalledWith(command, null)
})
it('keeps the barrier on failed canonical reads', async () => {
  jest
    .mocked(readCanonicalCorrectionProgress)
    .mockRejectedValue(new Error('offline'))
  await expect(recoverConfirmedReviewCorrections('qa')).rejects.toThrow(
    'offline'
  )
  expect(recovery.finish).not.toHaveBeenCalled()
})
it('never automatically abandons pending or conflicting changes', async () => {
  jest.mocked(recovery.pending).mockResolvedValue([
    { ...command, status: 'pending' },
    { ...command, status: 'conflict' },
  ])
  await recoverConfirmedReviewCorrections('qa')
  expect(readCanonicalCorrectionProgress).not.toHaveBeenCalled()
  expect(recovery.finish).not.toHaveBeenCalled()
})

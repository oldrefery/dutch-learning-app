/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import {
  requireLegacyWordAnalysis,
  requireWordAnalysisAccess,
  saveAnalyzedWord,
} from './actions'
import { requireAuthContext } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('next/navigation', () => ({ redirect: jest.fn() }))
jest.mock('@/lib/auth/session', () => ({ requireAuthContext: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
const message = 'Use published shared meanings to add a word.'
beforeEach(() => {
  jest.clearAllMocks()
  process.env.DICTIONARY_CONTENT_ENABLED = 'true'
  process.env.DICTIONARY_FOLLOWING_ENABLED = 'true'
})
afterEach(() => {
  delete process.env.DICTIONARY_CONTENT_ENABLED
  delete process.env.DICTIONARY_FOLLOWING_ENABLED
})
it('keeps legacy editing fenced and requires full access for new analysis and personal saves', async () => {
  await expect(requireLegacyWordAnalysis()).rejects.toThrow(message)
  jest
    .mocked(requireAuthContext)
    .mockResolvedValue({ userId: 'owner', accessLevel: 'read_only' } as never)
  await expect(requireWordAnalysisAccess()).rejects.toThrow('Full access')
  expect(
    await saveAnalyzedWord({ status: 'idle', message: null }, new FormData())
  ).toMatchObject({
    status: 'error',
    message: expect.stringMatching(/Full access/),
  })
  expect(createClient).not.toHaveBeenCalled()
  jest
    .mocked(requireAuthContext)
    .mockResolvedValue({ userId: 'owner', accessLevel: 'full_access' } as never)
  await expect(requireWordAnalysisAccess()).resolves.toBeUndefined()
})
it('requires full access for legacy provider calls when following is OFF', async () => {
  process.env.DICTIONARY_FOLLOWING_ENABLED = 'false'
  jest
    .mocked(requireAuthContext)
    .mockResolvedValue({ userId: 'owner', accessLevel: 'read_only' } as never)
  await expect(requireLegacyWordAnalysis()).rejects.toThrow('Full access')
  jest
    .mocked(requireAuthContext)
    .mockResolvedValue({ userId: 'owner', accessLevel: 'full_access' } as never)
  await expect(requireLegacyWordAnalysis()).resolves.toBeUndefined()
  expect(createClient).not.toHaveBeenCalled()
})

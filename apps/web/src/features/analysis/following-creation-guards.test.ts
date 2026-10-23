/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import { requireLegacyWordAnalysis, saveAnalyzedWord } from './actions'
import { persistAnalyzedWord } from './persistence-repository'
import { requireAuthContext } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import type { WordAnalysis } from './analysis-contract'
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
it('rejects legacy analysis, image permission and private persistence before Auth or any database write in following mode', async () => {
  await expect(requireLegacyWordAnalysis()).rejects.toThrow(message)
  expect(
    await saveAnalyzedWord({ status: 'idle', message: null }, new FormData())
  ).toMatchObject({ status: 'error', message })
  expect(
    await persistAnalyzedWord('owner', 'collection', {} as WordAnalysis)
  ).toEqual({ success: false, code: 'insert', message })
  expect(requireAuthContext).not.toHaveBeenCalled()
  expect(createClient).not.toHaveBeenCalled()
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

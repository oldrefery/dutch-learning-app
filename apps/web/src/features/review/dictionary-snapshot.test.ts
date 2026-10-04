/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import { createClient } from '@/lib/supabase/server'
import { getReviewWorkspaceData } from './repository'
import {
  createWordRow,
  effectiveCard,
} from '@/features/dictionary/__fixtures__/cards'

jest.mock('server-only', () => ({}))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
const rpc = jest.fn()
const from = jest.fn()
const priorFlag = process.env.DICTIONARY_CONTENT_ENABLED
const snapshot = () => ({
  protocolVersion: 2,
  dictionaryContentProtocol: 1,
  correctionsAvailable: true,
  collections: [],
  events: [],
  words: [createWordRow({ repetition_count: 12 })],
  effectiveContent: [effectiveCard()],
})
beforeEach(() => {
  jest.resetAllMocks()
  process.env.DICTIONARY_CONTENT_ENABLED = 'true'
  jest
    .mocked(createClient)
    .mockResolvedValue({ rpc, from } as unknown as Awaited<
      ReturnType<typeof createClient>
    >)
})
afterAll(() => {
  if (priorFlag === undefined) delete process.env.DICTIONARY_CONTENT_ENABLED
  else process.env.DICTIONARY_CONTENT_ENABLED = priorFlag
})

it('loads content and learning in one v2 snapshot without capability or per-card requests', async () => {
  rpc.mockResolvedValue({ data: snapshot(), error: null })
  const result = await getReviewWorkspaceData('synthetic-owner')
  expect(result.words[0]).toMatchObject({
    id: createWordRow().word_id,
    repetitionCount: 12,
    translations: { en: ['dwelling'], ru: [] },
  })
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(rpc).toHaveBeenCalledWith('get_web_review_snapshot_v2')
  expect(from).not.toHaveBeenCalled()
})

it.each(['PGRST202', '42501', 'NETWORK'])(
  'does not downgrade an enabled snapshot on %s',
  async code => {
    rpc.mockResolvedValue({ data: null, error: { code } })
    await expect(getReviewWorkspaceData('synthetic-owner')).rejects.toThrow(
      'review workspace'
    )
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(from).not.toHaveBeenCalled()
  }
)

it('rejects an incomplete snapshot rather than showing obsolete content', async () => {
  rpc.mockResolvedValue({
    data: { ...snapshot(), effectiveContent: [] },
    error: null,
  })
  await expect(getReviewWorkspaceData('synthetic-owner')).rejects.toThrow(
    'dictionary content'
  )
})

it('keeps v1 and the original request count when the local feature is disabled', async () => {
  delete process.env.DICTIONARY_CONTENT_ENABLED
  rpc.mockResolvedValue({
    data: { ...snapshot(), protocolVersion: 1 },
    error: null,
  })
  const result = await getReviewWorkspaceData('synthetic-owner')
  expect(result.words[0].translations).toEqual({ en: ['house'], ru: ['дом'] })
  expect(rpc).toHaveBeenCalledTimes(1)
  expect(rpc).toHaveBeenCalledWith('get_web_review_snapshot_v1')
})

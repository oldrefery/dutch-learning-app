/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@woordenaar/supabase-contracts'
import { hydrateOwnedWords } from './repository'
import { followingBatch } from './__fixtures__/following'
import { createWordRow, effectiveCard } from './__fixtures__/cards'

jest.mock('server-only', () => ({}))
const rpc = jest.fn()
const client = { rpc } as unknown as SupabaseClient<Database>
const priorContent = process.env.DICTIONARY_CONTENT_ENABLED
const priorFollowing = process.env.DICTIONARY_FOLLOWING_ENABLED
beforeEach(() => {
  jest.resetAllMocks()
  process.env.DICTIONARY_CONTENT_ENABLED = 'true'
  process.env.DICTIONARY_FOLLOWING_ENABLED = 'true'
})
afterAll(() => {
  for (const [name, value] of [
    ['DICTIONARY_CONTENT_ENABLED', priorContent],
    ['DICTIONARY_FOLLOWING_ENABLED', priorFollowing],
  ]) {
    if (value === undefined) delete process.env[name!]
    else process.env[name!] = value
  }
})

it('uses three bounded v2 requests for 2105 following cards, with no per-card dependency fetch', async () => {
  const rows = Array.from({ length: 2105 }, (_, index) =>
    createWordRow({
      word_id: `44444444-4444-4444-8444-${index.toString(16).padStart(12, '0')}`,
      repetition_count: index,
    })
  )
  rpc.mockImplementation((_name: string, args: { p_word_ids: string[] }) =>
    Promise.resolve({ data: followingBatch(args.p_word_ids), error: null })
  )
  const result = await hydrateOwnedWords(client, rows)
  expect(rpc).toHaveBeenCalledTimes(3)
  expect(
    rpc.mock.calls.map(([name, args]) => [name, args.p_word_ids.length])
  ).toEqual([
    ['get_dictionary_effective_content_v2', 1000],
    ['get_dictionary_effective_content_v2', 1000],
    ['get_dictionary_effective_content_v2', 105],
  ])
  expect(result[2104]).toMatchObject({
    word_id: rows[2104].word_id,
    repetition_count: 2104,
    dictionary: { mode: 'follow', source: 'following' },
    translations: { en: ['dwelling'], ru: [] },
  })
})

it.each(['PGRST202', '42501', 'NETWORK'])(
  'fails without v1 fallback when an explicitly enabled v2 request returns %s',
  async code => {
    rpc.mockResolvedValue({ data: null, error: { code } })
    await expect(hydrateOwnedWords(client, [createWordRow()])).rejects.toThrow(
      'dictionary content'
    )
    expect(rpc).toHaveBeenCalledTimes(1)
    expect(rpc.mock.calls[0][0]).toBe('get_dictionary_effective_content_v2')
  }
)

it('rejects a substituted owner card without modifying the caller rows', async () => {
  const rows = [createWordRow()]
  const original = structuredClone(rows)
  rpc.mockResolvedValue({
    data: followingBatch(['55555555-5555-4555-8555-555555555555']),
    error: null,
  })
  await expect(hydrateOwnedWords(client, rows)).rejects.toThrow('incomplete')
  expect(rows).toEqual(original)
})

it('does not return partially hydrated data after a failed later batch', async () => {
  const rows = Array.from({ length: 1001 }, (_, index) =>
    createWordRow({
      word_id: `44444444-4444-4444-8444-${index.toString(16).padStart(12, '0')}`,
    })
  )
  rpc
    .mockResolvedValueOnce({
      data: followingBatch(rows.slice(0, 1000).map(row => row.word_id)),
      error: null,
    })
    .mockResolvedValueOnce({ data: null, error: { code: 'NETWORK' } })
  await expect(hydrateOwnedWords(client, rows)).rejects.toThrow(
    'dictionary content'
  )
  expect(
    rows.every(row => row.translations !== null && !('dictionary' in row))
  ).toBe(true)
  expect(rpc).toHaveBeenCalledTimes(2)
})

it('rejects an entry head that changes between two bounded requests', async () => {
  const rows = Array.from({ length: 1001 }, (_, index) =>
    createWordRow({
      word_id: `44444444-4444-4444-8444-${index.toString(16).padStart(12, '0')}`,
    })
  )
  const newer = followingBatch([rows[1000].word_id])
  newer.watermark = '9007199254740995'
  newer.cards[0].head_sequence = '9007199254740995'
  rpc
    .mockResolvedValueOnce({
      data: followingBatch(rows.slice(0, 1000).map(row => row.word_id)),
      error: null,
    })
    .mockResolvedValueOnce({ data: newer, error: null })
  await expect(hydrateOwnedWords(client, rows)).rejects.toThrow(
    'changed during loading'
  )
  expect(rows.every(row => !('dictionary' in row))).toBe(true)
})

it('leaves the entire content path dormant when only the following flag is set', async () => {
  delete process.env.DICTIONARY_CONTENT_ENABLED
  const rows = [createWordRow()]
  await expect(hydrateOwnedWords(client, rows)).resolves.toBe(rows)
  expect(rpc).not.toHaveBeenCalled()
})

it.each([undefined, 'false', 'TRUE', '1'])(
  'preserves protocol1 unless following is exactly enabled: %s',
  async flag => {
    if (flag === undefined) delete process.env.DICTIONARY_FOLLOWING_ENABLED
    else process.env.DICTIONARY_FOLLOWING_ENABLED = flag
    rpc.mockResolvedValue({
      data: { protocol_version: 1, cards: [effectiveCard()] },
      error: null,
    })
    const rows = [createWordRow()]
    const result = await hydrateOwnedWords(client, rows)
    expect(result[0].dictionary?.source).toBe('pinned')
    expect(rpc).toHaveBeenCalledWith('get_dictionary_effective_content_v1', {
      p_word_ids: [rows[0].word_id],
    })
    expect(rpc).toHaveBeenCalledTimes(1)
  }
)

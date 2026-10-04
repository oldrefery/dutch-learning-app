/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@woordenaar/supabase-contracts'
import { hydrateOwnedWords } from './repository'
import { createWordRow, effectiveCard } from './__fixtures__/cards'

jest.mock('server-only', () => ({}))
const rpc = jest.fn()
const client = { rpc } as unknown as SupabaseClient<Database>
const priorFlag = process.env.DICTIONARY_CONTENT_ENABLED
beforeEach(() => {
  jest.resetAllMocks()
  process.env.DICTIONARY_CONTENT_ENABLED = 'true'
})
afterAll(() => {
  if (priorFlag === undefined) delete process.env.DICTIONARY_CONTENT_ENABLED
  else process.env.DICTIONARY_CONTENT_ENABLED = priorFlag
})

it.each([undefined, 'false', '1'])(
  'leaves the dormant path unchanged: %s',
  flag => {
    if (flag === undefined) delete process.env.DICTIONARY_CONTENT_ENABLED
    else process.env.DICTIONARY_CONTENT_ENABLED = flag
    const rows = [createWordRow()]
    return expect(hydrateOwnedWords(client, rows))
      .resolves.toBe(rows)
      .then(() => expect(rpc).not.toHaveBeenCalled())
  }
)

it('hydrates 2105 cards in three bounded requests rather than one request per card', async () => {
  const rows = Array.from({ length: 2105 }, (_, index) =>
    createWordRow({ word_id: `word-${index}` })
  )
  rpc.mockImplementation((_name: string, args: { p_word_ids: string[] }) =>
    Promise.resolve({
      data: { protocol_version: 1, cards: args.p_word_ids.map(effectiveCard) },
      error: null,
    })
  )
  const result = await hydrateOwnedWords(client, rows)
  expect(rpc).toHaveBeenCalledTimes(3)
  expect(rpc.mock.calls.map(call => call[1].p_word_ids.length)).toEqual([
    1000, 1000, 105,
  ])
  expect(result.map(row => row.word_id)).toEqual(rows.map(row => row.word_id))
  expect(result[2104].translations).toEqual({ en: ['dwelling'], ru: [] })
})

it.each(['42501', 'PGRST202', 'NETWORK'])(
  'fails closed instead of downgrading enabled reads on %s',
  async code => {
    rpc.mockResolvedValue({ data: null, error: { code } })
    await expect(hydrateOwnedWords(client, [createWordRow()])).rejects.toThrow(
      'dictionary content'
    )
    expect(rpc).toHaveBeenCalledTimes(1)
  }
)

it('rejects an incomplete or substituted owner response', async () => {
  for (const cards of [[], [effectiveCard('foreign')]]) {
    rpc.mockResolvedValue({ data: { protocol_version: 1, cards }, error: null })
    await expect(hydrateOwnedWords(client, [createWordRow()])).rejects.toThrow(
      'incomplete'
    )
  }
})

it('does not request a dictionary snapshot for an empty list', async () => {
  await expect(hydrateOwnedWords(client, [])).resolves.toEqual([])
  expect(rpc).not.toHaveBeenCalled()
})

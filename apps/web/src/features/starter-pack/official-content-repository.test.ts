/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import bundledPack from '@woordenaar/content'
import { createClient } from '@/lib/supabase/server'
import { loadRemoteOfficialStarterPack } from './official-content-repository'

jest.mock('server-only', () => ({}))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))

const maybeSingle = jest.fn()
const query = {
  eq: jest.fn(),
  maybeSingle,
  select: jest.fn(),
}

beforeEach(() => {
  jest.resetAllMocks()
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  jest.mocked(createClient).mockResolvedValue({
    from: jest.fn(() => query),
  } as unknown as Awaited<ReturnType<typeof createClient>>)
})

it('rejects a database row that does not match the requested identity', async () => {
  const manifest = {
    ...structuredClone(bundledPack),
    pack_id: 'dutch-b1-01',
    version: '1.0.0',
  }
  maybeSingle.mockResolvedValue({
    data: {
      content_sha256: 'a'.repeat(64),
      manifest,
      pack_id: manifest.pack_id,
      version: manifest.version,
    },
    error: null,
  })

  await expect(
    loadRemoteOfficialStarterPack('dutch-a2-01', '1.0.0')
  ).rejects.toThrow('does not match the requested identity')
})

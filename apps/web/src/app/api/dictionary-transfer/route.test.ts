/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import { createClient } from '@/lib/supabase/server'
import { executeDictionaryTransfer } from '@/features/sharing/dictionary-transfer-commands'
import { MAX_TRANSFER_REQUEST_BYTES } from '@/features/sharing/dictionary-transfer-contract'
import {
  importCommand,
  OWNER,
  savedReply,
} from '@/features/sharing/__fixtures__/dictionary-transfer'
import { POST } from './route'

jest.mock('server-only', () => ({}))
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }))
jest.mock('@/features/sharing/dictionary-transfer-commands', () => ({
  executeDictionaryTransfer: jest.fn(),
}))
const getUser = jest.fn()
const client = { auth: { getUser } }
const priorFlag = process.env.DICTIONARY_CONTENT_ENABLED
const request = (
  body: string = JSON.stringify(importCommand),
  headers: Record<string, string> = {}
) =>
  new Request('http://localhost:55400/api/dictionary-transfer', {
    method: 'POST',
    body,
    headers: {
      host: 'localhost:55400',
      origin: 'http://localhost:55400',
      'content-type': 'application/json',
      ...headers,
    },
  })
beforeEach(() => {
  jest.resetAllMocks()
  process.env.DICTIONARY_CONTENT_ENABLED = 'true'
  jest.mocked(createClient).mockResolvedValue(client as never)
  getUser.mockResolvedValue({ data: { user: { id: OWNER } }, error: null })
  jest.mocked(executeDictionaryTransfer).mockResolvedValue(savedReply)
})
afterAll(() => {
  if (priorFlag === undefined) delete process.env.DICTIONARY_CONTENT_ENABLED
  else process.env.DICTIONARY_CONTENT_ENABLED = priorFlag
})
it('uses fresh server authentication and returns a non-cacheable bounded command response', async () => {
  const response = await POST(request())
  expect(response.status).toBe(200)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.json()).toEqual(savedReply)
  expect(executeDictionaryTransfer).toHaveBeenCalledWith(
    client,
    OWNER,
    importCommand
  )
})
it('stays unavailable by default before auth or mutation', async () => {
  delete process.env.DICTIONARY_CONTENT_ENABLED
  expect((await POST(request())).status).toBe(404)
  expect(createClient).not.toHaveBeenCalled()
})
it.each<Record<string, string>>([
  { origin: 'http://attacker.invalid' },
  { origin: '' },
  { 'content-type': 'text/plain' },
])('rejects cross-origin/non-JSON submissions before auth', async headers => {
  expect((await POST(request(undefined, headers))).status).toBe(403)
  expect(createClient).not.toHaveBeenCalled()
})
it('rejects an expired session before parsing or executing private content', async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: null })
  expect((await POST(request())).status).toBe(401)
  expect(executeDictionaryTransfer).not.toHaveBeenCalled()
})
it.each(['{', JSON.stringify({ ...importCommand, selectedIndexes: [100] })])(
  'rejects invalid documents or selections before execution',
  async body => {
    expect((await POST(request(body))).status).toBe(400)
    expect(executeDictionaryTransfer).not.toHaveBeenCalled()
  }
)
it('rejects an oversized declared request', async () => {
  expect(
    (
      await POST(
        request(undefined, {
          'content-length': String(MAX_TRANSFER_REQUEST_BYTES + 1),
        })
      )
    ).status
  ).toBe(400)
  expect(executeDictionaryTransfer).not.toHaveBeenCalled()
})
it('bounds actual streamed bytes even when Content-Length lies', async () => {
  const cancel = jest.fn()
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(MAX_TRANSFER_REQUEST_BYTES + 1))
    },
    cancel,
  })
  const streamed = {
    url: 'http://localhost:55400/api/dictionary-transfer',
    headers: request(undefined, { 'content-length': '1' }).headers,
    body,
  } as Request
  expect((await POST(streamed)).status).toBe(400)
  expect(cancel).toHaveBeenCalledTimes(1)
  expect(executeDictionaryTransfer).not.toHaveBeenCalled()
})
it('returns safe errors without disclosing upstream private diagnostics', async () => {
  jest
    .mocked(executeDictionaryTransfer)
    .mockRejectedValue(new Error('private row or token'))
  const response = await POST(request())
  expect(response.status).toBe(500)
  expect(JSON.stringify(await response.json())).not.toContain(
    'private row or token'
  )
})

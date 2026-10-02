/** @jest-environment node */
import type { IncomingMessage } from 'node:http'
import { Readable } from 'node:stream'
import { NodeNextRequest } from 'next/dist/server/base-http/node'
import { addRequestMeta } from 'next/dist/server/request-meta'
import { NextRequestAdapter } from 'next/dist/server/web/spec-extension/adapters/next-request'
import { createClient } from '@/lib/supabase/server'
import { executeDictionaryTransfer } from '@/features/sharing/dictionary-transfer-commands'
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

const priorFlag = process.env.DICTIONARY_CONTENT_ENABLED
beforeEach(() => {
  jest.clearAllMocks()
  process.env.DICTIONARY_CONTENT_ENABLED = 'true'
  jest.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: async () => ({ data: { user: { id: OWNER } }, error: null }),
    },
  } as never)
  jest.mocked(executeDictionaryTransfer).mockResolvedValue(savedReply)
})
afterAll(() => {
  if (priorFlag === undefined) delete process.env.DICTIONARY_CONTENT_ENABLED
  else process.env.DICTIONARY_CONTENT_ENABLED = priorFlag
})

function adaptedRequest(internalOrigin: string, publicOrigin: string) {
  const incoming = Object.assign(
    Readable.from([JSON.stringify(importCommand)]),
    {
      method: 'POST',
      url: '/api/dictionary-transfer',
      headers: {
        origin: publicOrigin,
        host: new URL(publicOrigin).host,
        'x-forwarded-host': new URL(publicOrigin).host,
        'content-type': 'application/json',
      },
    }
  ) as unknown as IncomingMessage
  const request = new NodeNextRequest(incoming)
  // NextNodeServer.attachRequestMeta constructs this from fetchHostname/port.
  addRequestMeta(
    request,
    'initURL',
    `${internalOrigin}/api/dictionary-transfer`
  )
  return NextRequestAdapter.fromNodeNextRequest(
    request,
    new AbortController().signal
  )
}

// Review baseline for ab8d603: valid same-origin requests fail before auth.
// Convert to acceptance assertions when repairing origin validation.
it.each([
  ['http://0.0.0.0:55400', 'http://localhost:55400', 'http://0.0.0.0:55400'],
  [
    'http://127.0.0.1:55400',
    'http://127.0.0.1:55400',
    'http://localhost:55400',
  ],
  [
    'https://internal.invalid:55400',
    'https://woordenaar.example',
    'https://internal.invalid:55400',
  ],
])(
  'reproduces rejection of a legitimate public origin: %s -> %s',
  async (internalOrigin, publicOrigin, adaptedOrigin) => {
    const request = adaptedRequest(internalOrigin, publicOrigin)
    expect(new URL(request.url).origin).toBe(adaptedOrigin)
    expect(request.headers.get('host')).toBe(new URL(publicOrigin).host)
    const response = await POST(request)
    expect(response.status).toBe(403)
    expect(createClient).not.toHaveBeenCalled()
    expect(executeDictionaryTransfer).not.toHaveBeenCalled()
    await request.body?.cancel()
  }
)

it('accepts the control case only when public and internal origins are identical', async () => {
  const response = await POST(
    adaptedRequest('http://localhost:55400', 'http://localhost:55400')
  )
  expect(response.status).toBe(200)
  expect(executeDictionaryTransfer).toHaveBeenCalledTimes(1)
})

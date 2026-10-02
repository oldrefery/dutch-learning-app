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
const priorSite = process.env.NEXT_PUBLIC_SITE_URL
const priorVercel = process.env.VERCEL_URL
beforeEach(() => {
  jest.clearAllMocks()
  process.env.DICTIONARY_CONTENT_ENABLED = 'true'
  delete process.env.NEXT_PUBLIC_SITE_URL
  delete process.env.VERCEL_URL
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
  if (priorSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
  else process.env.NEXT_PUBLIC_SITE_URL = priorSite
  if (priorVercel === undefined) delete process.env.VERCEL_URL
  else process.env.VERCEL_URL = priorVercel
})

function adaptedRequest(
  internalOrigin: string,
  publicOrigin: string,
  headers: Record<string, string> = {}
) {
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
        ...headers,
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

// Safety regressions converted from the ab8d603 review counterexamples.
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
  'accepts a legitimate public Host despite Next.js URL adaptation: %s -> %s',
  async (internalOrigin, publicOrigin, adaptedOrigin) => {
    const request = adaptedRequest(internalOrigin, publicOrigin)
    expect(new URL(request.url).origin).toBe(adaptedOrigin)
    expect(request.headers.get('host')).toBe(new URL(publicOrigin).host)
    const response = await POST(request)
    expect(response.status).toBe(200)
    expect(createClient).toHaveBeenCalledTimes(1)
    expect(executeDictionaryTransfer).toHaveBeenCalledWith(
      expect.anything(),
      OWNER,
      importCommand
    )
  }
)

it('keeps accepting the same-public/internal-localhost control case', async () => {
  const response = await POST(
    adaptedRequest('http://localhost:55400', 'http://localhost:55400')
  )
  expect(response.status).toBe(200)
  expect(executeDictionaryTransfer).toHaveBeenCalledTimes(1)
})

it.each([false, true])(
  'authenticates a forwarded public origin only with explicit deployment configuration: %s',
  async configured => {
    if (configured)
      process.env.NEXT_PUBLIC_SITE_URL = 'https://woordenaar.example'
    const request = adaptedRequest(
      'http://internal.invalid:55400',
      'https://woordenaar.example',
      {
        host: 'internal.invalid:55400',
        'x-forwarded-proto': 'https',
      }
    )
    expect((await POST(request)).status).toBe(configured ? 200 : 403)
    expect(createClient).toHaveBeenCalledTimes(configured ? 1 : 0)
    expect(executeDictionaryTransfer).toHaveBeenCalledTimes(configured ? 1 : 0)
    if (!configured) await request.body?.cancel()
  }
)

it.each<Record<string, string>>([
  { host: 'other.invalid' },
  { origin: 'null' },
  { 'x-forwarded-host': 'attacker.invalid' },
  { 'x-forwarded-host': 'localhost:55400, attacker.invalid' },
  { 'x-forwarded-proto': 'https,http' },
])(
  'rejects conflicting origin/host/proxy input before authentication',
  async headers => {
    const request = adaptedRequest(
      'http://localhost:55400',
      'http://localhost:55400',
      headers
    )
    expect((await POST(request)).status).toBe(403)
    expect(createClient).not.toHaveBeenCalled()
    expect(executeDictionaryTransfer).not.toHaveBeenCalled()
    await request.body?.cancel()
  }
)

/** @jest-environment @stryker-mutator/jest-runner/jest-env/node */
import { hasSameTransferOrigin } from './dictionary-transfer-origin'

jest.mock('server-only', () => ({}))
const previousSite = process.env.NEXT_PUBLIC_SITE_URL
const previousVercel = process.env.VERCEL_URL
beforeEach(() => {
  delete process.env.NEXT_PUBLIC_SITE_URL
  delete process.env.VERCEL_URL
})
afterAll(() => {
  if (previousSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL
  else process.env.NEXT_PUBLIC_SITE_URL = previousSite
  if (previousVercel === undefined) delete process.env.VERCEL_URL
  else process.env.VERCEL_URL = previousVercel
})
const request = (
  headers: Record<string, string | null> = {},
  url = 'http://localhost:55400/api/dictionary-transfer'
) => {
  const values = new Headers({
    host: 'localhost:55400',
    origin: 'http://localhost:55400',
  })
  for (const [name, value] of Object.entries(headers)) {
    if (value === null) values.delete(name)
    else values.set(name, value)
  }
  return new Request(url, { method: 'POST', headers: values })
}
it.each([
  ['http://127.0.0.1:55400', '127.0.0.1:55400'],
  ['http://[::1]:55400', '[::1]:55400'],
  ['http://localhost:55400', 'localhost:55400'],
])(
  'accepts the raw browser Host for a normalized request URL: %s',
  (origin, host) => {
    expect(hasSameTransferOrigin(request({ origin, host }))).toBe(true)
  }
)
it.each<Record<string, string | null>>([
  { origin: null },
  { origin: 'null' },
  { origin: 'https://attacker.invalid' },
  { origin: 'http://localhost:55400/path' },
  { origin: 'http://localhost:55400/' },
  { origin: 'http://user@localhost:55400' },
  { origin: 'ftp://localhost:55400' },
  { origin: 'http://localhost:55400?query=1' },
  { origin: 'http://localhost:55400#fragment' },
  { origin: 'http://localhost:55400, http://attacker.invalid' },
  { host: null },
  { host: 'attacker.invalid' },
  { host: 'localhost:55400, attacker.invalid' },
  { host: 'localhost:55400/path' },
  { host: 'user@localhost:55400' },
  { host: 'localhost:' },
  { host: 'localhost:99999' },
  { host: 'localhost:55400\\attacker.invalid' },
  { 'x-forwarded-host': 'attacker.invalid' },
  { 'x-forwarded-host': 'localhost:55400, attacker.invalid' },
  { 'x-forwarded-host': 'http://localhost:55400' },
  { 'x-forwarded-host': '' },
  { 'x-forwarded-proto': 'https' },
  { 'x-forwarded-proto': 'http,https' },
  { 'x-forwarded-proto': '' },
])(
  'rejects missing, malformed, cross-origin or conflicting headers',
  headers => {
    expect(hasSameTransferOrigin(request(headers))).toBe(false)
  }
)
it('accepts consistent forwarded headers without granting a proxy override', () => {
  expect(
    hasSameTransferOrigin(
      request({
        'x-forwarded-host': 'localhost:55400',
        'x-forwarded-proto': 'http',
      })
    )
  ).toBe(true)
})
const proxy = (headers: Record<string, string | null> = {}) =>
  request(
    {
      origin: 'https://woordenaar.example',
      host: 'internal.invalid:55400',
      'x-forwarded-host': 'woordenaar.example',
      'x-forwarded-proto': 'https',
      ...headers,
    },
    'http://internal.invalid:55400/api/dictionary-transfer'
  )
it('permits a different internal Host only for the explicitly configured public origin', () => {
  expect(hasSameTransferOrigin(proxy())).toBe(false)
  process.env.NEXT_PUBLIC_SITE_URL = 'https://woordenaar.example'
  expect(hasSameTransferOrigin(proxy())).toBe(true)
})
it('uses the configured Vercel origin when there is no explicit site origin', () => {
  process.env.VERCEL_URL = 'woordenaar.example'
  expect(hasSameTransferOrigin(proxy())).toBe(true)
  process.env.NEXT_PUBLIC_SITE_URL = 'https://different.example'
  expect(hasSameTransferOrigin(proxy())).toBe(false)
})
it.each<Record<string, string | null>>([
  {
    origin: 'https://attacker.invalid',
    'x-forwarded-host': 'attacker.invalid',
  },
  { 'x-forwarded-host': 'woordenaar.example, attacker.invalid' },
  { 'x-forwarded-host': null },
  { 'x-forwarded-proto': null },
  { 'x-forwarded-proto': 'http' },
  { host: null },
])(
  'does not let a configured proxy origin bless invalid or conflicting headers',
  headers => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://woordenaar.example'
    expect(hasSameTransferOrigin(proxy(headers))).toBe(false)
  }
)
it('permits TLS termination with preserved public Host only when explicitly configured', () => {
  const value = proxy({ host: 'woordenaar.example', 'x-forwarded-host': null })
  expect(hasSameTransferOrigin(value)).toBe(false)
  process.env.NEXT_PUBLIC_SITE_URL = 'https://woordenaar.example'
  expect(hasSameTransferOrigin(value)).toBe(true)
})
it.each(['https://woordenaar.example/path', '*', 'http://woordenaar.example'])(
  'fails closed for invalid proxy origin configuration: %s',
  site => {
    process.env.NEXT_PUBLIC_SITE_URL = site
    expect(hasSameTransferOrigin(proxy())).toBe(false)
  }
)

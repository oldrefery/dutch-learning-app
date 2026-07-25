import { sanitizeLogContext, sanitizeLogMessage } from '../logSanitizer'

const REDACTED = '[REDACTED]'

describe('logSanitizer', () => {
  it('redacts authentication, identity, session, and credential keys', () => {
    expect(
      sanitizeLogContext({
        jwt: 'jwt-secret',
        clientSecret: 'client-secret',
        credentials: 'credential-secret',
        session_id: 'session-secret',
        id_token: 'identity-secret',
        safe: 'visible',
      })
    ).toEqual({
      jwt: REDACTED,
      clientSecret: REDACTED,
      credentials: REDACTED,
      session_id: REDACTED,
      id_token: REDACTED,
      safe: 'visible',
    })
  })

  it('does not redact benign metric keys containing sensitive words', () => {
    expect(
      sanitizeLogContext({
        tokenCount: 3,
        maxTokens: 100,
        emailSent: true,
      })
    ).toEqual({
      tokenCount: 3,
      maxTokens: 100,
      emailSent: true,
    })
  })

  it('redacts standalone assignments, headers, JWTs, and email addresses', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEyMyJ9.signature123'
    const message = [
      'access_token=access-secret',
      'Authorization: Bearer bearer-secret',
      `jwt ${jwt}`,
      'user@example.com',
    ].join('\n')

    const sanitized = sanitizeLogMessage(message)

    expect(sanitized).not.toContain('access-secret')
    expect(sanitized).not.toContain('bearer-secret')
    expect(sanitized).not.toContain(jwt)
    expect(sanitized).not.toContain('user@example.com')
    expect(sanitized).not.toContain('\n')
  })

  it('does not invoke object accessors while sanitizing', () => {
    const getter = jest.fn(() => 'secret')
    const context = Object.defineProperty({}, 'value', {
      enumerable: true,
      get: getter,
    })

    expect(sanitizeLogContext(context)).toEqual({
      value: '[Accessor]',
    })
    expect(getter).not.toHaveBeenCalled()
  })

  it('handles invalid dates and hostile proxies without throwing', () => {
    const hostileProxy = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error('blocked')
        },
      }
    )

    expect(sanitizeLogContext(new Date('invalid'))).toBe('[Invalid Date]')
    expect(sanitizeLogContext(hostileProxy)).toBe('[Unserializable]')
  })

  it('detects cycles without treating shared references as circular', () => {
    const shared = { safe: 'visible' }
    const cyclic: { self?: unknown } = {}
    cyclic.self = cyclic

    expect(
      sanitizeLogContext({
        first: shared,
        second: shared,
        cyclic,
      })
    ).toEqual({
      first: { safe: 'visible' },
      second: { safe: 'visible' },
      cyclic: { self: '[Circular]' },
    })
  })

  it('sanitizes array values, holes, accessors, and cycles', () => {
    const getter = jest.fn(() => 'secret')
    const values: unknown[] = ['visible']
    Object.defineProperty(values, '1', {
      enumerable: true,
      get: getter,
    })
    values.length = 3
    values.push(values)

    expect(sanitizeLogContext(values)).toEqual([
      'visible',
      '[Accessor]',
      undefined,
      '[Circular]',
    ])
    expect(getter).not.toHaveBeenCalled()
  })

  it('normalizes supported non-JSON values', () => {
    const error = new Error('Failed for user@example.com')
    error.stack = undefined

    expect(
      sanitizeLogContext({
        bigint: BigInt(42),
        symbol: Symbol('safe'),
        callback: () => 'not called',
        validDate: new Date('2026-07-25T12:00:00.000Z'),
        error,
      })
    ).toEqual({
      bigint: '42',
      symbol: 'Symbol(safe)',
      callback: '[Function]',
      validDate: '2026-07-25T12:00:00.000Z',
      error: {
        name: 'Error',
        message: `Failed for ${REDACTED}`,
        stack: undefined,
      },
    })
  })

  it('stops traversing objects at the depth limit', () => {
    expect(
      sanitizeLogContext({
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  level6: {
                    secret: 'not-traversed',
                  },
                },
              },
            },
          },
        },
      })
    ).toEqual({
      level1: {
        level2: {
          level3: {
            level4: {
              level5: {
                level6: '[Truncated]',
              },
            },
          },
        },
      },
    })
  })

  it('bounds oversized strings after sanitization', () => {
    const sanitized = sanitizeLogMessage('a'.repeat(5000))

    expect(sanitized).toHaveLength(4096 + '[Truncated]'.length)
    expect(sanitized.endsWith('[Truncated]')).toBe(true)
  })
})

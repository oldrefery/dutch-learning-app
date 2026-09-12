import '@testing-library/jest-dom'
import { randomUUID } from 'node:crypto'
import { TextDecoder, TextEncoder } from 'node:util'

jest.mock('@/features/review/freshness-actions', () => ({
  flushReviewFreshness: jest.fn(async () => true),
}))

if (!globalThis.TextEncoder) {
  Object.assign(globalThis, { TextDecoder, TextEncoder })
}

if (!globalThis.crypto.randomUUID) {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    configurable: true,
    value: randomUUID,
  })
}

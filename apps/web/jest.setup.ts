import '@testing-library/jest-dom'
import { randomUUID } from 'node:crypto'

if (!globalThis.crypto.randomUUID) {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    configurable: true,
    value: randomUUID,
  })
}

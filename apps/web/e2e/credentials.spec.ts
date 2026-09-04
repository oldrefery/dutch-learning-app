import { expect, test } from '@playwright/test'
import { getE2ECredentials } from './support/credentials'

test('rejects the forbidden account and its Gmail aliases', () => {
  const originalEmail = process.env.WEB_E2E_EMAIL
  const originalPassword = process.env.WEB_E2E_PASSWORD

  try {
    process.env.WEB_E2E_PASSWORD = 'not-a-real-password'

    for (const email of [
      'oldrefery@gmail.com',
      'Old.Refery+e2e@googlemail.com',
    ]) {
      process.env.WEB_E2E_EMAIL = email
      expect(() => getE2ECredentials()).toThrow(
        'oldrefery@gmail.com must never be used for E2E testing.'
      )
    }
  } finally {
    if (originalEmail === undefined) delete process.env.WEB_E2E_EMAIL
    else process.env.WEB_E2E_EMAIL = originalEmail

    if (originalPassword === undefined) delete process.env.WEB_E2E_PASSWORD
    else process.env.WEB_E2E_PASSWORD = originalPassword
  }
})

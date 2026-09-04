const FORBIDDEN_EMAIL = 'oldrefery@gmail.com'

export interface E2ECredentials {
  email: string
  password: string
}

function isForbiddenAccount(email: string): boolean {
  const [rawLocalPart, rawDomain] = email.toLowerCase().split('@')
  if (!rawLocalPart || !rawDomain) return false

  const domain = rawDomain === 'googlemail.com' ? 'gmail.com' : rawDomain
  const localPart =
    domain === 'gmail.com'
      ? rawLocalPart.split('+')[0].replaceAll('.', '')
      : rawLocalPart

  return `${localPart}@${domain}` === FORBIDDEN_EMAIL
}

export function getE2ECredentials(): E2ECredentials {
  const email = process.env.WEB_E2E_EMAIL?.trim()
  const password = process.env.WEB_E2E_PASSWORD

  if (!email || !password) {
    throw new Error(
      'WEB_E2E_EMAIL and WEB_E2E_PASSWORD must identify a dedicated test account.'
    )
  }

  if (isForbiddenAccount(email)) {
    throw new Error(`${FORBIDDEN_EMAIL} must never be used for E2E testing.`)
  }

  return { email, password }
}

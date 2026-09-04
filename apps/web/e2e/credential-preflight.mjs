const forbiddenEmail = 'oldrefery@gmail.com'

const canonicalizeEmail = value => {
  const [rawLocalPart, rawDomain] = value.trim().toLowerCase().split('@')
  if (!rawLocalPart || !rawDomain) return value.trim().toLowerCase()

  const domain = rawDomain === 'googlemail.com' ? 'gmail.com' : rawDomain
  const localPart =
    domain === 'gmail.com'
      ? rawLocalPart.split('+')[0].replaceAll('.', '')
      : rawLocalPart

  return `${localPart}@${domain}`
}

const email = process.env.WEB_E2E_EMAIL
const password = process.env.WEB_E2E_PASSWORD

if (!email?.trim() || !password) {
  throw new Error(
    'WEB_E2E_EMAIL and WEB_E2E_PASSWORD must identify a dedicated test account.'
  )
}

if (canonicalizeEmail(email) === forbiddenEmail) {
  throw new Error(`${forbiddenEmail} must never be used for E2E testing.`)
}

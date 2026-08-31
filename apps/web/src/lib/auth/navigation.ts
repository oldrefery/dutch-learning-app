const DEFAULT_AUTHENTICATED_PATH = '/app/collections'
const INTERNAL_ORIGIN = 'https://woordenaar.invalid'

export const getSafeNextPath = (value: FormDataEntryValue | string | null) => {
  if (typeof value !== 'string' || !value.startsWith('/')) {
    return DEFAULT_AUTHENTICATED_PATH
  }

  try {
    const url = new URL(value, INTERNAL_ORIGIN)
    if (url.origin !== INTERNAL_ORIGIN) {
      return DEFAULT_AUTHENTICATED_PATH
    }

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return DEFAULT_AUTHENTICATED_PATH
  }
}

import 'server-only'
import { getSiteOrigin } from '@/lib/site-origin'

const protocol = (value: string | null) =>
  value === 'http' || value === 'https' ? `${value}:` : null

function parseOrigin(value: string | null): URL | null {
  if (!value) return null
  try {
    const url = new URL(value)
    return protocol(url.protocol.slice(0, -1)) && url.origin === value
      ? url
      : null
  } catch {
    return null
  }
}

function hostOrigin(value: string | null, scheme: string): string | null {
  if (!value || /[\s,/@\\?#%]/.test(value) || value.endsWith(':')) return null
  try {
    const url = new URL(`${scheme}//${value}`)
    return url.host && url.pathname === '/' ? url.origin : null
  } catch {
    return null
  }
}

function configuredProxyOrigin(): string | null {
  // The localhost fallback is not permission to trust forwarded headers.
  if (
    !process.env.NEXT_PUBLIC_SITE_URL?.trim() &&
    !process.env.VERCEL_URL?.trim()
  )
    return null
  try {
    return getSiteOrigin()
  } catch {
    return null
  }
}

/** Host is mandatory; a proxy override needs the explicit deployment origin. */
export function hasSameTransferOrigin(request: Request): boolean {
  const origin = parseOrigin(request.headers.get('origin'))
  if (!origin) return false
  let scheme: string
  try {
    scheme = new URL(request.url).protocol
  } catch {
    return false
  }
  if (!protocol(scheme.slice(0, -1))) return false
  const host = request.headers.get('host')
  const directOrigin = hostOrigin(host, scheme)
  if (!directOrigin) return false
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedScheme = protocol(forwardedProto)
  if (forwardedProto !== null && !forwardedScheme) return false
  if (
    forwardedHost !== null &&
    hostOrigin(forwardedHost, origin.protocol) !== origin.origin
  )
    return false

  if (
    directOrigin === origin.origin &&
    (forwardedProto === null || forwardedScheme === scheme)
  )
    return true

  // Proxy ingress must overwrite forwarding headers; only the configured public
  // origin may bridge a different internal Host or a terminated TLS connection.
  return (
    configuredProxyOrigin() === origin.origin &&
    forwardedScheme === origin.protocol &&
    hostOrigin(forwardedHost ?? host, origin.protocol) === origin.origin
  )
}

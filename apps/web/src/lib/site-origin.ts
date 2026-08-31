interface SiteOriginEnvironment {
  siteUrl?: string
  vercelUrl?: string
}

const parseOrigin = (value: string, variableName: string): string => {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${variableName} must be a valid absolute URL.`)
  }

  const isLocalHttp =
    url.protocol === 'http:' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  if (url.protocol !== 'https:' && !isLocalHttp) {
    throw new Error(`${variableName} must use HTTPS outside localhost.`)
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(`${variableName} must contain only an origin.`)
  }
  if (url.pathname !== '/') {
    throw new Error(`${variableName} must not include a path.`)
  }

  return url.origin
}

export const resolveSiteOrigin = ({
  siteUrl,
  vercelUrl,
}: SiteOriginEnvironment): string => {
  const configuredSiteUrl = siteUrl?.trim()
  if (configuredSiteUrl) {
    return parseOrigin(configuredSiteUrl, 'NEXT_PUBLIC_SITE_URL')
  }

  const configuredVercelUrl = vercelUrl?.trim()
  if (configuredVercelUrl) {
    const absoluteVercelUrl = configuredVercelUrl.startsWith('http')
      ? configuredVercelUrl
      : `https://${configuredVercelUrl}`
    return parseOrigin(absoluteVercelUrl, 'VERCEL_URL')
  }

  return 'http://localhost:3000'
}

export const getSiteOrigin = (): string =>
  resolveSiteOrigin({
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    vercelUrl: process.env.VERCEL_URL,
  })

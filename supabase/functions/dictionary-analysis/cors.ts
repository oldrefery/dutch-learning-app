export const withAnalysisCors = (
  handler: (request: Request) => Promise<Response>,
  origins: readonly string[]
) => {
  if (
    origins.length > 20 ||
    origins.some(origin => {
      try {
        const url = new URL(origin)
        return (
          url.origin !== origin ||
          !!url.username ||
          !!url.password ||
          (url.protocol !== 'https:' &&
            !(url.protocol === 'http:' && url.hostname === 'localhost'))
        )
      } catch {
        return true
      }
    })
  )
    throw new Error('invalid-endpoint-origins')
  const allowed = new Set(origins)
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('Origin')
    if (origin && !allowed.has(origin))
      return Response.json(
        { code: 'origin-not-allowed' },
        {
          status: 403,
          headers: { 'Cache-Control': 'no-store', Vary: 'Origin' },
        }
      )
    const response =
      request.method === 'OPTIONS' && origin
        ? new Response(null, { status: 204 })
        : await handler(request)
    if (origin) {
      response.headers.set('Access-Control-Allow-Origin', origin)
      response.headers.set('Access-Control-Allow-Methods', 'POST')
      response.headers.set(
        'Access-Control-Allow-Headers',
        'authorization, apikey, content-type, x-client-info'
      )
      response.headers.set('Vary', 'Origin')
      response.headers.set('Cache-Control', 'no-store')
    }
    return response
  }
}

const ENDPOINT = 'https://generativelanguage.googleapis.com/'

// Reachability only: no key, generation, redirects or retries. Run in the paid process.
export async function checkCreationConnectivity(request: typeof fetch = fetch) {
  try {
    const response = await request(ENDPOINT, {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    })
    await response.body?.cancel()
    if (response.status !== 404 || response.redirected)
      throw new Error('unexpected-connectivity-response')
  } catch {
    throw new Error('creation-connectivity-preflight-failed')
  }
}

import { getSafeNextPath } from './navigation'

describe('getSafeNextPath', () => {
  it('uses the collections route when no destination is provided', () => {
    expect(getSafeNextPath(null)).toBe('/app/collections')
  })

  it('keeps an internal path with query and hash values', () => {
    expect(getSafeNextPath('/app/review?scope=due#word')).toBe(
      '/app/review?scope=due#word'
    )
  })

  it.each([
    'https://example.com',
    '//example.com/path',
    '/\\example.com/path',
    'app/collections',
  ])('rejects unsafe destination %s', destination => {
    expect(getSafeNextPath(destination)).toBe('/app/collections')
  })
})

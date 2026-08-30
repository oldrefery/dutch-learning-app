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

  it('keeps a shared collection destination through authentication', () => {
    expect(
      getSafeNextPath(
        '/share/8c3616c6-d337-4e63-b0bf-a9dbb735a8b4?source=friend'
      )
    ).toBe('/share/8c3616c6-d337-4e63-b0bf-a9dbb735a8b4?source=friend')
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

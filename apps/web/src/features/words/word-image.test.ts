import { validateWordImageUrl } from './word-image'

describe('word image validation', () => {
  it('accepts configured image providers', () => {
    expect(
      validateWordImageUrl('https://images.unsplash.com/photo-1').value
    ).toBe('https://images.unsplash.com/photo-1')
    expect(
      validateWordImageUrl('https://picsum.photos/400/300').error
    ).toBeNull()
  })

  it('rejects untrusted and non-HTTPS image locations', () => {
    expect(validateWordImageUrl('https://example.com/image.jpg').error).toMatch(
      /image search/
    )
    expect(validateWordImageUrl('javascript:alert(1)').value).toBeNull()
  })
})

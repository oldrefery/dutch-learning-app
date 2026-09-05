/**
 * Smoke Test - verify Jest works with mocks
 */

describe('Smoke Test', () => {
  it('basic arithmetic works', () => {
    expect(1 + 1).toBe(2)
  })

  it('should pass simple assertions', () => {
    expect(true).toBe(true)
    expect([1, 2, 3]).toHaveLength(3)
  })

  it('jest is configured correctly', () => {
    expect(jest).toBeDefined()
  })
})

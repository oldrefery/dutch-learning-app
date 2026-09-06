import { parseDeleteAccountResponse } from './account-deletion'

describe('account deletion contract', () => {
  it('accepts the existing Edge Function success response', () => {
    expect(
      parseDeleteAccountResponse({
        success: true,
        message: 'Account successfully deleted',
      })
    ).toEqual({ success: true, error: null })
  })

  it('normalizes failed and malformed responses', () => {
    expect(
      parseDeleteAccountResponse({ success: false, error: 'Delete failed' })
    ).toEqual({ success: false, error: 'Delete failed' })
    expect(parseDeleteAccountResponse(null)).toEqual({
      success: false,
      error: 'Account deletion failed.',
    })
  })

  it.each([
    undefined,
    false,
    true,
    1,
    'success',
    [],
    [{ success: true }],
    {},
    { success: 'true' },
    { success: 1 },
    { error: 42 },
  ])('never reports deletion success for malformed payloads: %j', response => {
    expect(parseDeleteAccountResponse(response)).toEqual({
      success: false,
      error: 'Account deletion failed.',
    })
  })
})

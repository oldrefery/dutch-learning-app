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
})

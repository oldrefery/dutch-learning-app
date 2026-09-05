import { render, screen } from '@testing-library/react'
import { OAuthButtons } from './OAuthButtons'

describe('OAuthButtons', () => {
  test('preserves the requested destination for each provider', () => {
    render(<OAuthButtons nextPath="/app/search?query=de fiets" />)

    expect(
      screen.getByRole('link', { name: 'Continue with Google' })
    ).toHaveAttribute(
      'href',
      '/auth/oauth?provider=google&next=%2Fapp%2Fsearch%3Fquery%3Dde+fiets'
    )
    expect(
      screen.getByRole('link', { name: 'Continue with Apple' })
    ).toHaveAttribute(
      'href',
      '/auth/oauth?provider=apple&next=%2Fapp%2Fsearch%3Fquery%3Dde+fiets'
    )
  })
})

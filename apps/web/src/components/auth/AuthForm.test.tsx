import { render, screen } from '@testing-library/react'
import { useActionState } from 'react'
import type { AuthFormAction, AuthFormState } from '@/lib/auth/types'
import { INITIAL_AUTH_FORM_STATE } from '@/lib/auth/types'
import { AuthForm } from './AuthForm'

jest.mock('react', () => {
  const actual = jest.requireActual<typeof import('react')>('react')
  return { ...actual, useActionState: jest.fn() }
})

const mockUseActionState = jest.mocked(useActionState)
const action: AuthFormAction = async () => INITIAL_AUTH_FORM_STATE

const mockFormState = (
  state: AuthFormState = INITIAL_AUTH_FORM_STATE,
  pending = false
) => {
  mockUseActionState.mockReturnValue([state, jest.fn(), pending])
}

describe('AuthForm', () => {
  beforeEach(() => mockFormState())

  test.each([
    ['login', true, true, false, 'Sign in'],
    ['signup', true, true, true, 'Create account'],
    ['forgot-password', true, false, false, 'Send reset link'],
    ['reset-password', false, true, true, 'Update password'],
  ] as const)(
    'renders the %s field set',
    (mode, hasEmail, hasPassword, hasConfirmation, submitLabel) => {
      render(<AuthForm action={action} mode={mode} nextPath="/app/review" />)

      expect(Boolean(screen.queryByLabelText('Email'))).toBe(hasEmail)
      expect(
        Boolean(screen.queryByLabelText(/^(New password|Password)$/))
      ).toBe(hasPassword)
      expect(Boolean(screen.queryByLabelText('Confirm password'))).toBe(
        hasConfirmation
      )
      expect(screen.getByRole('button', { name: submitLabel })).toBeEnabled()
      expect(document.querySelector('input[name="next"]')).toHaveValue(
        '/app/review'
      )
    }
  )

  test('renders field and form errors accessibly', () => {
    mockFormState({
      status: 'error',
      message: 'Please correct the highlighted fields.',
      fieldErrors: {
        email: 'Enter a valid email.',
        password: 'Use at least six characters.',
        confirmPassword: 'Passwords do not match.',
      },
    })

    render(<AuthForm action={action} mode="signup" />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Please correct the highlighted fields.'
    )
    expect(screen.getByText('Enter a valid email.')).toBeVisible()
    expect(screen.getByText('Use at least six characters.')).toBeVisible()
    expect(screen.getByText('Passwords do not match.')).toBeVisible()
  })

  test('shows pending state and success status', () => {
    mockFormState({ status: 'success', message: 'Check your inbox.' }, true)

    render(<AuthForm action={action} mode="forgot-password" />)

    expect(screen.getByRole('status')).toHaveTextContent('Check your inbox.')
    expect(screen.getByRole('button', { name: 'Please wait…' })).toBeDisabled()
  })
})

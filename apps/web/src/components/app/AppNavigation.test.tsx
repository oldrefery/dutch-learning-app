import { act, render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import type { FormHTMLAttributes, ReactNode } from 'react'
import { AppNavigation } from './AppNavigation'
import { AuthenticatedShell } from './AuthenticatedShell'

jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}))

jest.mock('next/form', () => ({
  __esModule: true,
  default: ({
    children,
    className,
  }: Omit<FormHTMLAttributes<HTMLFormElement>, 'action'> & {
    action: unknown
    children: ReactNode
  }) => <form className={className}>{children}</form>,
}))

jest.mock('@/app/(auth)/actions', () => ({
  logout: jest.fn(),
}))

const mockUsePathname = jest.mocked(usePathname)
let online = true

describe('AppNavigation', () => {
  beforeAll(() => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => online,
    })
  })

  beforeEach(() => {
    online = true
    mockUsePathname.mockReturnValue('/app/collections')
  })

  test('shows full-access destinations and caps the due badge', () => {
    render(
      <AppNavigation
        accessLevel="full_access"
        dueCount={120}
        userLabel="learner@example.com"
      />
    )

    expect(screen.getAllByRole('link', { name: /Add word/ })).not.toHaveLength(
      0
    )
    expect(
      screen.getAllByRole('link', { name: /Batch capture/ })
    ).not.toHaveLength(0)
    expect(screen.getAllByText('99+')).not.toHaveLength(0)
    expect(
      screen.getByLabelText('Signed in as learner@example.com')
    ).toHaveTextContent('LE')
  })

  test('hides write destinations for read-only users', () => {
    render(
      <AppNavigation
        accessLevel="read_only"
        dueCount={0}
        userLabel="reader@example.com"
      />
    )

    expect(
      screen.queryByRole('link', { name: /Add word/ })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /Batch capture/ })
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /Insights/ })).not.toHaveLength(
      0
    )
    expect(screen.getByText('Read only')).toBeVisible()
  })

  test('renders search context and reacts to offline status', () => {
    mockUsePathname.mockReturnValue('/app/search')
    render(
      <AppNavigation
        accessLevel="full_access"
        dueCount={0}
        userLabel="learner@example.com"
      />
    )

    expect(screen.getByText('Find words across collections')).toBeVisible()
    expect(
      screen.getByLabelText('Synchronization status: synced')
    ).toBeVisible()

    act(() => {
      online = false
      window.dispatchEvent(new Event('offline'))
    })

    expect(
      screen.getByLabelText('Synchronization status: offline')
    ).toHaveTextContent('OFFLINE · CHANGES PAUSED')
  })

  test('derives a fallback account label in the authenticated shell', () => {
    render(
      <AuthenticatedShell
        auth={{
          accessLevel: 'full_access',
          email: '   ',
          userId: '12345678-abcd-4000-8000-123456789abc',
        }}
      >
        <h1>Workspace content</h1>
      </AuthenticatedShell>
    )

    expect(
      screen.getByRole('heading', { name: 'Workspace content' })
    ).toBeVisible()
    expect(screen.getByLabelText('Signed in as User 12345678')).toBeVisible()
  })
})

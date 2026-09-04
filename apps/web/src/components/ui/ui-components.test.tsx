import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createRef } from 'react'
import { Badge } from './Badge'
import { Button } from './Button'
import { Field } from './Field'
import { Progress } from './Progress'
import { SectionLabel } from './SectionLabel'

describe('UI components', () => {
  test('renders badge tones and custom classes', () => {
    const { rerender } = render(<Badge>New</Badge>)

    expect(screen.getByText('New')).toHaveClass('dw-chip')
    expect(screen.getByText('New')).not.toHaveClass('dw-chip--neutral')

    rerender(
      <Badge className="custom-chip" tone="success">
        Learned
      </Badge>
    )

    expect(screen.getByText('Learned')).toHaveClass(
      'dw-chip',
      'dw-chip--success',
      'custom-chip'
    )
  })

  test('disables a loading button and preserves button behavior', async () => {
    const handleClick = jest.fn()
    const user = userEvent.setup()
    const { rerender } = render(
      <Button
        className="custom-button"
        onClick={handleClick}
        variant="secondary"
      >
        Save
      </Button>
    )

    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toHaveClass(
      'dw-button',
      'dw-button--secondary',
      'custom-button'
    )
    await user.click(button)
    expect(handleClick).toHaveBeenCalledTimes(1)

    rerender(
      <Button loading onClick={handleClick}>
        Save
      </Button>
    )

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute(
      'aria-busy',
      'true'
    )
  })

  test('forwards field refs and input attributes', () => {
    const ref = createRef<HTMLInputElement>()
    render(
      <label>
        Dutch word
        <Field className="custom-field" defaultValue="woord" ref={ref} />
      </label>
    )

    expect(screen.getByLabelText('Dutch word')).toHaveClass(
      'dw-field',
      'custom-field'
    )
    expect(ref.current).toHaveValue('woord')
  })

  test('clamps progress values to the accessible range', () => {
    const { rerender } = render(<Progress label="Mastery" value={140} />)
    const progress = screen.getByRole('progressbar', { name: 'Mastery' })

    expect(progress).toHaveAttribute('aria-valuenow', '100')
    expect(progress.firstElementChild).toHaveStyle({ width: '100%' })

    rerender(<Progress label="Mastery" value={-5} />)
    expect(progress).toHaveAttribute('aria-valuenow', '0')
    expect(progress.firstElementChild).toHaveStyle({ width: '0%' })
  })

  test('renders section labels', () => {
    render(<SectionLabel>Recent words</SectionLabel>)
    expect(screen.getByText('Recent words')).toHaveClass(
      'dw-label',
      'dw-section-label'
    )
  })
})

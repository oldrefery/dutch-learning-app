import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImageOptionGrid } from './ImageOptionGrid'

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt, src }: { alt: string; src: string }) => (
    <span aria-label={alt} data-src={src} role="img" />
  ),
}))

describe('ImageOptionGrid', () => {
  test('filters unsafe images and reports the selected image', async () => {
    const onSelect = jest.fn()
    const user = userEvent.setup()
    render(
      <ImageOptionGrid
        currentImageUrl="https://images.unsplash.com/current"
        images={[
          { url: 'https://images.unsplash.com/current', alt: 'Current house' },
          { url: 'https://picsum.photos/next', alt: 'Another house' },
          { url: 'javascript:alert(1)', alt: 'Unsafe image' },
        ]}
        onSelect={onSelect}
      />
    )

    expect(screen.getByRole('button', { name: /Selected/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.queryByAltText('Unsafe image')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Another house/ }))
    expect(onSelect).toHaveBeenCalledWith('https://picsum.photos/next')
  })

  test('renders nothing when no image URL is safe', () => {
    const { container } = render(
      <ImageOptionGrid
        currentImageUrl={null}
        images={[{ url: 'data:text/plain,unsafe', alt: 'Unsafe' }]}
        onSelect={jest.fn()}
      />
    )

    expect(container).toBeEmptyDOMElement()
  })
})

import { render, screen } from '@testing-library/react'
import { CefrBadge } from './CefrBadge'
import type { DictionaryCardMetadata } from './content'

it.each(['light', 'dark'])(
  'shows explicit unknown, estimated and reviewed levels with theme tokens: %s',
  theme => {
    document.documentElement.dataset.theme = theme
    const dictionary: DictionaryCardMetadata = {
      contentVersion: 0,
      source: 'fallback',
      reference: null,
      cefr: { level: null, status: 'unknown', confidence: null },
    }
    const { rerender } = render(<CefrBadge dictionary={dictionary} />)
    expect(screen.getByText('CEFR unknown')).toHaveClass('dw-chip')
    rerender(
      <CefrBadge
        dictionary={{
          ...dictionary,
          cefr: { level: 'B2', status: 'estimated', confidence: 0.7 },
        }}
      />
    )
    expect(screen.getByText('B2 · estimated')).toBeVisible()
    rerender(
      <CefrBadge
        dictionary={{
          ...dictionary,
          cefr: { level: 'A1', status: 'reviewed', confidence: 1 },
        }}
      />
    )
    expect(screen.getByText('A1 · reviewed')).toHaveClass('dw-chip--success')
    rerender(<CefrBadge />)
    expect(
      screen.queryByText(/CEFR|reviewed|estimated/)
    ).not.toBeInTheDocument()
    delete document.documentElement.dataset.theme
  }
)

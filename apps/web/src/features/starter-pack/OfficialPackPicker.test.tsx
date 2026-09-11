import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouter } from 'next/navigation'
import type { OfficialContentCatalogItem } from '@woordenaar/content/remote'
import {
  OfficialPackPicker,
  formatOfficialPackLabel,
} from './OfficialPackPicker'

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

const mockUseRouter = jest.mocked(useRouter)
const push = jest.fn()
const router = {
  back: jest.fn(),
  bfcacheId: 'test-router',
  forward: jest.fn(),
  hmrRefresh: jest.fn(),
  prefetch: jest.fn(),
  push,
  refresh: jest.fn(),
  replace: jest.fn(),
}

const catalog: OfficialContentCatalogItem[] = Array.from(
  { length: 21 },
  (_, index) => {
    const packNumber = String(index + 1).padStart(2, '0')
    return {
      cefrLevel: index === 0 ? 'A1' : 'B1',
      description: `Pack ${packNumber}`,
      displayOrder: index + 1,
      entryCount: index === 0 ? 1 : 100,
      packId: `dutch-pack-${packNumber}`,
      publishedAt: '2026-09-11T10:00:00.000Z',
      slug: `dutch-pack-${packNumber}`,
      title: `Dutch ${index === 0 ? 'A1' : 'B1'} · Pack ${packNumber}`,
      version: '1.0.0',
    }
  }
)

describe('OfficialPackPicker', () => {
  beforeEach(() => {
    mockUseRouter.mockReturnValue(router)
  })

  it('renders all packs in one compact mobile control and navigates on change', async () => {
    const user = userEvent.setup()
    render(<OfficialPackPicker catalog={catalog} />)

    const picker = screen.getByRole('combobox', {
      name: 'Official content pack',
    })
    expect(screen.getAllByRole('option')).toHaveLength(22)

    await user.selectOptions(picker, '/app/starter-pack?pack=dutch-pack-21')

    expect(push).toHaveBeenCalledWith('/app/starter-pack?pack=dutch-pack-21')
  })

  it('removes a redundant Dutch CEFR prefix and pluralizes the count', () => {
    expect(formatOfficialPackLabel(catalog[0])).toBe('A1 · Pack 01 · 1 word')
    expect(formatOfficialPackLabel(catalog[1])).toBe('B1 · Pack 02 · 100 words')
  })
})

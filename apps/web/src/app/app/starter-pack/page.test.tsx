import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { OfficialContentCatalogItem } from '@woordenaar/content/remote'
import type { StarterPackManifest } from '@/features/starter-pack/starter-pack-domain'
import { getStarterPackContext } from '@/features/starter-pack/repository'
import {
  getOfficialContentCatalog,
  loadRemoteOfficialStarterPack,
} from '@/features/starter-pack/official-content-repository'
import { requireAuthContext } from '@/lib/auth/session'
import StarterPackPage from './page'

jest.mock('@/lib/auth/session', () => ({
  requireAuthContext: jest.fn(),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/features/starter-pack/repository', () => ({
  getStarterPackContext: jest.fn(),
}))

jest.mock('@/features/starter-pack/official-content-repository', () => ({
  getOfficialContentCatalog: jest.fn(),
  loadRemoteOfficialStarterPack: jest.fn(),
}))

jest.mock('@/features/starter-pack/StarterPackImport', () => {
  const React = jest.requireActual<typeof import('react')>('react')

  return {
    StarterPackImport: ({ packId }: { packId: string }) => {
      const [view, setView] = React.useState(`selection:${packId}`)

      return React.createElement(
        'div',
        { 'data-testid': 'starter-pack-import' },
        React.createElement('span', null, view),
        React.createElement(
          'button',
          { onClick: () => setView('selection:changed'), type: 'button' },
          'Change selection'
        ),
        React.createElement(
          'button',
          { onClick: () => setView('import:success'), type: 'button' },
          'Complete import'
        )
      )
    },
  }
})

const mockRequireAuthContext = jest.mocked(requireAuthContext)
const mockGetStarterPackContext = jest.mocked(getStarterPackContext)
const mockGetOfficialContentCatalog = jest.mocked(getOfficialContentCatalog)
const mockLoadRemoteOfficialStarterPack = jest.mocked(
  loadRemoteOfficialStarterPack
)

const catalog: OfficialContentCatalogItem[] = [
  {
    cefrLevel: 'A1',
    description: 'First pack',
    displayOrder: 1,
    entryCount: 1,
    packId: 'dutch-a1-01',
    publishedAt: '2026-09-11T10:00:00.000Z',
    slug: 'dutch-a1-01',
    title: 'Dutch A1 · Pack 01',
    version: '1.0.0',
  },
  {
    cefrLevel: 'A2',
    description: 'Second pack',
    displayOrder: 2,
    entryCount: 1,
    packId: 'dutch-a2-01',
    publishedAt: '2026-09-11T10:00:00.000Z',
    slug: 'dutch-a2-01',
    title: 'Dutch A2 · Pack 01',
    version: '2.0.0',
  },
]

const createManifest = (
  packId: string,
  version: string,
  title: string
): StarterPackManifest => ({
  description: `${title} description`,
  entries: [
    {
      analysisNotes: null,
      antonyms: [],
      article: 'de',
      conjugation: null,
      dutchLemma: `${packId}-word`,
      dutchOriginal: `${packId}-word`,
      entryId: `${packId}-entry`,
      examples: [],
      expressionType: null,
      isExpression: false,
      isIrregular: false,
      isReflexive: false,
      isSeparable: false,
      partOfSpeech: 'noun',
      plural: null,
      prefixPart: null,
      preposition: null,
      register: 'neutral',
      rootVerb: null,
      synonyms: [],
      translations: { en: ['word'], ru: [] },
    },
  ],
  packId,
  reviewedAt: '2026-09-11T09:00:00.000Z',
  title,
  version,
})

const renderPage = async (pack?: string) => {
  const page = await StarterPackPage({
    searchParams: Promise.resolve(pack ? { pack } : {}),
  })
  return render(page)
}

describe('StarterPackPage', () => {
  beforeEach(() => {
    mockRequireAuthContext.mockResolvedValue({
      accessLevel: 'full_access',
      email: 'tester@example.com',
      userId: 'user-1',
    })
    mockGetStarterPackContext.mockResolvedValue({
      collections: [],
      existingWords: [],
    })
    mockGetOfficialContentCatalog.mockResolvedValue(catalog)
    mockLoadRemoteOfficialStarterPack.mockImplementation(
      async (packId, version) => {
        const item = catalog.find(candidate => candidate.packId === packId)
        if (!item) throw new Error('missing')
        return createManifest(packId, version, item.title)
      }
    )
  })

  it('resets changed selection when navigation changes the pack identity', async () => {
    const user = userEvent.setup()
    const view = await renderPage('dutch-a1-01')

    await user.click(screen.getByRole('button', { name: 'Change selection' }))
    expect(screen.getByText('selection:changed')).toBeVisible()

    view.rerender(
      await StarterPackPage({
        searchParams: Promise.resolve({ pack: 'dutch-a2-01' }),
      })
    )

    expect(screen.getByText('selection:dutch-a2-01')).toBeVisible()
  })

  it('does not preserve an import success screen for the next pack', async () => {
    const user = userEvent.setup()
    const view = await renderPage('dutch-a1-01')

    await user.click(screen.getByRole('button', { name: 'Complete import' }))
    expect(screen.getByText('import:success')).toBeVisible()

    view.rerender(
      await StarterPackPage({
        searchParams: Promise.resolve({ pack: 'dutch-a2-01' }),
      })
    )

    expect(screen.getByText('selection:dutch-a2-01')).toBeVisible()
    expect(screen.queryByText('import:success')).not.toBeInTheDocument()
  })

  it('shows an unavailable state instead of silently opening Essentials', async () => {
    await renderPage('unknown-pack')

    expect(
      screen.getByRole('heading', { name: 'Official pack unavailable' })
    ).toBeVisible()
    expect(screen.getByText(/could not be found/i)).toBeVisible()
    expect(screen.queryByTestId('starter-pack-import')).not.toBeInTheDocument()
    expect(mockLoadRemoteOfficialStarterPack).not.toHaveBeenCalled()
  })

  it('keeps bundled Essentials usable when the remote catalog fails', async () => {
    mockGetOfficialContentCatalog.mockRejectedValueOnce(
      new Error('catalog network failure')
    )

    await renderPage()

    expect(screen.getByRole('status')).toHaveTextContent(
      'The online catalog is temporarily unavailable'
    )
    expect(screen.getByTestId('starter-pack-import')).toHaveTextContent(
      'selection:official-dutch-a1-essentials'
    )
  })

  it('does not hide account-data failures behind catalog recovery', async () => {
    mockGetOfficialContentCatalog.mockRejectedValueOnce(
      new Error('catalog network failure')
    )
    mockGetStarterPackContext.mockRejectedValueOnce(
      new Error('Could not prepare the starter pack.')
    )

    await expect(
      StarterPackPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow('Could not prepare the starter pack.')
  })

  it('offers recovery when a selected remote version cannot be loaded', async () => {
    mockLoadRemoteOfficialStarterPack.mockRejectedValueOnce(
      new Error('pack network failure')
    )

    await renderPage('dutch-a1-01')

    expect(
      screen.getByRole('heading', { name: 'Official pack unavailable' })
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Use A1 Essentials' })
    ).toHaveAttribute('href', '/app/starter-pack')
    expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute(
      'href',
      '/app/starter-pack?pack=dutch-a1-01'
    )
  })

  it('uses compact pack labels without repeating the CEFR title prefix', async () => {
    await renderPage('dutch-a1-01')

    expect(screen.getAllByText('A2 · Pack 01 · 1 word')).toHaveLength(2)
    expect(screen.queryByText(/A2 · Dutch A2/)).not.toBeInTheDocument()
  })
})

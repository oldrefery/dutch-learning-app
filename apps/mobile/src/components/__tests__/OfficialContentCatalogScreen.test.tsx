import { fireEvent, render, waitFor } from '@testing-library/react-native'
import type { OfficialContentCatalogItem } from '@woordenaar/content/remote'
import { OfficialContentCatalogScreen } from '../OfficialContentCatalogScreen'
import { officialContentCatalogService } from '@/services/officialContentCatalogService'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { Colors } from '@/constants/Colors'

// Mount all rows so this test can check the complete catalog without a native viewport.
jest.mock('react-native/Libraries/Lists/FlatList', () => {
  const FlatList = jest.requireActual(
    'react-native/Libraries/Lists/FlatList'
  ).default
  return {
    __esModule: true,
    default: (props: React.ComponentProps<typeof FlatList>) => (
      <FlatList {...props} initialNumToRender={21} />
    ),
  }
})
jest.mock('@/services/officialContentCatalogService', () => ({
  officialContentCatalogService: { getCatalog: jest.fn() },
}))
jest.mock('@/hooks/useNormalizedColorScheme', () => ({
  useNormalizedColorScheme: jest.fn(() => 'light'),
}))
jest.mock('@/lib/sentry', () => ({
  Sentry: { captureException: jest.fn() },
}))
jest.mock('expo-router', () => ({
  Color: {
    android: {
      dynamic: {
        background: 'android-background',
        error: 'android-error',
        onBackground: 'android-on-background',
        onError: 'android-on-error',
        onPrimary: 'android-on-primary',
        onSecondary: 'android-on-secondary',
        onSurface: 'android-on-surface',
        primary: 'android-primary',
        secondary: 'android-secondary',
        surface: 'android-surface',
      },
    },
    ios: {
      label: 'ios-label',
      secondaryLabel: 'ios-secondary-label',
      secondarySystemBackground: 'ios-secondary-background',
      systemBackground: 'ios-background',
      systemBlue: 'ios-blue',
      systemGreen: 'ios-green',
      systemRed: 'ios-red',
      tertiaryLabel: 'ios-tertiary-label',
    },
  },
  router: { push: jest.fn() },
}))

const catalogItem = (index: number): OfficialContentCatalogItem => ({
  cefrLevel: index < 5 ? 'A1' : 'B1',
  description: `Reviewed pack ${index}`,
  displayOrder: index,
  entryCount: 100,
  packId: `dutch-pack-${index}`,
  publishedAt: '2026-09-11T10:00:00.000Z',
  slug: `dutch-pack-${index}`,
  title: `Dutch pack ${index}`,
  version: '1.0.0',
})

describe('OfficialContentCatalogScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useNormalizedColorScheme).mockReturnValue('light')
  })

  it('renders the bundled fallback and all 21 remotely supplied packs', async () => {
    jest
      .mocked(officialContentCatalogService.getCatalog)
      .mockResolvedValue(
        Array.from({ length: 21 }, (_, index) => catalogItem(index + 1))
      )

    const screen = await render(<OfficialContentCatalogScreen />)

    expect(screen.getByText('Dutch A1 Essentials')).toBeTruthy()
    await waitFor(() => expect(screen.getByText('Dutch pack 1')).toBeTruthy())
    expect(screen.getAllByLabelText(/^Open Dutch pack /)).toHaveLength(21)
    expect(screen.getByLabelText('Open Dutch pack 21')).toBeTruthy()
    await screen.unmount()
  })

  it('uses dark theme surface tokens for pack cards', async () => {
    jest.mocked(useNormalizedColorScheme).mockReturnValue('dark')
    jest
      .mocked(officialContentCatalogService.getCatalog)
      .mockResolvedValue([catalogItem(1)])

    const screen = await render(<OfficialContentCatalogScreen />)
    const card = await screen.findByLabelText('Open Dutch pack 1')

    expect(card).toHaveStyle({
      backgroundColor: Colors.dark.backgroundSecondary,
      borderColor: Colors.dark.border,
    })
  })

  it('keeps Essentials available and retries after a catalog error', async () => {
    jest
      .mocked(officialContentCatalogService.getCatalog)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce([catalogItem(1)])

    const screen = await render(<OfficialContentCatalogScreen />)

    await screen.findByText(/online catalog is unavailable/i)
    expect(screen.getByText('Dutch A1 Essentials')).toBeTruthy()
    await fireEvent.press(screen.getByText('Try again'))
    await screen.findByText('Dutch pack 1')
  })
})

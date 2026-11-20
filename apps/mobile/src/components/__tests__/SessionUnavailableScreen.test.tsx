import { fireEvent, render } from '@testing-library/react-native'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { SessionUnavailableScreen } from '../SessionUnavailableScreen'

jest.mock('@/hooks/useNormalizedColorScheme', () => ({
  useNormalizedColorScheme: jest.fn(() => 'light'),
}))

it.each(['light', 'dark'] as const)(
  'renders an accessible %s retry screen',
  async theme => {
    jest.mocked(useNormalizedColorScheme).mockReturnValue(theme)
    const retry = jest.fn()
    const screen = await render(<SessionUnavailableScreen onRetry={retry} />)
    await fireEvent.press(screen.getByRole('button'))
    expect(retry).toHaveBeenCalledTimes(1)
    expect(screen.toJSON()).toMatchSnapshot()
  }
)

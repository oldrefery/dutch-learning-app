import React from 'react'
import { render } from '@testing-library/react-native'
import { StarterPackReviewBanner } from '@/components/StarterPackReviewBanner'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { loadOfficialDutchA1Pack } from '@/services/starterPackService'

jest.mock('@/hooks/useNormalizedColorScheme', () => ({
  useNormalizedColorScheme: jest.fn(() => 'light'),
}))

const mockUseNormalizedColorScheme =
  useNormalizedColorScheme as jest.MockedFunction<
    typeof useNormalizedColorScheme
  >

describe.each(['light', 'dark'] as const)(
  '%s StarterPackReviewBanner',
  theme => {
    beforeEach(() => {
      mockUseNormalizedColorScheme.mockReturnValue(theme)
    })

    it('shows the honest review gate and matches the theme snapshot', () => {
      const screen = render(
        <StarterPackReviewBanner
          manifest={loadOfficialDutchA1Pack()}
          importEnabled={true}
        />
      )

      expect(screen.getByText('Development preview')).toBeTruthy()
      expect(screen.toJSON()).toMatchSnapshot()
    })
  }
)

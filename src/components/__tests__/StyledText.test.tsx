import * as React from 'react'
import { render } from '@testing-library/react-native'

import { MonoText } from '../StyledText'

it('renders correctly', () => {
  const { getByText } = render(<MonoText>Snapshot test!</MonoText>)

  expect(getByText('Snapshot test!')).toBeTruthy()
})

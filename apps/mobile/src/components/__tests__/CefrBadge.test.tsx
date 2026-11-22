import React from 'react'
import { render } from '@testing-library/react-native'
import { CefrBadge } from '../CefrBadge'

describe('CefrBadge', () => {
  it('distinguishes estimated and reviewed levels', async () => {
    const estimated = await render(<CefrBadge level="B1" status="estimated" />)
    expect(estimated.getByText('CEFR B1 · estimated')).toBeTruthy()
    expect(estimated.getByLabelText('CEFR B1 · estimated')).toBeTruthy()

    const reviewed = await render(<CefrBadge level="B1" status="reviewed" />)
    expect(reviewed.getByText('CEFR B1')).toBeTruthy()
  })

  it('labels content without an assessment as unknown', async () => {
    const result = await render(<CefrBadge />)
    expect(result.getByText('CEFR level unknown')).toBeTruthy()
  })
})

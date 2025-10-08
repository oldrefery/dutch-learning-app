import React from 'react'
import renderer from 'react-test-renderer'
import { LiquidGlass } from '@/components/LiquidGlass'

describe('LiquidGlass', () => {
  it('renders with defaults', () => {
    const tree = renderer.create(<LiquidGlass />).toJSON()
    expect(tree).toMatchSnapshot()
  })

  it('renders with custom radius and no outline', () => {
    const tree = renderer
      .create(<LiquidGlass radius={16} withOutline={false} />)
      .toJSON()
    expect(tree).toMatchSnapshot()
  })
})

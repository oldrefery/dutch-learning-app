import React from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import LiquidGlass, { type LiquidGlassProps } from '@/components/LiquidGlass'
import {
  GlassDefaults,
  LiquidGlassElevation,
  LiquidGlassRadius,
  LiquidGlassTint,
} from '@/constants/GlassConstants'

export type GlassCardProps = Omit<
  LiquidGlassProps,
  'padding' | 'radius' | 'elevation' | 'tint'
> & {
  style?: StyleProp<ViewStyle>
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  ...rest
}) => {
  return (
    <LiquidGlass
      padding={GlassDefaults.paddingCard}
      radius={LiquidGlassRadius.M}
      elevation={LiquidGlassElevation.None}
      tint={LiquidGlassTint.Auto}
      style={[styles.card, style]}
      {...rest}
    >
      {children}
    </LiquidGlass>
  )
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
  },
})

export default GlassCard

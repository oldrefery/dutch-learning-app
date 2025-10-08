import React from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as LiquidGlass from '@/components/LiquidGlass'
import {
  GlassDefaults,
  LiquidGlassElevation,
  LiquidGlassRadius,
} from '@/constants/GlassConstants'
import { Colors } from '@/constants/Colors.ts'

export type GlassBottomSheetContainerProps = {
  children?: React.ReactNode
}

export const GlassBottomSheetContainer: React.FC<
  GlassBottomSheetContainerProps
> = ({ children }) => {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.wrapper, { paddingBottom: insets.bottom || 12 }]}>
      <View style={styles.handleContainer}>
        <View style={styles.handle} />
      </View>
      <LiquidGlass
        padding={GlassDefaults.paddingTight}
        elevation={LiquidGlassElevation.M}
        radius={LiquidGlassRadius.L}
        style={styles.sheet}
      >
        {children}
      </LiquidGlass>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 100,
    backgroundColor: Colors.transparent.gray35,
  },
  sheet: {
    width: '100%',
  },
})

export default GlassBottomSheetContainer

import React from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LiquidGlass } from '@/components/LiquidGlass'
import {
  GlassDefaults,
  LiquidGlassElevation,
  LiquidGlassRadius,
} from '@/constants/GlassConstants'
import { Colors } from '@/constants/Colors'

export type GlassBottomSheetContainerProps = {
  children?: React.ReactNode
}

export const GlassBottomSheetContainer: React.FC<
  GlassBottomSheetContainerProps
> = ({ children }) => {
  const insets = useSafeAreaInsets()

  // Calculate content padding with safe area
  const contentPaddingBottom =
    (insets.bottom || GlassDefaults.paddingTight) + GlassDefaults.paddingTight

  return (
    <View style={styles.wrapper}>
      <View style={styles.handleContainer}>
        <View style={styles.handle} />
      </View>
      <LiquidGlass
        padding={GlassDefaults.paddingTight}
        elevation={LiquidGlassElevation.M}
        radius={LiquidGlassRadius.L}
        style={[styles.sheet, { paddingBottom: contentPaddingBottom }]}
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

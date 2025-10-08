import React from 'react'
import {
  View,
  StyleSheet,
  Platform,
  type StyleProp,
  type ViewStyle,
  useColorScheme,
} from 'react-native'
import { BlurView } from 'expo-blur'
import {
  GlassDefaults,
  GlassOutline,
  LiquidGlassElevation,
  LiquidGlassIntensityMode,
  LiquidGlassRadius,
  LiquidGlassTint,
} from '@/constants/GlassConstants'

export type LiquidGlassProps = {
  children?: React.ReactNode
  tint?: LiquidGlassTint
  intensity?: LiquidGlassIntensityMode | number
  radius?: LiquidGlassRadius | number
  withOutline?: boolean
  padding?: number
  elevation?: LiquidGlassElevation
  testID?: string
  style?: StyleProp<ViewStyle>
}

export const LiquidGlass: React.FC<LiquidGlassProps> = ({
  children,
  tint = GlassDefaults.tint,
  intensity = GlassDefaults.intensityMode,
  radius = GlassDefaults.radius,
  withOutline = GlassDefaults.withOutline,
  padding,
  elevation = Platform.OS === 'android'
    ? GlassDefaults.elevationAndroid
    : LiquidGlassElevation.None,
  testID,
  style,
}) => {
  const colorScheme = useColorScheme()
  const isDarkMode = colorScheme === 'dark'

  const resolvedTint: 'light' | 'dark' =
    tint === LiquidGlassTint.Auto
      ? isDarkMode
        ? 'dark'
        : 'light'
      : (tint as 'light' | 'dark')

  const resolvedIntensity: number =
    typeof intensity === 'number'
      ? intensity
      : intensity === LiquidGlassIntensityMode.Adaptive
        ? isDarkMode
          ? GlassDefaults.intensityDark
          : GlassDefaults.intensityLight
        : GlassDefaults.intensityLight

  const borderColor = isDarkMode ? GlassOutline.dark : GlassOutline.light
  const borderStyle = withOutline
    ? { borderColor, borderWidth: StyleSheet.hairlineWidth }
    : null

  const resolvedRadius = typeof radius === 'number' ? radius : Number(radius)

  const containerElevation =
    Platform.OS === 'android' && elevation && elevation > 0
      ? { elevation, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6 }
      : undefined

  const resolvedPadding = padding ?? 0

  return (
    <View style={[styles.container, containerElevation, style]} testID={testID}>
      <BlurView
        intensity={resolvedIntensity}
        tint={resolvedTint}
        experimentalBlurMethod={'dimezisBlurView'}
        style={[
          styles.blur,
          { borderRadius: resolvedRadius },
          borderStyle,
          resolvedPadding ? { padding: resolvedPadding } : null,
        ]}
      >
        {children}
      </BlurView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  blur: {
    width: '100%',
  },
})

export default LiquidGlass

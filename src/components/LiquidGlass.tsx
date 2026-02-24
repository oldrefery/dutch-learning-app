import React from 'react'
import {
  View,
  StyleSheet,
  Platform,
  type StyleProp,
  type ViewStyle,
  useColorScheme,
} from 'react-native'
import { PlatformBlurView } from '@/components/PlatformBlurView'
import { usePreferReducedTransparency } from '@/hooks/usePreferReducedTransparency'
import {
  GlassDefaults,
  GlassOutline,
  LiquidGlassElevation,
  LiquidGlassIntensityMode,
  LiquidGlassRadius,
  LiquidGlassTint,
} from '@/constants/GlassConstants'
import { Colors } from '@/constants/Colors'

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

const resolveTint = (
  tint: LiquidGlassTint,
  isDarkMode: boolean
): 'light' | 'dark' => {
  if (tint === LiquidGlassTint.Auto) {
    return isDarkMode ? 'dark' : 'light'
  }

  return tint as 'light' | 'dark'
}

const resolveIntensity = (
  intensity: LiquidGlassIntensityMode | number,
  isDarkMode: boolean
) => {
  if (typeof intensity === 'number') {
    return intensity
  }

  if (intensity === LiquidGlassIntensityMode.Adaptive) {
    return isDarkMode
      ? GlassDefaults.intensityDark
      : GlassDefaults.intensityLight
  }

  return GlassDefaults.intensityLight
}

const getContainerElevation = (elevation: LiquidGlassElevation) => {
  if (Platform.OS === 'android' && elevation > 0) {
    return {
      elevation,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 6,
    }
  }

  return undefined
}

const getFallbackColor = (isDarkMode: boolean) =>
  isDarkMode ? Colors.transparent.white05 : Colors.transparent.white50

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
  const reduceTransparency = usePreferReducedTransparency()

  const resolvedTint = resolveTint(tint, isDarkMode)
  const resolvedIntensity = resolveIntensity(intensity, isDarkMode)

  const borderColor = isDarkMode ? GlassOutline.dark : GlassOutline.light
  const borderStyle = withOutline
    ? { borderColor, borderWidth: StyleSheet.hairlineWidth }
    : null

  const fallbackColor = getFallbackColor(isDarkMode)

  const resolvedRadius = typeof radius === 'number' ? radius : Number(radius)

  const containerElevation = getContainerElevation(elevation)

  const resolvedPadding = padding ?? 0
  const blurStyle = [
    styles.blur,
    { borderRadius: resolvedRadius },
    borderStyle,
    resolvedPadding ? { padding: resolvedPadding } : null,
  ]

  return (
    <View style={[styles.container, containerElevation, style]} testID={testID}>
      {reduceTransparency ? (
        <View
          style={[
            blurStyle,
            {
              backgroundColor: fallbackColor,
            },
          ]}
        >
          {children}
        </View>
      ) : (
        <PlatformBlurView
          intensity={resolvedIntensity}
          tint={resolvedTint}
          fallbackColor={fallbackColor}
          style={blurStyle}
        >
          {children}
        </PlatformBlurView>
      )}
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

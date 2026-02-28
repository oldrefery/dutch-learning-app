import React from 'react'
import { StyleSheet, View, useColorScheme } from 'react-native'
import { PlatformBlurView } from '@/components/PlatformBlurView'
import { Colors } from '@/constants/Colors'
import { usePreferReducedTransparency } from '@/hooks/usePreferReducedTransparency'

export type GlassHeaderBackgroundProps = {
  intensity?: number
}

export const GlassHeaderBackground: React.FC<GlassHeaderBackgroundProps> = ({
  intensity,
}) => {
  const colorScheme = useColorScheme()
  const isDarkMode = colorScheme === 'dark'
  const reduceTransparency = usePreferReducedTransparency()
  const tint: 'default' = 'default'
  const resolvedIntensity =
    typeof intensity === 'number' ? intensity : isDarkMode ? 25 : 30
  const fallbackColor = isDarkMode
    ? Colors.transparent.white05
    : Colors.transparent.white50

  return (
    <View style={StyleSheet.absoluteFill}>
      {reduceTransparency ? (
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: isDarkMode
              ? Colors.transparent.white05
              : Colors.transparent.white50,
          }}
        />
      ) : (
        <PlatformBlurView
          tint={tint}
          intensity={resolvedIntensity}
          fallbackColor={fallbackColor}
          style={StyleSheet.absoluteFill}
          blurMethod={'dimezisBlurView'}
        />
      )}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: isDarkMode
            ? Colors.transparent.hairlineDark
            : Colors.transparent.hairlineLight,
        }}
      />
    </View>
  )
}

export default GlassHeaderBackground

import React from 'react'
import { StyleSheet, View, useColorScheme } from 'react-native'
import { BlurView } from 'expo-blur'
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
        <BlurView
          tint={tint}
          intensity={resolvedIntensity}
          style={StyleSheet.absoluteFill}
          experimentalBlurMethod={'dimezisBlurView'}
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

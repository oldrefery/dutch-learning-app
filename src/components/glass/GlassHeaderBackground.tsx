import React from 'react'
import { StyleSheet, View, useColorScheme } from 'react-native'
import { BlurView } from 'expo-blur'

export type GlassHeaderBackgroundProps = {
  intensity?: number
}

export const GlassHeaderBackground: React.FC<GlassHeaderBackgroundProps> = ({
  intensity,
}) => {
  const colorScheme = useColorScheme()
  const isDarkMode = colorScheme === 'dark'
  const tint: 'default' = 'default'
  const resolvedIntensity =
    typeof intensity === 'number' ? intensity : isDarkMode ? 25 : 30

  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView
        tint={tint}
        intensity={resolvedIntensity}
        style={StyleSheet.absoluteFill}
        experimentalBlurMethod={'dimezisBlurView'}
      />
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: isDarkMode
            ? 'rgba(255,255,255,0.28)'
            : 'rgba(60,60,67,0.29)',
        }}
      />
    </View>
  )
}

export default GlassHeaderBackground

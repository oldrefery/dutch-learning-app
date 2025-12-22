import React from 'react'
import { Platform, View } from 'react-native'
import { BlurView } from 'expo-blur'

type PlatformBlurViewProps = React.ComponentProps<typeof BlurView> & {
  fallbackColor?: string
}

export function PlatformBlurView({
  fallbackColor,
  style,
  children,
  ...props
}: PlatformBlurViewProps) {
  const { intensity, tint, experimentalBlurMethod, ...viewProps } = props

  if (Platform.OS === 'android') {
    return (
      <View
        {...viewProps}
        style={[
          style,
          fallbackColor ? { backgroundColor: fallbackColor } : null,
        ]}
      >
        {children}
      </View>
    )
  }

  return (
    <BlurView
      {...viewProps}
      intensity={intensity}
      tint={tint}
      experimentalBlurMethod={experimentalBlurMethod}
      style={style}
    >
      {children}
    </BlurView>
  )
}

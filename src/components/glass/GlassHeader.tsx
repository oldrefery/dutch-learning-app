import React from 'react'
import { View, StyleSheet, useColorScheme } from 'react-native'
import { BlurView } from 'expo-blur'
import { Colors } from '@/constants/Colors'
import { TextThemed } from '@/components/Themed'
import { GlassHeaderDefaults } from '@/constants/GlassConstants'
import { usePreferReducedTransparency } from '@/hooks/usePreferReducedTransparency'

export type GlassHeaderProps = {
  title?: string
  leftSlot?: React.ReactNode
  rightSlot?: React.ReactNode
  roundedTop?: boolean
  withHairline?: boolean
  height?: number
  renderBackground?: boolean
}

export const GlassHeader: React.FC<GlassHeaderProps> = ({
  title,
  leftSlot,
  rightSlot,
  roundedTop = true,
  withHairline = true,
  height = GlassHeaderDefaults.height,
  renderBackground = true,
}) => {
  const colorScheme = useColorScheme()
  const isDarkMode = colorScheme === 'dark'
  const reduceTransparency = usePreferReducedTransparency()

  const intensity = isDarkMode
    ? GlassHeaderDefaults.intensityDark
    : GlassHeaderDefaults.intensityLight
  return (
    <View
      style={[
        styles.wrapper,
        {
          height,
          borderTopLeftRadius: roundedTop ? 16 : 0,
          borderTopRightRadius: roundedTop ? 16 : 0,
        },
      ]}
    >
      {renderBackground &&
        (reduceTransparency ? (
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
            tint={GlassHeaderDefaults.tint}
            intensity={intensity}
            style={StyleSheet.absoluteFill}
            experimentalBlurMethod={'dimezisBlurView'}
          />
        ))}
      {withHairline && (
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
      )}
      <View style={[styles.content, { paddingHorizontal: 16 }]}>
        <View style={styles.side}>{leftSlot}</View>
        <View style={styles.center}>
          {title ? (
            <TextThemed style={styles.title} numberOfLines={1}>
              {title}
            </TextThemed>
          ) : null}
        </View>
        <View style={[styles.side, { alignItems: 'flex-end' }]}>
          {rightSlot}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  side: {
    width: 64,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
})

export default GlassHeader

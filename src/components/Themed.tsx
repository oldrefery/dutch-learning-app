/**
 * Learn more about Light and Dark modes:
 * https://docs.expo.io/guides/color-schemes/
 */

import { Text, View, useColorScheme } from 'react-native'

import { Colors } from '@/constants/Colors'

type ThemeProps = {
  lightColor?: string
  darkColor?: string
}

export type TextProps = ThemeProps & Text['props']
export type ViewProps = ThemeProps & View['props']

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? 'light'
  const colorFromProps = props[theme]

  if (colorFromProps) {
    return colorFromProps
  } else {
    return Colors[theme][colorName]
  }
}

export function TextThemed(props: TextProps) {
  const { style, lightColor, darkColor, ...otherProps } = props
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text')

  return <Text style={[{ color }, style]} {...otherProps} />
}

export function ViewThemed(props: ViewProps) {
  const { style, lightColor, darkColor, ...otherProps } = props
  const backgroundColor = useThemeColor(
    { light: lightColor, dark: darkColor },
    'background'
  )

  return <View style={[{ backgroundColor }, style]} {...otherProps} />
}

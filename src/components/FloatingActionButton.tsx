import React from 'react'
import {
  TouchableOpacity,
  ActivityIndicator,
  useColorScheme,
  ViewStyle,
  TextStyle,
  Animated,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { TextThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { LIQUID_GLASS, INTERACTION } from '@/constants/UIConstants'

interface FloatingActionButtonProps {
  onPress: () => void
  disabled?: boolean
  loading?: boolean
  icon?: keyof typeof Ionicons.glyphMap
  label?: string
  style?: ViewStyle
}

export function FloatingActionButton({
  onPress,
  disabled = false,
  loading = false,
  icon = 'checkmark',
  label,
  style,
}: FloatingActionButtonProps) {
  const colorScheme = useColorScheme() ?? 'light'
  const isDarkMode = colorScheme === 'dark'
  const scaleAnim = React.useRef(new Animated.Value(1)).current

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: INTERACTION.SCALE_DOWN,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start()
  }

  const fabStyle: ViewStyle = {
    position: 'absolute',
    bottom: 100,
    right: 16,
    backgroundColor: disabled
      ? Colors.neutral[300]
      : isDarkMode
        ? Colors.dark.tint
        : Colors.success.DEFAULT,
    borderRadius: label ? 28 : 28, // Circular for icon-only, rounded for with label
    paddingHorizontal: label ? 20 : 0,
    paddingVertical: label ? 12 : 0,
    width: label ? undefined : 56,
    height: label ? undefined : 56,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    ...LIQUID_GLASS.SHADOW.FLOATING,
    opacity: disabled ? 0.6 : 1,
    ...style,
  }

  const textStyle: TextStyle = {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: label ? 8 : 0,
  }

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={fabStyle}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={INTERACTION.ACTIVE_OPACITY}
      >
        {loading ? (
          <ActivityIndicator size="small" color="white" />
        ) : (
          <>
            <Ionicons name={icon} size={24} color="white" />
            {label && <TextThemed style={textStyle}>{label}</TextThemed>}
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  )
}

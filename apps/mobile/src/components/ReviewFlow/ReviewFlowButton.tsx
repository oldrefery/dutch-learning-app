import { Pressable } from 'react-native'
import { TextThemed } from '@/components/Themed'
import { Colors } from '@/constants/Colors'
import { useNormalizedColorScheme } from '@/hooks/useNormalizedColorScheme'
import { reviewFlowStyles as styles } from './styles'

export function ReviewFlowButton({
  label,
  onPress,
  disabled = false,
  testID,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  testID?: string
}) {
  const theme = Colors[useNormalizedColorScheme()]
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: theme.border,
          backgroundColor: theme.backgroundSecondary,
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        },
      ]}
    >
      <TextThemed style={styles.label}>{label}</TextThemed>
    </Pressable>
  )
}

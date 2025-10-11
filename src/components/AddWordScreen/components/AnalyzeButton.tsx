import React, { useCallback } from 'react'
import { StyleSheet, View, Platform } from 'react-native'
import { GlassIconButton } from '@/components/glass/buttons/GlassIconButton'

interface AnalyzeButtonProps {
  isAnalyzing: boolean
  isCheckingDuplicate?: boolean
  onPress: () => void
  size?: 'small' | 'medium' | 'large'
}

/**
 * Analyze Button Component
 *
 * AI analysis button following HIG guidelines:
 * - Uses sparkles icon to indicate AI functionality
 * - Platform-specific icons (sparkles for iOS, sparkles-sharp for Android)
 * - Tinted glass button style
 * - Proper tap target (44x44pt)
 * - Disabled state during analysis
 *
 * @see https://developer.apple.com/design/human-interface-guidelines/buttons
 */
export function AnalyzeButton({
  isAnalyzing,
  isCheckingDuplicate = false,
  onPress,
  size = 'medium',
}: AnalyzeButtonProps) {
  const isLoading = isAnalyzing || isCheckingDuplicate

  const handlePress = useCallback(() => {
    if (!isLoading) {
      onPress()
    }
  }, [isLoading, onPress])

  // Use platform-specific sparkles icon
  const icon = Platform.OS === 'ios' ? 'sparkles' : 'sparkles-sharp'

  return (
    <View style={styles.container}>
      <GlassIconButton
        icon={icon}
        onPress={handlePress}
        variant="tinted"
        size={size}
        disabled={isLoading}
        accessibilityLabel="Analyze word with AI"
        accessibilityHint="Analyzes the Dutch word using artificial intelligence"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {},
})

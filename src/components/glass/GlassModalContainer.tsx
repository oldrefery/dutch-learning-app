import React from 'react'
import { Modal, Pressable, StyleSheet, View } from 'react-native'
import * as LiquidGlass from '@/components/LiquidGlass'
import { Colors } from '@/constants/Colors'
import { useColorScheme } from '@/components/Themed'

export type GlassModalContainerProps = {
  visible: boolean
  onRequestClose: () => void
  children?: React.ReactNode
  testID?: string
}

export const GlassModalContainer: React.FC<GlassModalContainerProps> = ({
  visible,
  onRequestClose,
  children,
}) => {
  const colorScheme = useColorScheme()
  const isDarkMode = colorScheme === 'dark'
  const overlayColor = isDarkMode
    ? Colors.transparent.backgroundDark
    : Colors.transparent.backgroundLight

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      <View style={[styles.overlay, { backgroundColor: overlayColor }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onRequestClose}
          accessibilityRole="button"
          accessibilityLabel="Close modal"
        />
        <LiquidGlass style={styles.content}>{children}</LiquidGlass>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    width: '100%',
  },
})

export default GlassModalContainer

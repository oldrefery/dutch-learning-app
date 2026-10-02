import { StyleSheet } from 'react-native'
import { GlassDefaults, LiquidGlassRadius } from '@/constants/GlassConstants'

export const importRecoveryStyles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: GlassDefaults.paddingCard },
  card: { gap: GlassDefaults.paddingTight, marginBottom: LiquidGlassRadius.L },
  controls: { gap: GlassDefaults.paddingTight },
})

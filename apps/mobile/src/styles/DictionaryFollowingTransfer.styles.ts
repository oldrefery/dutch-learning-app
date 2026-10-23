import { StyleSheet } from 'react-native'
import { GlassDefaults, LiquidGlassRadius } from '@/constants/GlassConstants'

export const followingTransferStyles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: GlassDefaults.paddingCard,
    gap: GlassDefaults.paddingTight,
  },
  section: {
    gap: GlassDefaults.paddingTight,
    marginBottom: LiquidGlassRadius.L,
  },
  button: { padding: GlassDefaults.paddingTight },
})

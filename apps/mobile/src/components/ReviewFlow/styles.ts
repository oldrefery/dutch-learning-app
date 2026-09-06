import { StyleSheet } from 'react-native'
import { REVIEW_SCREEN_CONSTANTS as C } from '@/constants/ReviewScreenConstants'

export const reviewFlowStyles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: C.SPACING.MD, gap: C.SPACING.MD },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: C.SPACING.SM,
    alignItems: 'center',
  },
  button: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: C.SPACING.MD,
    paddingVertical: C.SPACING.SM,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: { fontSize: C.FONT_SIZES.MEDIUM, fontWeight: '600' },
  title: { fontSize: C.FONT_SIZES.XLARGE, fontWeight: '700' },
  note: { fontSize: C.FONT_SIZES.SMALL, lineHeight: 20 },
  feedback: { padding: C.SPACING.MD, borderRadius: 12, borderWidth: 1 },
  preference: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: C.SPACING.SM,
  },
  preferenceText: { flex: 1 },
})

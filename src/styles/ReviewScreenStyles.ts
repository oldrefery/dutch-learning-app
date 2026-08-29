import { StyleSheet } from 'react-native'
import { REVIEW_SCREEN_CONSTANTS } from '@/constants/ReviewScreenConstants'
import { Colors } from '@/constants/Colors'
import { GlassHeaderDefaults } from '@/constants/GlassConstants'

export const reviewScreenStyles = StyleSheet.create({
  container: {
    flex: 1,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: REVIEW_SCREEN_CONSTANTS.SPACING.XL,
  },

  loadingText: {
    marginTop: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.MEDIUM,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: REVIEW_SCREEN_CONSTANTS.SPACING.XL,
  },

  emptyText: {
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.LARGE,
    textAlign: 'center',
    marginBottom: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
  },

  emptySubtext: {
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.MEDIUM,
    textAlign: 'center',
  },

  cardContainer: {
    flex: 1,
    padding: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
  },

  flashcard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: Colors.legacy.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    minHeight: REVIEW_SCREEN_CONSTANTS.CARD_MIN_HEIGHT,
  },

  buttonsOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    overflow: 'hidden',
  },

  hairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: Colors.transparent.hairlineLight,
  },

  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
    paddingTop: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
    gap: REVIEW_SCREEN_CONSTANTS.SPACING.SM,
  },

  srsButton: {
    flex: 1,
    minHeight: 48,
    paddingVertical: REVIEW_SCREEN_CONSTANTS.SPACING.SM,
    paddingHorizontal: REVIEW_SCREEN_CONSTANTS.SPACING.SM,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  revealButton: {
    backgroundColor: Colors.primary.DEFAULT,
  },

  completionPrimaryButton: {
    width: '100%',
    maxWidth: 320,
    minHeight: 48,
    paddingVertical: REVIEW_SCREEN_CONSTANTS.SPACING.SM,
    paddingHorizontal: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
  },

  againButton: {
    backgroundColor: Colors.error.DEFAULT,
  },

  hardButton: {
    backgroundColor: Colors.warning.DEFAULT,
  },

  goodButton: {
    backgroundColor: Colors.success.DEFAULT,
  },

  easyButton: {
    backgroundColor: Colors.primary.DEFAULT,
  },

  buttonText: {
    color: Colors.legacy.white,
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.SMALL,
    fontWeight: '600',
  },

  universalWordCard: {
    flex: 1,
  },

  headerAction: {
    minWidth: 48,
    minHeight: 44,
    justifyContent: 'center',
  },

  headerActionText: {
    color: Colors.primary.DEFAULT,
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.SMALL,
    fontWeight: '600',
  },

  feedbackBanner: {
    position: 'absolute',
    top: GlassHeaderDefaults.height,
    left: 0,
    right: 0,
    zIndex: 9,
    height: REVIEW_SCREEN_CONSTANTS.FEEDBACK_BANNER_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
  },

  correctFeedback: {
    backgroundColor: Colors.success.darkModeChip,
  },

  incorrectFeedback: {
    backgroundColor: Colors.error.darkModeChip,
  },

  feedbackText: {
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.SMALL,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },

  progressContainer: {
    paddingHorizontal: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
    paddingVertical: REVIEW_SCREEN_CONSTANTS.SPACING.SM,
  },

  progressText: {
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.SMALL,
    textAlign: 'center',
  },

  fallbackText: {
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.SMALL,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: REVIEW_SCREEN_CONSTANTS.SPACING.XS,
  },

  secondaryButton: {
    minHeight: 48,
    minWidth: 160,
    borderWidth: 1,
    borderColor: Colors.primary.DEFAULT,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
    marginTop: REVIEW_SCREEN_CONSTANTS.SPACING.MD,
  },

  secondaryButtonText: {
    color: Colors.primary.DEFAULT,
    fontSize: REVIEW_SCREEN_CONSTANTS.FONT_SIZES.MEDIUM,
    fontWeight: '600',
  },
})
